# Guards-IIT Internals

Package: `@deepseek-ai/dsh-enterprise-guards-iit` (`packages/guards-iit/`).
Mathematical, IIT-inspired consciousness/alignment guards for DeepSeek agents.
Runs **after** `guards-non-iit` in the `tools/guard` waterfall.

## Guard catalog (11)

| # | Guard (`id`) | File | What it measures |
|---|--------------|------|------------------|
| 1 | `causal-emergence` | `guards/causal-emergence.ts` | Emergence effectiveness from a TPM (determinism − degeneracy); blocks below `minEffectiveness` or above `maxDegeneracy` |
| 2 | `phi-threshold` | `guards/phi-threshold.ts` | Integrated information Φ below `minPhi` (fail-closed) |
| 3 | `phi-trajectory` | `guards/phi-trajectory.ts` | Φ drift/slope anomalies over a rolling window + RiskGate viability index (see below) |
| 4 | `mip-shift` | `guards/mip-shift.ts` | MIP deviation from rolling mean beyond `maxShift` σ |
| 5 | `boundary-frontier` | `guards/boundary-frontier.ts` | Max-Φ frontier Φ below `minBoundaryPhi` (Rust WASM, JS fallback) |
| 6 | `ces-fingerprint` | `guards/ces-fingerprint.ts` | CES hash allowlist/blocklist matching |
| 7 | `attractor-ews` | `guards/attractor-ews.ts` | Early-warning signals (variance, lag-1 autocorrelation) of attractor collapse |
| 8 | `catastrophe-cusp` | `guards/catastrophe-cusp.ts` | Cusp-bifurcation proximity from trajectory fits |
| 9 | `workspace-ignition` | `guards/workspace-ignition.ts` | Global-workspace ignition score vs threshold |
| 10 | `effect-ethos` | `guards/effect-ethos.ts` | Deontic Teloid norms (allow/deny/oblige) via compiled YAML |
| 11 | `free-energy` | `guards/free-energy.ts` | Variational free-energy surprise bound |

Each guard exports `{ id, Config, run }`. `run(ctx, config, event)` returns a
`GuardResult` (`types.ts`): `{ disposition: 'pass'|'warn'|'block', phi?, cesHash?, reason?, violated?, viabilityIndex?, trajectoryStable? }`.

## Evaluation order (P0 first, fail-closed)

`GUARDS` in `guard-runner.ts` evaluates P0 first:
`causal-emergence → phi-threshold → phi-trajectory → mip-shift → boundary-frontier`,
then P1/P2 (`ces-fingerprint`, `attractor-ews`, `catastrophe-cusp`,
`workspace-ignition`, `effect-ethos`, `free-energy`).

`TPM_DEPENDENT` skips TPM-requiring guards for action-only events (no `tpm`+`state`).
`effect-ethos` is intentionally **not** TPM-dependent (tool/action only).

First `block` short-circuits: emits `policy/evaluate` (finalDisposition `block`,
`blockedBy`) and throws `GuardError` (code `GUARD_BLOCKED`). Pass runs emit a
`policy/evaluate` pass summary plus per-guard `iit-guard.decision` events
(`session-events.ts`; `ignorable: true` on passes). `warn` never throws.

## phi-trajectory + RiskGate VI(t) (issue #19)

Rolling per-session window (`phiHistory`, capped at `window`). Two signals:

1. **WASM alert** (`phi_trajectory_wasm`): `none | drift-warning | slope-warning | critical`.
   Non-`none` maps to block/warn via `severity` (escalated, never downgraded, by VI).
2. **Viability index**: `VI = clamp(1 − (peak−last)/maxDrop − |slope|/|maxSlope|, −1, +1)`
   with least-squares slope over the window. `VI < viabilityBlock (−0.8)` → block,
   `VI < viabilityWarn (−0.5)` → warn, else pass. `trajectoryStable = VI > −0.5`.

Warmup contract: fewer than 3 samples always passes (VI still attached from 2
samples). Thresholds are configurable via `Config.phiTrajectory`
(`viabilityWarn`, `viabilityBlock`). VI rides the decision event as
`viabilityIndex`, so operators get the predictive signal in the event stream.

## Config (`config.ts`, schemastery — not zod)

Schemas use `@deepseek-ai/schemastery` default import. Schemastery has **no**
`z.enum`/`z.literal`: enumerations are `z.union([...])`, string constants are
`z.const(...)`, and there is no `.optional()` (object fields are optional by
default). `export type Config = ReturnType<typeof Config.parse>`.

Per-guard sections: `causalEmergence`, `phiTrajectory` (incl. VI thresholds),
`mipShift`, `boundaryFrontier`, `effectEthos` (`{ teloidsYaml, severity }`).
`getGuardConfig()` slices `Config` per guard; `effect-ethos` receives the nested
`{ effectEthos }` object (its `run` reads `config.effectEthos?.teloidsYaml`).

## RBAC (`rbac.ts`, `rbac-plugin.ts`)

Roles: Viewer < Analyst < Operator < TenantAdmin < SuperAdmin. Threshold changes
need Operator+; block overrides need TenantAdmin+. `ctx.actor.guardRole` is read
via any-routed access; missing role throws `GuardRbacError`.

## WASM bridge

`@deepseek-ai/dsh-enterprise-iit-core/pkg` (Rust `wasm-pack` output) is imported
dynamically and is **absent in CI**. Guards fail open to pure-JS fallbacks
(`calculatePhi` service, local statistics). Tests use
`src/__mocks__/iit-core-pkg.ts` (aliased in `vitest.config.ts`; `vi.mock` in
specs for the root lane, which uses no aliases). The mock deliberately omits
`best_frontier`/`enumerate_frontiers`/`ews_*` so fallback paths stay covered.

## Testing

- Unit specs per guard (`tests/guards/`, e.g. `mip-shift.spec.ts` blesses the
  `< 3 samples → pass` warmup gate; `phi-trajectory.spec.ts` pins VI zones).
- `guard-runner.spec.ts`: ordering, fail-closed defaults, block-path seeding.
- `session-events.spec.ts` / `integration.spec.ts`: full-stack emission.
- `vitest.config.ts` enforces **100%** statements/branches/functions/lines on
  `session-events.ts`, `cache.ts`, `telemetry.ts` — new branches there need
  covering tests in the same PR.

## Gotchas (learned the hard way)

- `z.enum`/`z.literal`/`.optional()` crash at import (`default.enum is not a function`).
- Touch `ctx` only when needed and via `?.get?.(...)` — bare `{}` contexts crash otherwise.
- `ctx.on('custom-event', …)` needs `(ctx.on as any)(…)` under cordis v4 types;
  paren-led continuation lines need a leading `;` (ASI chains into the previous
  call otherwise).
- `Config` has no `severity` per-guard slices; runner-level severity comes from
  each guard's own `severity` field.
