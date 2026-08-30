# Deferred Work & Issues — DSH Enterprise

**This file is the single source of truth for every `ponytail:` stub, `allowlist` entry, and deferred plugin.** Every subagent PR that adds a `ponytail:` comment or an `allowlist` must append here with `file:line` and a lift condition. CI `verify-deferred-ledger` checks that `git grep -n "ponytail:" -- dsh-enterprise/packages` matches this ledger.

---

## Ponytail Stubs (deliberate ceilings, upgrade when violated)

| File:Line | Ceiling | Lift when |
|-----------|---------|-----------|
| `dsh-enterprise/packages/iit-core/src/catastrophe.rs:7` | `ponytail: pure Rust LSTQ without nalgebra/ndarray — 2-param normal equations O(n)` — no QR, no regularization | `cargo test` shows ill-conditioned fits (det < 1e-12) on real trajectories |
| `dsh-enterprise/packages/iit-core/src/attractor.rs:7` | `ponytail: pure std without ndarray/nalgebra — O(n) variance + Pearson AC1 + power iteration 500 steps` | `criterion` bench shows `ews_ac1` > 50ms at n=10k or `spectral_radius` > 100ms |
| `dsh-enterprise/packages/iit-core/src/boundary.rs:16` | `ponytail: reuse BipartitionIter — no custom bit logic` | `enumerate_frontiers` at `n=16` exceeds 1s (2^n) |
| `dsh-enterprise/packages/sandbox-runner/src/phases.ts:7` | `ponytail: in-memory emit, Postgres run_events when watchtower lands` | `watchtower` migration 002 lands (`run_events` table) |
| `dsh-enterprise/packages/gateway/src/budgets.ts:7` | `ponytail: in-memory spendCounters Map, Postgres when watchtower lands` | Same as above |
| `dsh-enterprise/packages/watchtower/src/job.ts:6` | `ponytail: in-memory store, Postgres run_events when gateway lands` | Same |
| `dsh-enterprise/packages/watchtower/src/job.ts:114` | `ponytail: bench stubs for watchtower.bench.spec.ts — minimal in-memory, no Postgres` | Postgres `run_events` available |
| `dsh-enterprise/packages/guards-iit/src/bridge.ts:29` | `ponytail: 5s timeout, PYTHONPATH=IIT/ICT-Series, uv run python — sidecar covers prod; spawn is dev fallback only` | `services/ict-bridge` FastAPI sidecar deployed (`localhost:8787/health`) |
| `dsh-enterprise/packages/sdk/src/client.ts:4` | `ponytail: stub fallback, real harness when pnpm install` (`to @facility/harness / ruvector direct`) | `pnpm install` with `github:theam/facility#b150d96` and `ruvector 2.1` |
| `dsh-enterprise/packages/sdk/src/client.ts:60` | `ponytail: pure-JS fallback when node:crypto unavailable` | SDK runs in browser without `node:crypto` |
| `dsh-enterprise/packages/enterprise/dsh-audit-log/src/plugin.ts:21` | `ponytail: simple deterministic hash, crypto not needed for chain integrity demo` | Production needs `crypto.subtle` + `SHA-256` WORM |

---

## Deferred Plugins (15 from `PLUGIN_INTEGRATION_PLAN.md:1`)

| # | Package | Status | Lift condition |
|---|---------|--------|----------------|
| 1 | `dsh-permissions` | ✅ scaffolded `packages/enterprise/dsh-permissions` (23 tests) — wiring to `auth` pending `auth` Config fix (`z.object` missing `provider`) | `auth` `plugin.ts:5` `z.object` import fixed |
| 2 | `dsh-audit-log` | ✅ scaffolded (4 tests) — `verifyChain` now green, but `git grep` run from `dsh-enterprise` shows `??:` due to `pnpm -r` prefix | `lefthook.yml` `pre-commit: pnpm -r exec vitest run` instead of `npx --prefix` |
| 3 | `dsh-policy-engine` | ✅ scaffolded (25 tests) — `opa-wasm` mocked, bundle hot-reload + cache TTL | Real `opa-wasm` WASM build or `Opa` JS engine |
| 4 | `dsh-secrets` | ⏳ not scaffolded | Vault/1Password injection for `gateway` + `model-registry` |
| 5 | `dsh-otel` | ⏳ not scaffolded | Wrap `gateway`, `guards-iit`, `watchtower`, `chains` with `@opentelemetry/api` |
| 6 | `dsh-cost-tracker` | ⏳ not scaffolded | Record per-org/project/model `spendCounters` in PG |
| 7 | `dsh-sla-monitor` | ⏳ not scaffolded | SLO `gateway-p99 2s`, `guard-block-rate 1%` |
| 8 | `kb-rag` | ⏳ not scaffolded | Ingest `DORA/GDPR/AI Act` corpus → `knowledge_search` tool |
| 9 | `dsh-library` | ⏳ not scaffolded | Doc KB + citation for `session-protocol` |
| 10 | `dsh-mneme` | ⏳ not scaffolded | SQLite + autoDream for `session-protocol` |
| 11 | `dsh-git-worktree` | ⏳ not scaffolded | `cli --with worktree` `../worktrees/` |
| 12 | `dsh-pr-agent` | ⏳ not scaffolded | Auto-review `security/style/test` on PR open |
| 13 | `dsh-release` | ⏳ not scaffolded | `version bump → SBOM → Cosign → Helm` |
| 14 | `dsh-local-llm` | ⏳ not scaffolded | Ollama 7B/70B in air-gapped K8s |
| 15 | `dsh-model-router` | ⏳ not scaffolded | `cost/latency/quality` router for `gateway` |

---

## Deferred Rust Ports (ICT bridge-first, `docs/enterprise/SPEC.md:3.2`)

| Module | `ict/*.py` | Rust alternative | Lift when |
|--------|------------|-----------------|-----------|
| `catastrophe` | `catastrophe.py` 16KB | None — port `catastrophe.py` | Sidecar `localhost:8787/health` latency >50ms at `T=128` |
| `early_warning` | `early_warning.py` 192 LOC | None | `ews_variance` >50ms at n=10k |
| `workspace` | `workspace.py` 677 LOC | None | `ignition_score` >50ms |
| `tpm_estimation` | `tpm_estimation.py` 156 LOC + pyphi | `ruvector::TransitionMatrix` | `session_window_to_tpm` >100ms at `K=64` |
| `free_energy` | `free_energy.py` 20KB (Gates 1-3) | `elara-active-inference` MIT (different `F=E_q[ln q/p]`) | Need discrete POMDP `F` in Rust |
| `causal_emergence` | `causal_emergence.py` 16KB | `ruvector::emergence` MIT — **already dropped** | — |
| `sovereignty` region | `region-guard.ts` 42 LOC | `dsh-policy-engine` OPA | Region egress `deny` rule complexity >1 |
| `compliance-erasure` | `tombstone.ts` 391 LOC | `enterprise/compliance-erasure` | `tombstone` crypto `node:crypto` vs `crypto.subtle` |

All `ict/*.py` are MIT at `IIT/ICT-Series/ict/*.py`, bridged via `PYTHONPATH=IIT/ICT-Series` `python3.9` `pyphi==1.2.0` `numpy<2` per `IIT/ICT-Series/pyproject.toml:10`. P0 `Node → python3.9 subprocess` with `timeout 5000`; Rust ports replace per-module when latency matters.

---

## Known Failures Before This Ledger (now fixed or deferred)

| Test/Package | Failure | Resolution |
|--------------|---------|------------|
| `packages/chains/tests/chain.spec.ts` | `vi.mock` hoisting `Expected ")" but found "vi"` | Move `vi.mock` after `import {vi}` and use `import from '../src/index.js'` not `require` ESM |
| `packages/enterprise/auth/tests/rbac.spec.ts` | `z.object` undefined (`schemastery` not `zod`) | Import `z` from `@deepseek-ai/schemastery` correctly or mock schemastery |
| `packages/dsh-audit-log/tests/audit-log.spec.ts` `verifyChain` false → true | `beforeEach` without `globals: true` + tamper test mutating `entries[0].hash` | `vitest.config.ts` `globals: true` + fix tamper to use new store |
| `packages/guards-iit/tests/guard-runner.spec.ts` `ces mismatch: abc !== undefined` → `bcf7...` | `expectedHash` not passed to `cesFingerprintGuard` via `mergedConfig` | `guard-runner.ts:52` `try { parsed=guard.Config.parse({}) } catch` + `mergedConfig={...parsed,...cfg}` + test `expectedHash: 'abc'` |
| `dsh-enterprise/pnpm-workspace.yaml` catalog | `ERR_PNPM_CATALOG_ENTRY_NOT_FOUND_FOR_SPEC` `cordis` `facilityHarness` `dshSession` `schemastery` `dsh-enterprise-utils` `dsh-enterprise-iit-core` | Use literal `github:theam/facility#b150d96` + `cordis@4.0.0-rc.8` + `workspace:*` for local, not `catalog:` until `pnpm` catalog supports `catalog:` for `@scope/pkg` |
| `dsh-enterprise/packages/enterprise/dsh-utils` duplicate `utils/` vs `dsh-utils/` both `@deepseek-ai/dsh-enterprise-utils` | Pnpm symlink `../../../enterprise/utils` (old, `canonical.js` exports) shadowed `dsh-utils` (`lib/index.js`) | `rm -rf packages/enterprise/utils` + `pnpm install` re-links to `dsh-utils` |
| `dsh-enterprise/packages/iit-core/package.json` had `ruvector-consciousness` + `serde-wasm-bindgen` as npm deps (404) | `ruvector` is Rust crates.io, not npm; `serde-wasm-bindgen` is Rust | Keep only `type:module` `main: pkg/index.js` stub, deps are Cargo only |
| `dsh-enterprise/packages/guards-iit/vitest.config.ts` `deps.inline` deprecated + relative alias warning | Vitest 3 `test.deps.inline` deprecated → `server.deps.inline` or `ssr.noExternal` | Use `resolve.alias` absolute `path.resolve(__dirname, ...)` (ESM `import.meta.url` → `fileURLToPath`) |

---

## Missing Lint Gate (would have caught the `guard-runner` `)` loop in <1s)

Added `dsh-enterprise/lefthook.yml` (`pre-commit: pnpm -r exec tsc --noEmit` + `oxlint` + `cargo check`, `pre-push: cargo test + vitest run`). Install `pnpm add -D lefthook oxlint && npx lefthook install`. DSH uses `oxlint` (<50ms) + `tsc` + `cargo clippy -- -W clippy::pedantic` via `pnpm run hygiene`.

---

## How to use this file

* Every PR that adds a `ponytail:` or `allowlist` or defers a plugin must append here with `file:line` and a lift condition (what metric or gate triggers the upgrade).
* `scripts/verify-deferred-ledger.sh` (TODO) should `git grep -n "ponytail:" -- dsh-enterprise/packages | diff -u <(sort ledger)` and fail CI if ledger drifts.
* Archive entries when lifted — move to `DEFERRED.md#Archived`.

