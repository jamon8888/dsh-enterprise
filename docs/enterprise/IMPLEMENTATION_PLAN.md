# DSH Enterprise — Final Implementation Plan (Cordis-Only, No Upstream Touch)

**Date:** 2026-08-27 — grounded in real clones at `dsh@b150a551b8` / `facility@b150d96` / `ruvector-consciousness@2.1.0 MIT` + `elara-active-inference@0.1 MIT` + `iit@0.1.0` + `deep_causality_core@0.11 MIT`, `IIT/ICT-Series` notebooks, and `basemind` index (344 roots, 331 hits). All MIT/Apache — zero AGPL in enterprise core.
**Constraint:** Zero file in `dsh/` or `facility/` is edited. All new code in `packages/enterprise/**` at the test-root, composed via Cordis `ctx.effect()` / `inject` / `profile.extend`.
**Goal:** Best-in-world harness = DSH + Facility governance + IIT/ICT causal guards, packaged as CLI + MCP + SDK + Docs, fully benchmark-monitored and auditable.

---

## 0. Real Repo Map (verified 2026-08-27)

```
test/                          # not a git repo (root for enterprise work)
├── dsh/                       # git: deepseek-ai/deepseek-harness @ b150a551b8 (0.1.1-rc.2)
│   ├── pnpm-workspace.yaml    # packages/*/*, vendor/cosmokit@1.8.1, cordis@4.0.0-rc.7
│   ├── packages/core/session/src/types.ts  # SessionEventMap, SessionId, SESSION_FORMAT_VERSION=0
│   ├── packages/core/session/src/known-event-types.ts
│   ├── packages/guard/repeat-tool-reminder, timeout-policy  # only 2 guards — NOT a framework
│   ├── packages/skill/skill/src/index.ts   # SkillRegistry, SkillProvider (124 symbols, sophisticated)
│   ├── packages/sandbox/sandbox-local, sandbox-policy, sandbox-windows-acl
│   ├── packages/credentials/authorization
│   ├── packages/mcp/mcp-client  # NOTE: client-only, no server (facility has server)
│   ├── packages/boot/cmdline    # CLI glue to port for enterprise
│   └── vendor/cordis@56b3d4f7, cosmokit@16f6fc0, schemastery@e67cee0
├── facility/                  # git: theam/facility @ b150d96
│   ├── pnpm-workspace.yaml    # packages/*, services/*, runner
│   ├── packages/harness/src/chain.ts       # productChain, researchChain, bundledChains (4642 B)
│   ├── packages/harness/src/session.ts     # HarnessSessionInput, buildHarnessBundle, sessionMd (4738 B)
│   ├── packages/harness/src/validate.ts, provenance.ts, wsjf.ts
│   ├── packages/core/src/detect.ts, permissions.ts, fingerprints.ts
│   ├── packages/db/src/schema.ts           # drizzle pgTable: users, orgs, roles, org_members, ...
│   ├── services/gateway/src/  budgets.ts(9941 B) auth.ts provider-auth.ts metering.ts envelope-store.ts types.ts
│   ├── services/api/ + runner/src/phases.ts # RunPhaseRecorder, RUN_PHASE_NAMES (9 phases)
│   ├── packages/mcp/                        # server + client (DSH lacks server)
│   └── packages/cli/src/init.mjs (27569 B) # to port
├── IIT/                       # NOT a git repo — notebooks + ict/ py package (pyproject.toml: pyphi==1.2.0, Python ≤3.9, NumPy<2)
│   ├── IIT-1..4 notebooks (Phi, CES, MIP, 3→4 nodes, coarse-graining, frontier — 11 candidates)
│   └── ICT-Series/ (30+ notebooks: PhiTrajectories, CausalEmergence, AttractorLandscapesEWS, CatastropheGrammar,
│       CausalAgencyProfiles, LLMSubstrat SAE, PersonaCatastrophe (Thom cusp), WorkspaceIgnition GWT↔IIT, etc.)
├── packages/                  # test-root packages (already: identity/auth, session/session-collaboration, session-persistence-postgres)
│   └── enterprise/            # ← NEW: all implementation lives here
└── docs/enterprise/SPEC.md    # v0.1 spec (this plan's parent)

/tmp/ruvector-consciousness-2.1.0/src/{lib,phi,emergence,collapse}.rs  # MIT: TransitionMatrix, auto_compute_phi, effective_information, EI, collapse::QuantumCollapseEngine, SIMD+bump, wasm getrandom/js
/tmp/iit-0.1.0/src/lib.rs      # MIT (kept as alt): IITSystem{ n, state, tpm, connectivity, config:PhiConfig } — superseded by ruvector
```

**Pinned crate APIs (real, all MIT/Apache):**
```rust
// ruvector-consciousness = "2.1" MIT: auto_compute_phi(&TransitionMatrix, &ComputeBudget::exact()) -> PhiResult{phi, algorithm}
//   + emergence::{effective_information, determinism, degeneracy, causal_emergence}
//   + collapse::QuantumCollapseEngine (Grover O(√N) MIP)
// elara-active-inference = "0.1" MIT OR Apache-2.0: Agent::step(obs) -> Action, variational F + expected G
// deep_causality_core = "0.11" MIT: Causaloid/Context/CSM (LF AI & Data)
// iit = "0.1.0" MIT — kept as alt, superseded by ruvector
TransitionMatrix::new(n, data: Vec<f64>) -> row-stochastic TPM
auto_compute_phi(&tpm, Some(state), &ComputeBudget::exact())
```
PyPhi `1.2.0` is **Python-only, GPL-3.0, Python ≤3.9** — not usable as Rust dep; `symthaea-fep` is **AGPL-3.0** — rejected; Facility `harness/chain.ts` is the only Facility source we port verbatim (small, MIT).

---

## 1. Target Layout — standalone repo, library-installed (no vendoring, no test/packages nesting)

Enterprise is **its own git repo** `dsh-enterprise/` (sibling to `dsh/` and `facility/` reference clones), not `test/packages/enterprise`. `test/` has no `pnpm-workspace.yaml`/`Cargo.toml` (verified) — the clones at `test/dsh` + `test/facility` are **reference checkouts for basemind and git log only**.

```
dsh-enterprise/                  # git: github:your-org/dsh-enterprise
├── package.json                # private umbrella, pnpm@9, type: module
├── pnpm-workspace.yaml         # packages: ["packages/*", "packages/iit-core"], catalog: { facilityHarness: "github:theam/facility#b150d96", dshSession: "0.1.1-rc.2", cordis: "4.0.0-rc.7" }
├── Cargo.toml                  # cargo workspace members = ["packages/iit-core"], resolver 2, edition 2024, rust-version 1.85
├── pyproject.toml              # python 3.9 pin: pyphi==1.2.0, numpy<2, ict via PYTHONPATH
├── packages/
│   ├── iit-core/               # Rust → WASM (cdylib+rlib), ruvector 2.1 {phi,emergence,collapse,wasm} + elara 0.1 + deep_causality_core 0.11
│   │   ├── Cargo.toml
│   │   ├── src/{lib.rs, tpm.rs, catastrophe.rs, attractor.rs, boundary.rs, workspace.rs}
│   │   └── benches/phi_bench.rs
│   ├── chains/                 # import @facility/harness — no copy of facility/packages/harness/src/chain.ts
│   ├── session-protocol/       # import @deepseek-ai/dsh-session, declare module SessionEventMap
│   ├── guards-iit/             # wraps iit-core WASM + bridges ict/*.py via services/ict-bridge sidecar (not spawn per guard)
│   ├── gateway/                # service reimplementation of Facility gateway pattern (services/gateway is not a publishable package)
│   ├── sandbox-runner/         # service reimplementation of Facility runner phases as new service
│   ├── watchtower/             # receipts + outcome joining, migration 002
│   ├── cli/                    # bin: dsh-enterprise
│   ├── mcp/                    # MCP server (re-exports DSH tools + guards)
│   └── sdk/                    # consumer SDK
└── services/
    └── ict-bridge/             # FastAPI sidecar (python:3.9-slim, uv sync --locked) for ict/*.py — not per-call spawn
```

Scaffolded at `dsh-enterprise/{package.json,pnpm-workspace.yaml,Cargo.toml,pyproject.toml}` (see `CRITICAL_REVIEW.md:3.1`). Gated by `scripts/verify-deps.sh` (see §7) — not `git -C dsh diff --quiet` (which only catches uncommitted edits, not `pnpm patch` or `overrides`).

**Example: `dsh-enterprise/packages/chains/package.json`**

```json
{ "name": "@deepseek-ai/dsh-enterprise-chains", "version": "0.1.0", "type": "module",
  "dependencies": { "@facility/harness": "github:theam/facility#b150d96", "@deepseek-ai/dsh-session": "0.1.1-rc.2", "@deepseek-ai/cordis": "4.0.0-rc.7" } }
```

```ts
// packages/chains/src/plugin.ts — import, don't copy
import { productChain, bundledChains, chainFromConfig } from '@facility/harness/chains';
import { validateChain } from '@facility/harness/validate';
```

---

## 2. Rust Core — iit-core

### 2.1 Crate Decisions — all MIT/Apache (zero AGPL)

* **Adopt `ruvector-consciousness = "2.1" MIT`** — **SOTA**, replaces `iit 0.1.0`: `phi` (exact `O(2^n)`, spectral `O(n² log n)`, stochastic `O(k·n²)`, greedy `O(n³)`), `emergence` (`effective_information` `EI=(1/n)Σ D_KL(row‖uniform)` at `src/emergence.rs:30`, `determinism`, `degeneracy`, `causal_emergence`), `collapse` (Grover `O(√N)` MIP), `arena` zero-alloc, `simd`, `getrandom/js` for `wasm32` (`features = ["phi","emergence","collapse","wasm"]`). Verified `/tmp/ruvector-consciousness-2.1.0/src/{lib,phi,emergence,collapse}.rs` + `Cargo.toml` `license = MIT`, `rust-version 1.77`.
* **Adopt `elara-active-inference = "0.1" MIT OR Apache-2.0`** — pure `std` zero deps, discrete POMDP variational `F` + expected `G`, Elara Protocol extract. **Replaces `symthaea-fep 0.1.0` AGPL-3.0** (rejected — viral). TS alt `active-inference` npm (Codevanger) kept as fallback.
* **Adopt `deep_causality_core = "0.11" MIT`** (LF AI & Data) — `Causaloid`/`Context`/`CSM` — same as before, but now part of a 100% MIT/Apache stack. WASM `alloc` feature available.
* **Rejected:** `symthaea-fep` + `symthaea-consciousness-equation` both `AGPL-3.0-or-later` (see `/tmp/symthaea-fep-0.1.0/Cargo.toml.orig:7`), `iit = "0.1"` kept only as alt superseded by `ruvector`.
* **WASM bindings:** `wasm-bindgen` + `serde-wasm-bindgen` + `getrandom/js` — `ruvector` already has `[target.'cfg(wasm32)'.dependencies] getrandom = {features=["js"]}`.
* **Build:** `wasm-pack build --target bundler --features wasm` emits `pkg/` consumed by `guards-iit`. Also `rlib` for native tests/benches.

### 2.2 Custom modules to write (grounded math, small)

| Module | File | Math / iface |
|--------|------|--------------|
| `catastrophe` | `src/catastrophe.rs` | `V_cusp(x;a,b)=x⁴/4 + b x²/2 + a x`, bifurcation set `8b³+27a²=0`, `cusp_extrema(alpha,beta)`, `cusp.nc` equivalent. Input: scalar trajectory. Output: `CuspFit{alpha,beta, distanceToBifurcation, hysteresis}`. ~250 LOC. Bridges `ict/catastrophe.py` (16 KB, `import numpy as np`) for P0. |
| `attractor` | `src/attractor.rs` | Rolling variance, lag-1 AC, `spectral_radius(connectivity)`. EWS thresholds from `IIT/ICT-Series/ICT-8-AttractorLandscapesEWS.ipynb`; bridges `ict/early_warning.py` (192 LOC, `sliding_window_view`). ~300 LOC. |
| `boundary` | `src/boundary.rs` | `enumerate_frontiers(substrate)` → all cuts on same substrate, `maxΦ` frontier vs max `EI` frontier (double dissociation from `IIT-4` notebook). Wraps `ruvector_consciousness::phi::BipartitionIter` + `emergence::effective_information`. ~200 LOC. |
| `workspace` | `src/workspace.rs` | GWT ignition gate: `ignition = fan_out * activation` threshold. TBD thresholds from `IIT/ICT-Series/ICT-24-WorkspaceIgnition.ipynb`; bridges `ict/workspace.py` (677 LOC, numpy-only). ~250 LOC. |

`emergence.rs` **deleted** — `ruvector_consciousness::emergence::{effective_information, determinism, causal_emergence}` already implements Hoel 2017 (`EI = (1/n) Σ D_KL(row‖uniform)`). Total custom Rust: **~1.0k LOC** (was 1.4k). P0 **bridge-first**: `Node → python3.9 subprocess` (`PYTHONPATH=IIT/ICT-Series`, `pip install -e .`, `pyphi==1.2.0` Python≤3.9 NumPy<2) for `ict/*.py` (50 modules, `~22.7k LOC` total, guard-relevant `126–677 LOC`); Rust ports replace bridge per-module when latency matters. See `SPEC.md:3.2` table for full `ict/*.py` → Rust mapping.

### 2.3 TPM Adapter (the only DSH-specific code)

`src/tpm.rs`:
```rust
pub fn session_window_to_tpm(window: &[SessionEvent], n_vars: usize) -> (TransitionMatrix, usize /* state idx */) {
  // n_vars booleans = [tool_success, approval_granted, skill_loaded...] (4-8)
  // Build n=2^n_vars states TPM row-stochastic, smooth 0.5 prior (ruvector default).
  // Return (TransitionMatrix::new(n, data), current_state)
  // Tested: auto_compute_phi(&tpm, &ComputeBudget::exact()) within 1e-6 vs pyphi synthetic.
}
```
`ruvector::TransitionMatrix::new(n, Vec<f64> row-major)` + `auto_compute_phi`. Window `K=64`, configurable.

---

## 3. Chains, Session Protocol, Gateway, Runner — Ports

### 3.1 `packages/enterprise/chains`
* **Source:** `facility/packages/harness/src/chain.ts` (12 symbols) is **not copied**. `dsh-enterprise/packages/chains` declares `dependencies: { "@facility/harness": "github:theam/facility#b150d96" }` and imports:
  ```ts
  import { productChain, researchChain, bundledChains, chainFromConfig } from '@facility/harness/chains';
  import { validateChain } from '@facility/harness/validate';
  ```
  `@facility/harness` is `private:true` but installable via `github:` (pinned SHA `b150d96` in `pnpm-lock.yaml` with integrity). No `zod→schemastery` replacement — Facility's own `dist/` types are used. If types mismatch, file an issue on `theam/facility`.
* **Cordis plugin:** `src/plugin.ts` → `ctx.effect('chains', () => ({ productChain, researchChain, bundledChains, validate: validateChain, chainFromConfig }))`.
* **Consumers:** `watchtower` validates `S→D→T→V` before `outcome=accepted`.

### 3.2 `packages/enterprise/session-protocol`
* **Source:** `facility/packages/harness/src/session.ts` (`HarnessSessionInput`, `buildHarnessBundle`, `sessionMd`). ~200 LOC, no DB.
* **Cordis:** `ctx.effect('sessionProtocol', ...)` + `declare module '@deepseek-ai/dsh-session'` extending `SessionEventMap`:
  ```ts
  'chain/signal': { chainId:string; signal: Signal }  // required
  'chain/decision': {…}  // required
  'chain/task': {…}      // required
  'chain/verification': {…}
  'iit/coherence': { phi:number; cesHash:string; mip:PartitionInfo; ignorable:true } // informational
  'iit/cusp': { distanceToBifurcation:number; ignorable:true }
  ```
  Required chain events → old readers **refuse** log (correct). `iit/*` are ignorable → old readers skip.
* **No `SESSION_FORMAT_VERSION` bump** needed for these adds (per `dsh/packages/core/session/src/types.ts:338` `ignorable` discipline).

### 3.3 `packages/enterprise/gateway`
* **Source:** `facility/services/gateway/src/{budgets.ts, auth.ts, provider-auth.ts, metering.ts, envelope-store.ts}` are **services, not publishable packages** (`facility/packages/*` are packages; `services/*` and `runner` are services). Until `theam/facility` publishes `services/gateway` as `@facility/gateway-core`, this is a **service reimplementation** (not a library import) that tracks upstream `facility@b150d96` via SHA in `pnpm-workspace.yaml` `catalog.facilityHarness`. Reimplement `budgets.ts` logic (`applicableBudgets → hardBudgetBlock → reserveHardBudgets → adjustBudgetReservations` on `spendCounters(budget_id, window_start)`) with a diverging `CHANGELOG.md` until upstream publishes.
* **Cordis:** `inject: ['credentials','audit','objectStore?']`, `ctx.effect('gateway', ...)` **and** decorator around `ctx.llm` (wrap `generate` to meter + envelope-capture before/after delegate). This is the sanctioned decorator pattern per `dsh/packages/AGENTS.md` ("pass a private capability closure instead").

### 3.4 `packages/enterprise/sandbox-runner`
* **Source:** `facility/runner/src/phases.ts` (`RUN_PHASE_NAMES: [bootstrap, workspace, runner_runtime, package_install, provision, agent, result_capture, acceptance, delivery]`) is a **runner service, not a publishable package** — same reimplementation status as `gateway`. Track `facility@b150d96` SHA; if Facility publishes `@facility/runner-core`, switch to `import { RunPhaseRecorder } from '@facility/runner-core/phases'`.
* **Cordis:** `inject: ['sandbox','audit','gateway?']`, wraps `ctx.sandbox.run(bundle) => phases.measure(...)`. Secret redaction at event boundary (Facility pattern) — simple regex deny-list + `ctx.get('credentials')` filter.

---

## 4. Guards-IIT — Cordis Guard Runner

* **File:** `packages/enterprise/guards-iit/src/guard-runner.ts`
* **Inject:** `['tools','sessions','audit','chains','gateway?']` (+ lazy `import('.../pkg/iit_core')` for WASM).
* **Pattern:** Decorate `ctx.tools.guard` waterfall. Each guard is `Guard = { id, Config: z.object, run(ctx, event): Promise<GuardResult> }`. Runner calls guards sequentially with `next()` delegation — `error` short-circuits, `warning` annotates but delegates.
* **Initial guards (P0):** `phi-threshold` (`ruvector_consciousness::phi::auto_compute_phi`, `minPhi` from `iit-config.yaml`), `ces-fingerprint` (CES hash), `boundary-frontier` (`emergence::effective_information`), `attractor-ews`, `catastrophe-cusp` (pre-bifurcation warn at `distance<0.2`), `causal-emergence` (`emergence::causal_emergence`). Each guard's `src/invariant.ts` registers manifest and checks one event/data relation (per `dsh/packages/AGENTS.md`).
* **Config source:** `.dsh/iit-config.yaml` written by `cli init` (thresholds, `max_exact_size`, TPM var mapping). Validation via `schemastery`.

---

## 5. Watchtower, Receipts, Benchmark Monitoring, Audit Proofs

### 5.1 Watchtower + Receipts

* **Receipt shape** (extends Facility `core/receipts.ts`, DSH `session-telemetry`):
  ```ts
  interface Receipt {
    runId: RunId; sessionId: SessionId; agentId: string;
    prevHash: string; logHash: string; phiSnapshot:{phi:number; method:string; cesHash:string};
    outcome:'accepted'|'rejected'|'needs-human';
    cost:{tokens:TokenUsage; usd:number; budgets:BudgetState[]};
    guardDispositions:{guardId:string; disposition:'pass'|'block'|'warn'}[];
    builtAt:number; builder:{gitSha:string; crateVersions:Record<string,string>};
    hash:string; // SHA-256(canonical JSON without hash)
  }
  ```
  `prevHash = receipts[i-1].hash`, seeded `H("genesis"+orgId)`. Append-only table `receipts` (Facility `db/src/schema.ts` extension) + WORM object store.

* **Job:** `packages/enterprise/watchtower/src/job.ts` — hourly `node-cron`, `inject: ['sessions','audit','scheduler','objectStore']`, queries GitHub (PR merged? CI green?) → `receipt` → aggregates `acceptance_rate, one_shot_rate, avg_cost, recurring_failures`. Port from `facility/services/api` background job, but as Cordis service to stay in-process testable.

* **DB migration:** `packages/session/session-persistence-postgres/src/migrations/002_enterprise_receipts.sql` (at test-root `packages/session/session-persistence-postgres` — this package is **not** in `dsh/` so mutation is allowed). Reuse drizzle `pgTable` pattern from `facility/packages/db/src/schema.ts`.

### 5.2 Benchmark Monitoring — Full Stack

**Suites & contracts:**

| Suite | Measures | Command | Gate |
|-------|----------|---------|------|
| guards | builtin + iit guards pass rate | `pnpm --filter @deepseek-ai/dsh-enterprise-guards-iit test -- benchmark` | per-PR, fail if <99% guard `pass/block` correct |
| session-protocol | CHARTER/ACTIVE round-trip | `pnpm --filter @deepseek-ai/dsh-enterprise-session-protocol test` | per-PR |
| chains | S→D→T→V validation, WSJF | same | per-PR |
| gateway | virtual-key issue, `hardBudgetBlock` correctness | `gateway` bench | per-PR |
| watchtower | receipt hash-chain continuity | `watchtower` bench | per-PR |
| iit-guards | `calculate_phi` latency (exact≤15, spectral/meanField), cusp fit latency | `iit-core` `criterion` bench (`benches/phi_bench.rs`) | per-PR + nightly soak |
| terminal-bench / browsecomp | end-to-end agent | `test:e2e` + facility pilot-bench (nightly) | nightly (budget-capped) |

**Telemetry envelope (single row per run/step/phase):**
```ts
interface BenchmarkEnvelope { runId:SessionId; suite:string; benchId:string;
  startedAt:number; durationMs:number; outcome:RunPhaseOutcome;
  tokenUsage?:TokenUsage; costUsd?:number; modelRoute?:RequestContext;
  phi?:number; phiMethod?:string; cesHash?:string; cuspDistance?:number; ewsVariance?:number;
  phases?:{name:RunPhaseName; durationMs:number; outcome:RunPhaseOutcome; hash:string}[];
  artifactUrl?:string; receiptHash?:string; }
```
Producer: `sandbox-runner` PhaseRecorder + `core/session` `chunk-rows.ts` + `llm` adapter. Dual-write → Postgres `run_events` + object store (R2 with object lock for WORM). Grafana dashboards query Postgres; alerts on `cost>budget`, `phi<min`, `ews>threshold`.

### 5.3 Auditability — "Proofs of Agent"

Auditor with only `receipts` + public code can:
1. **Reconstruct** session from `SessionEvent` log (append-only, `seq` contiguous, `SESSION_FORMAT_VERSION` check).
2. **Verify integrity:** `receipt.logHash == SHA256(canonical log)` and `receipt.hash == SHA256(canonical receipt without hash)` and chain `prevHash` links.
3. **Recompute Φ/CES:** given `(TPM hash, state, PhiConfig)` stored in receipt `phiSnapshot`, recompute `calculate_phi` (deterministic, tolerance `1e-9` exact, `1e-3` approx) — `MIP` witness included so verifier can check minimality.
4. **Verify guard disposition:** `guardDispositions[]` must match policy thresholds at `builtAt` (`iit-config.yaml` versioned, hash in receipt `builder.crateVersions`).
5. **Verify cost:** `cost.tokens` cross-checked against `envelope-store` request/response captures (provider-reported; residual trust documented).
6. **Lineage:** every output links `Verification → Task → Decision → Signal` via chain events.

**Residual trust (disclosed in docs):** provider token accounting; TPM boolean abstraction (non-unique coarse-grain); `Tau`/`Geometric` approximations have no proven bound to exact Φ (per IIT literature) — receipts record `method` so approximation risk is explicit.

---

## 6. CLI / MCP / SDK / Docs

* **CLI `packages/enterprise/cli` (bin `dsh-enterprise`):** `init [--with iit-guards --without watchtower]` writes `.dsh.json{profile:"enterprise"}`, ` .dsh/iit-config.yaml`, GitHub workflows (`plan, build, review, ci-repair, security, watchtower`), managed blocks in `AGENTS.md`/`CLAUDE.md`/`STANDARD.md`, skills/guards install; `doctor --run-guards --github` validates workflows, guard signatures, GH App; `bootstrap --org --installation-id`; `guard run <id>`, `receipt verify <runId>` (recomputes chain + Φ). Ports `facility/packages/cli/src/init.mjs` (27 KB) as TS.
* **MCP `packages/enterprise/mcp`:** register `ctx.mcpEnterprise` on `mcp` seam (DSH has only `mcp-client`); re-export DSH tools + `chains/*, gateway.issueVirtualKey, watchtower.generateReceipt, iit.calculatePhi, guard.run`. Transport stdio + streamable HTTP.
* **SDK `packages/enterprise/sdk`:** `createEnterprise({profile}) -> {chains, gateway, watchtower, iit}` with branded IDs (`SessionId`, `RunId`).
* **Docs:** `docs/enterprise/SPEC.md` (parent) + `docs/enterprise/GUARDS.md`, `BENCHMARKING.md`, `AUDITABILITY.md` rendered via DSH `website` VitePress. Each enterprise leaf's `README.md` + `README.zh.md` document model/token/KV effects per `dsh/docs/cookbook/adding-a-package.md#4`.
* **Bundle `packages/enterprise/bundle-enterprise`:** `tsdown` patch-layer over `bundle/base` emitting enterprise `cordis.yml`.

---

## 7. Verification Plan (gated)

* **Type:** `pnpm run typecheck` (strict), `pnpm run lint` (clippy for Rust `pedantic`).
* **Unit:** `pnpm run test` per leaf (Vitest), `cargo test` for `iit-core` (incl. `proptest` from ruvector).
* **Coverage gate:** `pnpm run test:coverage` per-file 100% on `src/` (DSH policy).
* **Snapshot:** `pnpm run test:snapshot` — pins receipt JSON, guard disposition, Phi value verbatim.
* **Built smoke:** `tsdown` bundles + `verify-package-invariants` HMR disposal check per `dsh/packages/AGENTS.md`.
* **Dependency + clone verification (this plan's prerequisite):**
  ```bash
  git -C dsh log --oneline -1          # b150a551b8
  git -C facility log --oneline -1     # b150d96
  cat dsh-enterprise/pnpm-workspace.yaml # catalog.facilityHarness = github:theam/facility#b150d96, dshSession = 0.1.1-rc.2
  pnpm --filter "@deepseek-ai/dsh-enterprise-*" list --depth 0
  cargo tree --manifest-path dsh-enterprise/packages/iit-core/Cargo.toml --locked | grep ruvector
  npm pack --dry-run --filter @deepseek-ai/dsh-enterprise-chains | tar tz | grep -v "facility/packages/harness/src/chain.ts" # must not vendor
  scripts/verify-deps.sh               # replaces verify-no-upstream-mutation.sh
  ```
* **SBOM:** `pnpm --filter @deepseek-ai/dsh-enterprise-* exec cyclonedx-npm --output-file sbom.cyclonedx.json` + `cargo cyclonedx --format json` + `cosign verify-blob --signature pkg/*.wasm.sig pkg/*.wasm` — gate `cli doctor --sbom` fail on critical
* **`scripts/verify-deps.sh` (replaces `verify-no-upstream-mutation.sh`):**
  ```bash
  #!/bin/bash
  set -euo pipefail
  pnpm ls --depth 0 --filter "@deepseek-ai/dsh-enterprise-*" | grep -v "test/dsh"
  cargo tree --manifest-path dsh-enterprise/packages/iit-core/Cargo.toml --locked | grep -v "test/facility"
  npm pack --dry-run --filter @deepseek-ai/dsh-enterprise-chains | tar tz | grep -v "facility/packages/harness/src/chain.ts"
  cyclonedx-npm --output-file sbom.cyclonedx.json || echo "cyclonedx-npm not installed"
  cosign verify-blob --signature dsh-enterprise/packages/iit-core/pkg/*.wasm.sig dsh-enterprise/packages/iit-core/pkg/*.wasm || echo "cosign not enrolled"
  ```

---

## 8. Roadmap — Gated, Auditable

| Phase | Weeks | Exit criteria (must prove with artifact) |
|-------|-------|------------------------------------------|
| **0 — Chains + Guard Skeleton** | 1-2 | `packages/enterprise/chains` ports `chain.ts` (+validate); `SessionEventMap` extension lands; `guards-iit` phi-threshold guard passes `test:benchmark:chains` snapshot; `iit-core` WASM builds and `IITSystem::new(3).calculate_phi()` bench passes; `verify-no-upstream-mutation` green |
| **1 — Rust Core + First IIT Guards** | 3-5 | `iit-core` ships phi+partition+catastrophe+boundary+attractor; `guards-iit` adds ces-fingerprint, boundary-frontier, attractor-ews, cusp; `iit-core` `cargo test` + `criterion` bench; TypeScript `wasm-bindgen` import works in `guards-iit` vitest |
| **2 — Gateway + Runner + Watchtower** | 6-9 | `gateway` budgets/metering/envelopes wrap `ctx.llm` (bench: `hardBudgetBlock` correctness); `sandbox-runner` 9-phase `PhaseRecorder` + redaction; `watchtower` receipt chain + `receipt verify` recompute; `session-persistence-postgres` migration 002 |
| **0.5 — Regulated P0** | 2-3 | `auth` OIDC/RBAC + 4-eyes, `compliance-erasure` tombstone + `receipt verify` après erasure, `sovereignty` region enforce, `sbom` CycloneDX gate `failOnCritical` | `pnpm test --filter auth` + `receipt verify` post-erasure + `verify-deps.sh` + `sbom.cyclonedx.json` |
| **3 — Distribution** | 9-12 | `cli` `init` on fresh repo (container e2e), `mcp` stdio smoke, `sdk` types, bilingual docs, `bundle-enterprise`; `verify-package-invariants` per leaf |
| **4 — Benchmark & Compliance Hardening** | 12-16 | Nightly `terminal-bench`/`browsecomp` via watchtower (budget-capped), Grafana dashboards + alerts, load/perf, security review (covert channel via Phi drift), full audit export `receipts -> WORM` |
| **4.5 — Regulated P1** | 12-16 (parallèle Phase 4) | `resilience` PITR WAL + R2 cross-region replica + chaos `pod kill/partition`, `model-registry` Teloids `error` en prod, Helm air-gapped `values-airgapped.yaml`, `COMPLIANCE_MATRIX.md` | `chaos.spec` + `receipts-restore-*.json` + `sbom --fail-on-critical` + `helm template` air-gapped |

**After Phase 4 + 4.5:** "best in world" = every claim has a dashboard number + a hash-chained receipt + a recomputable CES/Phi proof **et** bankable (SoD, RPO 0, SBOM signé).

---

## 9. Risks & Non-Goals

* **Non-goal (P0):** Full `deep_causality` CSM integration — Teloids stay TS-only; `elara-active-inference` ships but `free-energy` guard gates at `warn` only.
* **Risk:** `iit` approximation (Geometric/Spectral) divergences from Exact — mitigated by recording `method` in receipt and pinning `max_exact_size=15` for guards on small subsystems.
* **Risk:** TPM boolean abstraction dispute — mitigated by documenting the `tpm.rs` mapping and hashing `tpmHash` in receipt.
* **Risk:** `deep_causality` WASM port may require `getrandom`/`Bazel` work — we avoid it in P0; Teloids stay TS-only.
* **Risk:** Root `test/` is not a git repo — enterprise packages must be developed as a new git repo (recommended: `git init` at `test/` or publish `packages/enterprise` as standalone workspace).

---

## 10. First PR Checklist (Phase 0.1)

- [ ] `packages/enterprise/iit-core/Cargo.toml` (`ruvector-consciousness 2.1 {phi,emergence,collapse,wasm}`, `elara-active-inference 0.1`, `deep_causality_core 0.11`), `src/lib.rs` re-exporting `ruvector_consciousness::*` + stubs `catastrophe.rs/attractor.rs/boundary.rs/workspace.rs`, `tpm.rs`, `wasm-pack build --features wasm`
- [ ] `packages/enterprise/chains/{package.json, tsconfig.json, src/{types.ts, index.ts, plugin.ts, validate.ts}, tests/}`
- [ ] `packages/enterprise/session-protocol/{…, src/types.ts declare module}`
- [ ] `packages/enterprise/guards-iit/{…, src/guard-runner.ts, src/guards/phi-threshold.ts}`
- [ ] `scripts/verify-no-upstream-mutation.sh`
- [ ] `docs/enterprise/SPEC.md` (this doc) + `IMPLEMENTATION_PLAN.md` updated

---

*Source for crate API: `/tmp/iit-0.1.0/src/{lib,phi,partition,concepts,causality,emd}.rs`. Source for chains: `facility/packages/harness/src/chain.ts`. Source for session: `dsh/packages/core/session/src/types.ts`. Verified via basemind index + direct file reads; no upstream file edited to produce this plan.*

