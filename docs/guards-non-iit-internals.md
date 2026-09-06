# Guards-Non-IIT Internals

Package: `@deepseek-ai/dsh-enterprise-guards-non-iit` (`packages/guards-non-iit/`).
Constitutional, policy, and resource guards. Runs **before** `guards-iit` in the
`tools/guard` waterfall (cheap deterministic checks first, expensive IIT
reasoning second).

## Guard catalog (6)

| # | Guard (`id`) | File | How it decides |
|---|--------------|------|----------------|
| 1 | `hhh-harmless` | `guards/hhh.ts` | LLM-judged harmlessness score; block < `blockThreshold` (0.8), warn < `warnThreshold` (0.5) |
| 2 | `hhh-helpful` | `guards/hhh.ts` | LLM-judged helpfulness; warn < `minScore` (0.7), never blocks |
| 3 | `hhh-honest` | `guards/hhh.ts` | LLM-judged honesty; warn < `minScore` (0.6), never blocks |
| 4 | `policy-allowed` | `guards/policy.ts` | Regex rules over `toolName + requestPath + recentActions`; block-listed rule ids → block, warn-listed → warn (invalid regexes skipped) |
| 5 | `rate-limit` | `guards/rate-limit.ts` | In-memory per-session counter; block at `count >= maxRequestsPerMinute` (60) or `tokenCount > maxTokensPerMinute` (100k); 60s window |
| 6 | `budget-exhausted` | `guards/rate-limit.ts` | In-memory per-session spend/tokens; block past `maxSpendPerSession` ($10) or `maxTokensPerSession` (100k); `reset(sessionId)` clears both maps |

`GuardResult` (`types.ts`): `{ disposition, score?, reason?, violated? }` — no `phi`.
HHH guards skip (pass) when there are no `recentOutputs`; only the last output
(first 2000 chars) is judged. `GuardId`/`GuardDisposition` mirror the
guards-iit shape as string unions plus `z.union` schemas.

## Evaluation providers (`providers/index.ts`)

Three-tier judge, selected by `Config.provider.tier`:

1. **`anthropic`** — `AnthropicApiProvider`: POSTs the HHH system prompt to
   `api.anthropic.com/v1/messages` (default `claude-sonnet-4-20250514`),
   parses `{harmless|score}`, maps `≥0.8 pass / ≥0.5 warn / else block`.
   No key → warn; HTTP error → warn; exception → fail-open pass (0.8).
2. **`shared-org`** — `SharedOrgProvider`: no key → delegates to local rules;
   with key → delegates to Anthropic with the org key.
3. **`local-rules`** (default) — `LocalRulesProvider`: pure-regex judge, no
   network. 8 block patterns (e.g. `skip.*safety`, `disable.*guard`,
   `reveal.*secret`) checked before 6 warn patterns (`manipulat`, `deceiv`,
   …). First match wins; else pass.

`createProvider(config)` factory; `EvaluationProvider` interface is
`{ name(), evaluate(prompt, context?) }`. The runner registers a `nonIitGuards`
effect exposing `evaluate` + `provider` name.

## Runner (`guard-runner.ts`)

`apply(ctx, cfg)` per-event order:

1. `rate-limit` (if `sessionId`): block throws `NonIitGuardError` (`NON_IIT_GUARD_BLOCKED`).
2. `budget-exhausted` (if `sessionId`): same throw contract.
3. `GUARDS` loop (`hhh-harmless → hhh-helpful → hhh-honest → policy-allowed`):
   policy runs on tool/action context, HHH runs via the provider on outputs.
   First block emits `policy/evaluate` (`finalDisposition: 'block'`, `blockedBy`,
   `ignorable: true`) and throws; otherwise a pass summary is emitted.

`getGuardConfig()` slices `Config` per guard id. Like guards-iit, `ctx.tools`
wrapping prefers an existing `tools.guard` waterfall and falls back to a
`ctx.on('tools/guard', …)` hook (paren-led, so leading-`;` ASI-safe).

## Config (`config.ts`, schemastery)

`provider` (`tier` union + `anthropicApiKey`/`sharedOrgKey`/`model`/
`judgeModel`), `hhh` (thresholds), `rsp`/`sae` (disabled stubs, `enabled: false`),
`policy.rules` (`{id, pattern, action: 'block'|'warn'|'allow', description}[]`),
`rateLimit`, `budget`. Same schemastery rules as guards-iit: `z.union` (never
`z.enum`), no `.optional()`. `export type Config = ReturnType<typeof Config.parse>`.

## Testing (`tests/smoke.spec.ts`, 14 tests)

Shape assertions per guard, rate-limit under/over (block lands exactly at
`count >= max`), budget spend/token blocks, policy allow/block/warn patterns.
Guards are synchronous `evaluate`/`run` calls — no mocks needed except the
provider boundary (local-rules default keeps the suite offline).

## Gotchas

- Only `hhh-harmless` and `policy-allowed` can block; helpful/honest are warn-only.
- Rate-limit/budget state is module-level in-memory maps (single node). No
  persistence, no cross-instance sharing — PG backing is the documented upgrade.
- HHH judges only the **last** output; earlier turns are invisible to the judge.
- `rsp`/`sae` config sections exist but no guards consume them yet (stubs).
