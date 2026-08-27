# DSH Enterprise — Best-In-World Agent Harness Platform

**Status: SPEC v0.1 — Full extensibility via Cordis, zero upstream mutation**
**Covers: CLI + MCP + SDK + Docs + Extensibility + Benchmark Monitoring + Auditable Proofs**
**Principle: Never touch `dsh/` or `facility/` source — everything is a Cordis plugin layered via `ctx.effect()`/`inject`.**

---

## Table of Contents

1. [Principles](#1-principles)
2. [Architecture — Cordis-Only Extension](#2-architecture)
3. [Crate Inventory — What Exists vs What We Build](#3-crate-inventory)
4. [IIT/ICT Advanced Guards — Full Spec](#4-iitict-advanced-guards)
5. [Benchmark Monitoring Framework](#5-benchmark-monitoring-framework)
6. [Auditability & Compliance Proofs](#6-auditability--compliance-proofs)
7. [Package Design — CLI / MCP / SDK / Docs / Extensibility](#7-package-design)
8. [Session Event Model — Extending DSH Without Mutation](#8-session-event-model)
9. [Security, Governance, Deployment](#9-security-governance-deployment)
10. [Testing, Benchmarks, Verification](#10-testing-benchmarks-verification)
11. [Phased Roadmap](#11-phased-roadmap)

---

## 1. Principles

| # | Rule | How enforced |
|---|------|--------------|
| P0 | **Zero upstream mutation** — no file in `dsh/` or `facility/` is edited | All new code lives in `packages/enterprise/**`; DSH seams are consumed via `ctx.get` / `inject`, never patched. Guarded by `scripts/verify-no-upstream-mutation` |
| P1 | **Everything is a plugin** | Each capability registers via `ctx.effect()` / `ctx.on()`; `ctx.effect` returns disposer → HMR-safe. Follows `dsh/packages/AGENTS.md` plugin-export rules |
| P2 | **Capability seams, not loop surgery** | New behavior plugs into `ctx.tools`, `ctx.sandbox`, `ctx.skills`, `ctx.llm`, `ctx.sessions`, plus new seams `ctx.chains`, `ctx.gateway`, `ctx.iit` — never modify `core/agent-loop` |
| P3 | **Profile composition** | `dsh-enterprise` profile = `baseProfile.extend({ plugins: [...] })`. Ship one cordis.yml; CLI writes `.dsh.json` pointing at it |
| P4 | **Merge-extensible event log** | New session events extend `SessionEventMap` by declaration merging (`declare module '@deepseek-ai/dsh-session'`). Existing log readers ignore `ignorable:true` unknowns; required events force version bump |
| P5 | **Typed + bilingual + tested** | `edition = "2024"`, `rust-version = "1.85"`, strict TS, README.md + README.zh.md per package, Vitest 100% file coverage on `src/` |
| P6 | **Best-in-world = verifiable** | No claim without a benchmark + a proof artifact (hash-chained receipt, CES snapshot, Phi trajectory). See §6 |

---

## 2. Architecture

### 2.1 Stack

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        CONSUMER FACING (TS)                              │
│  CLI (`dsh-enterprise init/doctor/bootstrap`)  │  MCP Server  │  SDK      │
│  Docs (VitePress)                          │  `ctx.iit` SSE │           │
├─────────────────────────────────────────────────────────────────────────┤
│                    CORDIS PLUGIN LAYER (TS)                              │
│  chainsPlugin │ gatewayPlugin │ guardRunnerPlugin │ skillGraduation    │
│  sandboxPhasesPlugin │ mcpServerPlugin │ iitGuardsPlugin │ watchtower  │
│  enterpriseProfile = baseProfile.extend({ plugins: [...] })              │
├─────────────────────────────────────────────────────────────────────────┤
│               RUST CORE — compiled to WASM (wasm-bindgen)               │
│  ruvector-consciousness (MIT: Φ exact/spectral/stochastic/greedy,         │
│    EI/determinism/degeneracy, causal emergence, collapse, SIMD+bump)     │
│  elara-active-inference (MIT/Apache-2: variational F+G, POMDP, std-only) │
│  deep_causality_core (MIT: Causaloids, CSM, Effect Ethos — Teloids)      │
│  custom: catastrophe (cusp/fold), attractor/EWS,                          │
│           boundary (frontier), workspace ignition (GWT)                   │
├─────────────────────────────────────────────────────────────────────────┤
│                    UPSTREAM — PEER DEPENDENCIES                           │
│  dsh/* (tools, session, sandbox, skill, llm, credentials, boot)          │
│  facility/* (harness/chain.ts, gateway/service, runner/phases, mcp)     │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Package placement — standalone repo, library-installed (no vendoring, no `test/packages` nesting)

Enterprise is **its own git repo** `dsh-enterprise/` (sibling to the reference clones `dsh/` and `facility/`), not `test/packages/enterprise`. The `test/` directory at `github.com/your-org/dsh-enterprise` **is not a workspace** (no `pnpm-workspace.yaml`, no `Cargo.toml` — verified `test/package.json` is `{ "devDependencies": {"shadcn": ...}}` only). The `dsh/` clone at `test/dsh` and `facility/` clone at `test/facility` are **reference checkouts for `basemind` and `git log` only** — they are not build inputs.

```
dsh-enterprise/                      # git: github:your-org/dsh-enterprise (new, private or public)
├── package.json                    # private umbrella, packageManager: pnpm@9, type: module
├── pnpm-workspace.yaml             # packages: ["packages/*", "packages/iit-core"], catalog: { facilityHarness: "github:theam/facility#b150d96", dshSession: "0.1.1-rc.2", cordis: "4.0.0-rc.7" }
├── Cargo.toml                      # cargo workspace members = ["packages/iit-core"], resolver 2, edition 2024, rust-version 1.85
├── pyproject.toml                  # python 3.9 pin: pyphi==1.2.0, numpy<2, ict @ file://IIT (uv, managed)
├── packages/
│   ├── iit-core/                   # Rust → WASM (cdylib+rlib), deps: ruvector 2.1 {phi,emergence,collapse,wasm} + elara 0.1 + deep_causality_core 0.11
│   ├── chains/                     # imports @facility/harness — no copy
│   ├── session-protocol/           # imports @deepseek-ai/dsh-session
│   ├── guards-iit/                 # wraps iit-core WASM + bridges ict/*.py via sidecar
│   ├── gateway/                    # reimplements Facility gateway pattern as a new service (services/gateway is not a publishable package)
│   ├── sandbox-runner/             # reimplements Facility runner phases as a new service
│   ├── watchtower/                 # receipts + outcome joining
│   ├── cli/                        # bin: dsh-enterprise
│   ├── mcp/                        # MCP server (re-exports DSH tools + guards)
│   └── sdk/                        # consumer SDK
└── services/
    └── ict-bridge/                 # FastAPI sidecar for ict/*.py (python:3.9-slim, uv sync --locked) — not per-call spawn
```

Every `packages/*/package.json` name is `@deepseek-ai/dsh-enterprise-<leaf>` and **declares real library dependencies** (see §3.1), not `file:` paths into `test/dsh` or copies of `facility` source. Installation is `pnpm install` (fetches `@deepseek-ai/dsh-*` from npm at `0.1.1-rc.2` + `@facility/*` from `github:theam/facility#b150d96` via `pnpm-lock.yaml` git SHA + integrity) and `cargo build` (`Cargo.lock` pins `ruvector 2.1`, `elara 0.1`). See `dsh-enterprise/pnpm-workspace.yaml` + `Cargo.toml` (scaffolded at `dsh-enterprise/`).

### 2.3 Why Rust core → WASM

* `ruvector-consciousness 2.1` MIT already implements **SOTA** `phi` (exact, spectral, stochastic, greedy) + `emergence` (EI/determinism/degeneracy/causal emergence) + `collapse` (quantum-inspired MIP `O(√N)`) with SIMD, bump arena, `getrandom/js` for `wasm32` — replaces `iit 0.1.0` + `~400 LOC` custom emergence.
* `elara-active-inference 0.1` MIT OR Apache-2.0 (pure `std`, zero deps) replaces `symthaea-fep 0.1.0` **AGPL-3.0**; pure-std POMDP `F`/`G` is sufficient for P0.
* `deep_causality_core 0.11` MIT gives `Causaloid`/`CSM`/`EffectEthos` — same as spec, but now all three are MIT/Apache, zero AGPL in enterprise core.
* WASM via `wasm-bindgen` + `wasm-pack`: single artifact runs in Node and browser, no native build, near-native speed.
* NAPI-RS fallback not needed; WASM hot-reloads with Cordis HMR (disposer removes WASM module).

---

## 3. Crate Inventory

### 3.1 Available, adopt directly — all MIT/Apache (no AGPL in enterprise core)

| Leaf | Crate / npm | License | What it gives | Integration |
|------|-------------|---------|---------------|-------------|
| **IIT + emergence** | `ruvector-consciousness = "2.1"` | **MIT** | `TransitionMatrix`, `auto_compute_phi(&tpm, &ComputeBudget::exact()) -> PhiResult{phi, algorithm}`, `effective_information`, `determinism`, `degeneracy`, `causal_emergence`, `collapse::QuantumCollapseEngine`, `simd`, `arena`, `phi::{exact,spectral,stochastic,greedy}`, features `phi, emergence, collapse, wasm, parallel, simd` + `getrandom/js` for `wasm32` | **Replaces `iit 0.1.0`**; `iit-core` calls `ruvector_consciousness::phi` + `emergence` directly. No custom `emergence.rs` needed |
| **FEP** | `elara-active-inference = "0.1"` | **MIT OR Apache-2.0** | `ActiveInferenceAgent` over discrete POMDPs: variational `F` + expected `G`, C-vector preferences (not reward), pure `std` zero deps, Elara Protocol extract | **Replaces `symthaea-fep` AGPL**; `iit-core` exposes `elara::step(observation) -> Action` |
| FEP (JS alt) | `active-inference` npm (Codevanger, TypeScript 100%) | MIT | Discrete POMDP, 3-step planning demo | TS fallback when WASM not wanted |
| Causality + deontic | `deep_causality_core = "0.11"` | **MIT** (LF AI & Data) | `Causaloid`, `Context`, `CSM`, `PropagatingEffect` | Guard runner: Teloids as TS data evaluated in `guards-iit`; promote to Rust CSM in Phase 2 |
| Causal discovery (TS) | `@kanaries/causal` | Apache-2 | PC, GES, DAG helpers | Consumer SDK: causal graph validation |
| LLM inference (Rust) | `candle` / `burn` | Apache-2/MIT | Tank for SAE/projector if we keep inference in Rust | Future: SAE projection without Python |
| Guard primitives | `@facility` harness via `import { detect } from '@facility/harness'` (if exported) else port `facility/packages/core/src/detect.ts` as TS guard — **do not copy** without an issue on `theam/facility` | same as facility | Markdown-link lint, permission checks | `guards-iit` re-exports or thin wrap |
| IIT alt (rejected) | `iit = "0.1"` | MIT | `IITSystem`, 5 methods — minimal vs `ruvector` | Not used — superseded by `ruvector-consciousness` |

> **AGPL crates NOT used:** `symthaea-fep 0.1.0`, `symthaea-consciousness-equation 0.1.0` — both `AGPL-3.0-or-later` (viral). Listed here only to document avoidance.

#### Dependency manifest (library installation)

**`dsh-enterprise/packages/chains/package.json` (example — all enterprise leaves follow this pattern):**

```json
{
  "name": "@deepseek-ai/dsh-enterprise-chains",
  "version": "0.1.0",
  "type": "module",
  "dependencies": {
    "@facility/harness": "github:theam/facility#b150d96",
    "@deepseek-ai/dsh-session": "0.1.1-rc.2",
    "@deepseek-ai/cordis": "4.0.0-rc.7",
    "@deepseek-ai/schemastery": "3.18.0"
  },
  "peerDependencies": { "@deepseek-ai/cordis": "*" },
  "devDependencies": { "vitest": "^3", "tsdown": "^0.1" }
}
```

**`dsh-enterprise/Cargo.toml` (workspace root, excerpt):**

```toml
[workspace.dependencies]
ruvector-consciousness = { version = "2.1", features = ["phi", "emergence", "collapse", "wasm"] }
elara-active-inference = "0.1"
deep_causality_core = { version = "0.11", default-features = false, features = ["std"] }
```

**`dsh-enterprise/pyproject.toml` (uv, excerpt):**

```toml
[project]
requires-python = "==3.9.*"
dependencies = ["numpy<2", "pyphi==1.2.0"]
# ict is not a published package — bridged via PYTHONPATH=IIT/ICT-Series (file:../IIT) or sidecar services/ict-bridge
```

Gates `scripts/verify-deps.sh`:

```bash
pnpm ls --depth 0 --filter "@deepseek-ai/dsh-enterprise-*"
cargo tree --manifest-path packages/iit-core/Cargo.toml --locked | grep -v "dsh-enterprise"
npm pack --dry-run --filter @deepseek-ai/dsh-enterprise-chains | tar tz | grep -v "facility/packages/harness/src/chain.ts"
```

`services/gateway` and `runner` are **not publishable packages** in Facility (they are `services/*` and `runner`, not `packages/*`). Until `theam/facility` publishes `services/gateway` as `@facility/gateway-core`, the enterprise `gateway` and `sandbox-runner` are **service reimplementations** (not library imports) — document the divergence and track upstream `facility/services/gateway/src/budgets.ts` via `facility@b150d96` SHA.

### 3.2 Must build — and what is already measured in `IIT/ICT-Series/ict/` (50 modules, `~22.7k LOC`, `wc -l` verified)

> **Strategy: P0 = Python bridge, Rust ports incremental.** The 50 `ict/*.py` modules are **measured, Gates-truthy** (ICT-8/10/14/18/22-24) and only `causal_emergence` + `tpm_estimation` touch `pyphi==1.2.0` (Python ≤3.9, NumPy<2 per `IIT/ICT-Series/pyproject.toml:10`). Bridging is `Node → python3.9 subprocess` with `PYTHONPATH=IIT/ICT-Series` (`pip install -e .`); Rust ports replace the bridge per-module when latency matters. All `ict/` is MIT (same repo). `wc -l` total `~22.7k` — guard-relevant modules are `126–677 LOC` (verified).

| Module | `ict/*.py` LOC / head | Rust MIT alternative | Port path |
|--------|--------|--------|------|
| `catastrophe` (`V=x⁴/4+a x²/2+bx`, `4a³+27b²=0`, `dx/dt=-(x³+ax+b)`) | `catastrophe.py` 16 KB (`from __future__ import annotations; import numpy as np`) | **None** — port `catastrophe.py` | `~250 Rust` — `nalgebra` roots, pure `fn CuspFit::from_trajectory`. Bridge OK for P0 |
| `early_warning` (variance↑, AR1↑, Wissel 1984/Scheffer 2009, `sliding_window_view`) | `early_warning.py` 192 LOC `import numpy as np; from numpy.lib.stride_tricks import sliding_window_view` | **None** | `~300 Rust` rolling variance/AR1 (`ndarray` + `sliding_window`). Bridge OK for P0 |
| `causal_emergence` (Hoel 2013/2017/2025; EI, determinism, degeneracy) | `causal_emergence.py` 16 KB | **`ruvector-consciousness::emergence` MIT** `effective_information` `EI=(1/n)Σ D_KL(row‖uniform)` (`src/emergence.rs:30` verified) | **Drop custom `emergence.rs`** — call `ruvector::emergence` directly |
| `tpm_estimation` (`tpm_from_transitions/trajectory/trajectories`, `unseen=self/uniform`) | `tpm_estimation.py` 156 LOC, pyphi dep | **None** — port `tpm_estimation.py` + `ruvector::TransitionMatrix::new(n, data)` | `~100 Rust` `tpm.rs` `session_window_to_tpm` — bridge `tpm_from_trajectory` pyphi-free for P0 |
| `free_energy` (`F_t=½[(o-p̂)²/σ²+ln(2πσ²)] = accuracy+complexity`, Gate 1 monotone MSE at fixed σ²) | `free_energy.py` 20 KB (ICT-14 Gates 1-3, créneau regime) | `elara-active-inference` MIT (discrete `F=E_q[ln q/p]`) — **different form** | **Both**: bridge `free_energy.py` for ICT-14 faithfulness; `elara` for discrete POMDP guards |
| `workspace` (GWT fan-out, Gates 22-23 `T=128`, S4 SAE `.npz`) | `workspace.py` 677 LOC `numpy` only, no pyphi | **None** | `~250 Rust` ignition gate or bridge `workspace.py` |
| `bistable` (`GrazingModel dx/dt=rx(1-x/K)-c x²/(x²+h²)`) | `bistable.py` 153 LOC | **None** — pure ODE | `~150 Rust` if needed |
| `signaling_convention` / `collective_adoption` / `symbol_invention` / `concept_inoculation` / `inhibited_invention` (exps A-E strate 7) | `5× 286–563 LOC`, numpy | **None** | Bridge as needed; not P0 |
| `sae_traces` (S4 `.npz` L0, inter-jeux variance, `panel (T,K)`) | `sae_traces.py` ~300 LOC | `elara`/`candle` not needed — traces **precomputed** | Bridge `sae_traces.py` `load_s4()` off-line |
| `reversibility_budget` / `time_arrow` (Gate 1 detailed balance S1-S4) | `310+454 LOC` | **None** | Bridge only when Gates needed |
| `epsilon_machine` / `mdl` / `compression` | `567/231/159 LOC` | **None** | Not P0 guards |

Total custom Rust for P0 guards: **~1.0k LOC** (catastrophe + attractor + boundary + workspace + TPM) — emergence deleted, rest bridge-first.

---

## 4. IIT/ICT Advanced Guards

### 4.1 Guard taxonomy (every guard is a Cordis plugin with `Config` zod schema)

| Guard ID | Inputs | Computation (Rust core) | Config (thresholds) | Severity |
|----------|--------|--------------------------|---------------------|----------|
| `phi-threshold` | subsystem TPM + state | `ruvector_consciousness::phi::auto_compute_phi(&tpm, &ComputeBudget::exact())` (exact→spectral/stochastic auto) | `minPhi`, `method` | error |
| `phi-trajectory` | session turn sequence | rolling Φ(t) via `ruvector` `auto_compute_phi`; detect drift, slope, variance | `window`, `maxDrop`, `maxSlope` | warning→error |
| `ces-fingerprint` | subsystem | `CauseEffectStructure` (`ruvector::ces` / `iit` concepts); hash it; compare to deployment fingerprint | `expectedHash` (locked at `init`) | error |
| `mip-shift` | subsystem | `MIP` partition identity (`PhiResult.algorithm` + `Bipartition`) | `allowedMIPs` | warning |
| `boundary-frontier` | substrate | enumerate frontiers via `ruvector::phi::BipartitionIter` + `emergence::effective_information` → max-Φ frontier; compare runtime frontier | `minBoundaryPhi` | error |
| `catastrophe-cusp` | scalar trajectory (risk, cost, alignment) | Fit cusp potential, dist-to-bifurcation, hysteresis flag (custom `catastrophe.rs`) | `maxRisk`, `bifurcationMargin` | error (pre-bifurcation warning at 0.2) |
| `attractor-ews` | state trajectory | variance, ac(1), spectral radius (custom `attractor.rs`, heuristics from `ICT-8`) | `varianceLimit`, `acLimit` | warning |
| `workspace-ignition` | cross-module broadcast score | ignition gate (threshold + fan-out, custom `workspace.rs`, `ICT-24`) | `maxIgnition`, `sensitiveScopes` | error |
| `free-energy` | agent predictions vs observations | `elara_active_inference` variational `F` / expected `G` (`elara::Agent::step`) | `maxSurprise` | warning |
| `causal-emergence` | micro/macro TPM | `ruvector_consciousness::emergence::{effective_information, causal_emergence}` `CE = EI_macro - EI_micro` | `maxCE` (flag unexpected emergence) | warning |
| `effect-ethos` | every `sandbox.run` | `deep_causality_core` `EffectEthos.evaluate(Teloid[])` before execution | `teloids[]` (immutable norms) | error (hard block) |
| `signaling-convention` | inter-agent messages | schema validation, entropy, covert-channel score | `allowedSchemas`, `maxEntropy` | error |

Severity maps to waterfall disposition: `error` short-circuits the guarded operation (tool call, step, sandbox exec); `warning` emits `audit/event` but allows proceed with annotation.

### 4.2 How guards run

```
model/skill requests tool X
        │
        ▼
ctx.tools.guard waterfall (Cordis waterfall — each listener MUST call next() to delegate)
        │  dsh builtins (repeat-tool-reminder, timeout-policy)
        ├──▶ guards-iit/preflight  (phi-threshold, ces-fingerprint, boundary)
        │         │ on failure → throw GuardError (step ends, turn reason = blocked)
        │         ▼ on pass → next()
        └──▶ sandboxed tool execution
                │
                ▼
        sandbox-runner phases (bootstrap→...→delivery) — each phase bracket
        records: {phase, durationMs, outcome, phi_snapshot, receipt_hash}
```

Guard runner lives in `packages/enterprise/guards-iit/src/guard-runner.ts`; it injects `['tools','sessions','audit','chains','iit']` and wraps the waterfall (no patching, pure decoration).

### 4.3 IIT/ICT ↔ DSH wiring (no upstream edit)

* **TPM source**: `packages/enterprise/iit-core/src/tpm.rs` `session_window_to_tpm(window: &[SessionEvent], n_vars: usize) -> (TransitionMatrix, state)` — maps `n_vars=4..8` booleans `[tool_success, approval_granted, skill_loaded...]` to `ruvector_consciousness::types::TransitionMatrix` (dense row-stochastic). Build `TransitionMatrix::new(n, data)` then `auto_compute_phi(&tpm, &ComputeBudget::exact())`.
* **State**: current `SessionId` state vector is the live `SessionEvent` window (last `K=64` steps).
* **CSM → Session**: `deep_causality::CausalStateMachine` transitions emit `SessionEvent` (ignorable:true diagnostic) so replay reconstructs audit.
* **Teloids**: defined in `packages/enterprise/iit-core/teloids/` as data (YAML) → compiled to `deep_causality_ethos::Teloid` at startup. Immutable after `init`.

---

## 5. Benchmark Monitoring Framework

### 5.1 What we benchmark (Facility + DSH alignment)

| Suite | What it measures | Harness | Frequency |
|-------|------------------|---------|-----------|
| `guards` | builtin guards + graduation pass rate | `pnpm test:benchmark:guards` | per-PR |
| `session-protocol` | CHARTER/ACTIVE round-trip fidelity | same | per-PR |
| `chains` | S→D→T→V validation | same | per-PR |
| `browsecomp` | web/private retrieval (target ≥65%) | Facility `pilot-bench` | nightly |
| `terminal-bench` | tool-use + long-horizon | DSH `test:snapshot` + `test:e2e` | nightly |
| `two-lane` | repo vs platform lane parity | `enterprise/lanes` bench | nightly |
| `gateway` | virtual-key issue, budget enforce, envelope capture | `enterprise/gateway` bench | per-PR |
| `watchtower` | outcome joining, receipt hash-chain | same | per-PR |
| `iit-guards` | phi latency, cusp fit latency, EWS latency | `iit-core` bench (criterion) | per-PR + nightly soak |
| `sandbox-phases` | phase durations, redaction coverage | `sandbox-runner` bench | per-PR |
| `cli-installer` | `init/doctor/bootstrap` on fresh repo (container) | `enterprise/cli` bench | per-PR |

Every suite emits the **same telemetry envelope** (see 5.2), stored in Postgres + object store, hashed into receipts.

### 5.2 Telemetry envelope (one row per run/step/phase)

```ts
interface BenchmarkEnvelope {
  runId: RunId; sessionId: SessionId; suite: string; benchId: string;
  startedAt: number; durationMs: number; outcome: 'succeeded'|'failed'|'skipped'|'canceled';
  // DSH ills
  tokenUsage?: TokenUsage; costUsd?: number; modelRoute?: RequestContext;
  // IIT/ICT
  phi?: number; phiMethod?: string; cesHash?: string; cuspDistance?: number; ewsVariance?: number;
  // Phases (sandbox-runner)
  phases?: { name: RunPhaseName; durationMs: number; outcome: RunPhaseOutcome; hash: string }[];
  // Artifact
  artifactUrl?: string; // object-store URL (envelope capture, stdout, snapshots)
  receiptHash?: string; // see §6
}
```

Producer: `sandbox-runner` PhaseRecorder + `core/session` chunk rows + `llm` adapter. Consumers: Postgres (`run_events`), object store (envelopes), Prom/Grafana (TS series), and compliance export.

### 5.3 Full observability stack

```
agent turn/step/tool → SessionEvent log (append-only)
        ↓ (tap)
sandbox PhaseRecorder + iit guard snapshots
        ↓
EnvelopeStore (Facility pattern: facility/services/gateway/src/envelope-store.ts)
        ↓  dual-write
┌──────────────────────┬──────────────────────┐
│ Postgres (facility)   │ Object store (S3/R2) │
│ run_events, budgets,  │ request/response     │
│ envelopes, receipts   │ payloads, traces     │
└──────────────┬───────┴──────────┬───────────┘
               │                  │
         Grafana dashboards  Watchtower job (hourly: join GitHub PR/CI/human-approval → outcome)
               │                  │
         Alerts (cost/budget, phi-drop, EWS)   Receipts table (hash-chained, see §6)
```

* **Watchtower** (Facility `services/api` background job) is ported as `packages/enterprise/watchtower/src/job.ts` — hourly cron: for each completed run without `outcome`, query GitHub API (PR merged?, CI green?, human approved?) → `receipt` → aggregate `acceptance_rate`, `one_shot_rate`, `avg_cost`, `recurring_failures`.

* **Budget enforcement** (Facility `budgets.ts`) runs inline in `gateway` on every `llm` call: `applicableBudgets → hardBudgetBlock → reserveHardBudgets → adjustBudgetReservations` — counters in `spendCounters(budget_id, window_start)`.

### 5.4 Where monitoring lives (no upstream touch)

* `packages/enterprise/watchtower` — new Cordis service, injects `['sessions','audit','scheduler','objectStore']`.
* `packages/enterprise/gateway` — wraps `ctx.llm` (decorator pattern) so every LLM call is metered without editing `llm/`.
* Telemetry UI: small `packages/enterprise/telemetry-ui` (Client plugin) that renders receipts + Phi trajectories in DSH host web app via `ctx.get('telemetry-ui')` — optional.

---

## 6. Auditability & Compliance Proofs

### 6.1 What "auditable" means

A third-party auditor with **only the receipts + public code** must be able to:
1. **Reconstruct** any session deterministically from its event log (DSH guarantee: `SessionEvent` sequential, lossless JSON).
2. **Verify** no event was inserted/dropped/reordered (hash chain).
3. **Verify** Phi/CES/cusp values were computed by the claimed code at the claimed time (attested build + deterministic calc).
4. **Verify** guard outcomes (allowed vs blocked) match policy at that time.
5. **Verify** cost/budget accounting matches LLM provider invoices (envelope capture).

### 6.2 Hash-chained receipts (Facility `core/receipts.ts` pattern, extended)

Each completed run emits `Receipt`:

```ts
interface Receipt {
  runId: RunId; sessionId: SessionId; agentId: string;
  prevHash: string;            // hash of previous receipt (chain)
  logHash: string;              // hash of full SessionEvent log (SHA-256 of canonical JSON)
  phiSnapshot: { phi: number; method: string; cesHash: string };
  outcome: 'accepted'|'rejected'|'needs-human'; // from Watchtower
  cost: { tokens: TokenUsage; usd: number; budgets: BudgetState[] };
  guardDispositions: { guardId: string; disposition: 'pass'|'block'|'warn'; cesHash?: string }[];
  builtAt: number; builder: { gitSha: string; crateVersions: Record<string,string> };
  hash: string;                 // SHA-256 of canonical serialization of above (without this field)
}
```

* Chain: `receipts[i].prevHash = receipts[i-1].hash`, seeded by `H("genesis" + orgId)`.
* Stored in `facility/packages/db` `receipts` table (or DSH `session-persistence-postgres` extended), indexed by `runId`.
* Published to object store; Watchtower derives `receipts` deterministically — any node replaying the log derives identical chain.

### 6.3 Deterministic Φ/CES proofs

* **Build attestation**: `iit-core` WASM built in CI with `cargo build --locked`, `gitSha` embedded in receipt `builder`.
* **Deterministic calc**: given `(TPM, state, PhiConfig)` → `PhiResult` is pure; receipt stores `(tpmHash, cesHash, phi)`. Auditor recomputes and compares equality (within floating tolerance).
* **MIP witness**: `PhiResult` includes `mip: Partition` so auditor can verify it indeed minimizes Φ (check all partitions for small N, or verify approximation bound).
* **CES non-repudiation**: CES is serialized canonical JSON → `cesHash`. Guard `ces-fingerprint` locks expected hash at `init`.

### 6.4 Session log integrity

* `dsh/packages/core/session` already guarantees **append-only**, monotonic `seq`, `time`, `SESSION_FORMAT_VERSION`, and `ignorable` discipline.
* New enterprise events set `ignorable:true` when purely informational (Phi snapshots), so old readers skip them. Required chain events set `ignorable` absent → old runtime **refuses** the log (correct: it would reconstruct wrong).
* Persistence backends: `session-persistence-postgres` stores `session_events` + `receipts` atomically via `coordinator.ts` transaction — either both or neither.

### 6.5 Compliance mapping (example)

| Regulation need | How we satisfy |
|-----------------|----------------|
| **Traceability** (who did what, when) | SessionEvent log + Receipts chain + `RequestContext.provider/model` per turn |
| **Explainability** | CES snapshot per turn + guard disposition trace + SAE projector (optional) |
| **Cost control** | Budget defs (`budgets` table) + hard blocks + spend counters per window; receipt carries `budgets[]` |
| **Data lineage** | Artifact chains `S→D→T→V`: Signal Decision Task Verification — every output links to decision → signal |
| **Non-repudiation** | Hash chain anchored at genesis; any tamper breaks chain — verifiable without trust |
| **Retention / WORM** | Store receipts + envelopes in WORM object store (R2 with object lock) + Postgres `receipts` as append-only |

### 6.6 What remains trust-assumed (documented residual)

* LLM provider token accounting (`TokenUsage`) is provider-reported; we can only cross-check with envelope capture, not prove.
* Coarse-graining / TPM derivation heuristic (boolean abstraction of session state) is not unique — doc must state the mapping so auditor can reproduce.

---

## 7. Package Design

### 7.1 Naming, layout, contracts (follows `dsh/packages/AGENTS.md`)

Every enterprise leaf:

* `package.json`: `name: @deepseek-ai/dsh-enterprise-<leaf>`, `type: module`, `peerDependencies: { "@deepseek-ai/cordis": "*" }`
* `src/types.ts`: types only
* `src/index.ts`: either default-export service class OR named-export function plugin `{name, inject, Config, apply}`
* `tests/` at package level, Vitest + snapshot, keyless `test:snapshot` for model-visible transcripts
* `tsconfig.json`: extends `tsconfig.base.json`, `rootDir: src`, `outDir: lib/types`, references workspace deps + `runtime-diagnostics/invariants`
* Bilingual README (`README.md` + `README.zh.md`) with Known Limitations

### 7.2 CLI (`packages/enterprise/cli`)

```
dsh-enterprise init [--with iit-guards --without watchtower]
  - detects pnpm, default branch, checks
  - writes .dsh.json { profile: "enterprise" }
  - generates .github/workflows: plan, build, review, ci-repair, security, watchtower
  - writes managed blocks to AGENTS.md / CLAUDE.md / STANDARD.md
  - installs skills/guards/iit-config.yaml

dsh-enterprise doctor [--run-guards --github]
  - validates workflows, guards, GitHub App config, budgets, receipts chain

dsh-enterprise bootstrap --org-name --github-installation-id ...
  - binds instance to GitHub org + App (Facility pattern)

dsh-enterprise guard run <id> [--agent <id>]
  - manual guard invocation (debugging, offline audit)

dsh-enterprise receipt verify <runId>
  - recomputes chain and Φ/CES proof locally
```

Implementation: **ports `facility/packages/cli/src/init.mjs`** but as TypeScript; never shells out to facility.

### 7.3 MCP (`packages/enterprise/mcp`)

* Server: based on `facility/packages/mcp` (both MCP server + client facets) but registered as Cordis service `ctx.mcpEnterprise`.
* Tools exposed = DSH tools + new: `chains/*`, `gateway.issueVirtualKey`, `watchtower.generateReceipt`, `iit.calculatePhi`, `guard.run`.
* Transport: stdio (default) + streamable HTTP for daemon (mirrors `basemind` MCP pattern).

### 7.4 SDK (`packages/enterprise/sdk`)

```ts
import { createEnterprise } from '@deepseek-ai/dsh-enterprise-sdk';

const ent = await createEnterprise({ profile: 'enterprise' });
const signal = await ent.chains.createSignal({ source, evidence_refs });
await ent.gateway.issueVirtualKey({ projectId, scopes, ttl, budgetUsd });
const receipt = await ent.watchtower.generateReceipt(runId);
```

All branded IDs (`RunId`, `ProjectId`, `SkillId`) via `dsh-brand`.

### 7.5 Docs & distribution

* `docs/enterprise/` renders via DSH website VitePress (same pipeline as `dsh/website`).
* One binary bundle: `bundle/enterprise` patch-layer over `bundle/base` — includes enterprise profile cordis.yml.
* Publish: npm `@deepseek-ai/dsh-enterprise-*` + single `dsh-enterprise` CLI bin.

### 7.6 Extensibility (third-party plugins)

Consumers extend by writing their own Cordis plugins against published seams:

```ts
// consumer/packages/my-guard/src/index.ts
export const name = 'my-org:custom-guard';
export const inject = ['iit','chains'] as const;
export function apply(ctx, { iit, chains }) {
  ctx.effect('myGuard', () => ({
    async run(signal) { /* use iit.calculatePhi, chains.validate */ }
  }));
}
```

They compose via their own `cordis.yml` that extends `enterprise` profile — no fork.

---

## 8. Session Event Model

### 8.1 Extending without mutation

```ts
// packages/enterprise/chains/src/types.ts
declare module '@deepseek-ai/dsh-session' {
  interface SessionEventMap {
    'chain/signal':   { chainId: string; signal: Signal };
    'chain/decision': { chainId: string; decision: Decision };
    'chain/task':     { chainId: string; task: Task };
    'chain/verification': { chainId: string; verification: Verification };
    'iit/coherence':  { phi: number; cesHash: string; mip: Partition; ignorable: true };
    'iit/cusp':       { distanceToBifurcation: number; ignorable: true };
  }
}
```

* Chain events are **required** (no `ignorable`) — they shape reconstruction.
* IIT diagnostics are **ignorable:true** — old readers can safely skip; loss doesn't affect correctness.

### 8.2 No format bump needed initially

`SESSION_FORMAT_VERSION` stays `0` until a structural envelope change is needed. Adding ordinary event types is covered by `ignorable` discipline per `dsh/packages/core/session/src/types.ts:338`.

---

## 9. Security, Governance, Deployment

* **Secrets**: Facility gateway `provider-auth.ts` patterns (WIF OIDC, Bedrock assume-role, Vertex WIP) ported to `enterprise/gateway/src/provider-auth.ts`; virtual keys are short-TTL, auto-revoked, project/run/agent scoped — stored in `virtual_keys` + `budgets`.
* **Sandbox**: reuse `dsh/packages/sandbox/sandbox-local` profiles (bwrap, landlock, seatbelt) — PhaseRecorder wraps them, secret redaction at event boundary (facility `runner` pattern).
* **Permissions**: Facility `core/permissions.ts` ported as `enterprise/permissions` — markdown link lint, actions pinned, KB integrity.
* **Two-lane**: `enterprise/lanes` implements repo lane (vendored workflows, repo creds) vs platform lane (DSH sandbox, gateway creds) as `LaneConfig` — toggled by `dsh-enterprise` flag, not by editing dsh.

### 9.1 Identity, RBAC & 4-eyes (P0 — ACPR/DORA SoD)

* **Package** `packages/enterprise/auth` — `inject: ['sessions','tools']`, `Config: { provider: 'oidc'|'saml', issuer: string, clientId: string, jwksUrl: string, roles: ['trader','risk','it','audit','org:admin'] }`
* `ctx.auth.validateToken(jwt) -> Principal{userId, orgId, roles}` via `jose` JWKS; `checkPermission(principal, resource, action)` avant `chain/decision`, `iit-config` write, `sandbox.run`.
* **4-eyes**: `approval-workflow` threshold 2 sur `effect-ethos` Teloid edit et `iit-config` bump `minPhi`. Waterfall: `auth guard → iit guard → next()` — `error` bloque, `warning` annote.
* Mapping AD/LDAP → `Role` via `schemastery` enum, SoD: `trader` ne peut `approve` son propre `signal` (`checkPermission` retourne false si `resource.owner === principal.userId`).

### 9.2 Sovereignty & Air-Gapped (P0 — data residency)

* Install lib: `pnpm add @facility/harness@github:theam/facility#b150d96` mirror privé `verdaccio` pour air-gapped, `Cargo.lock` + `pnpm-lock.yaml` SHA pin, `scripts/verify-deps.sh` gate.
* `gateway` region enforce: `config.allowedRegions: ['eu-west-1']` checked in `gateway` plugin before `llm.generate` et `envelope-store` before R2 put — reject `us-east-1` avec `GuardError`.
* Helm `values-airgapped.yaml`: `imageRegistry: registry.bank.internal`, `pg.host: postgres.internal`, `r2.endpoint: s3.internal`, `imagePullSecrets: [regcred]`.

### 9.3 GDPR Erasure — tombstone sans casser la hash-chain (P0)

* Event `erasure/tombstone: { targetEventSeq: number, redactedHash: string, reason: string, requestedBy: UserId, ignorable: false }` — required, old readers refusent sans handler.
* Sur `erasure/tombstone`, `Receipt.logHash` recomputé sur log canonique où payload cible remplacé par `HMAC_SHA256(redactedHash)`; `prevHash` chain inchangée; `watchtower` vérifie preuve tombstone.
* **Conflit WORM vs GDPR résolu**: WORM retient tombstone, pas PII brute. Documenté dans `COMPLIANCE_MATRIX.md`.

### 9.4 DORA Resilience (P1)

* RTO 4h / RPO 0 pour `receipts` + `run_events` via PG PITR WAL + R2 cross-region replica. Test restore trimestriel artifact `receipts-restore-YYYY-MM-DD.json` hash-chainé.
* Chaos bench `packages/enterprise/resilience/tests/chaos.spec.ts`: pod kill, network partition → `BenchmarkEnvelope` doit encore émettre `outcome` via retry.

### 9.5 AI Act Model Registry (P1)

* `packages/enterprise/model-registry` store `ModelVersion{modelId, trainingDataHash, metrics, approvalBy}`; chaque `llm.generate` envelope lie `modelId`.
* Teloids compilés en `deep_causality_core::Causaloid` et guard `effect-ethos` passe `error` en prod (était `warn` P0).

### 9.6 SBOM & SLSA (P0)

* `pnpm cyclonedx` + `cargo cyclonedx` émettent `sbom.cyclonedx.json` par package, `failOnCritical` gate dans `cli doctor --sbom`.
* WASM `iit-core` built `cargo build --locked` + Cosign `cosign sign-blob pkg/*.wasm` + SLSA provenance `builder.gitSha` dans `Receipt`.

---

## 10. Testing, Benchmarks, Verification

### 10.1 Gates that ship with enterprise

Every enterprise leaf must pass `pnpm run test:coverage` (per-file 100% on `src/`) plus these new suite entries:

```
pnpm test:benchmark:guards | session-protocol | chains | gateway | watchtower | iit-guards
```

Each benchmark is a **Vitest snapshot + assertion**, not just a number: the snapshot pins the receipt JSON, the guard disposition, and the Phi value.

### 10.2 Load / soak

* `vitest.web.perf.config.ts` profile added for enterprise.
* Nightly `terminal-bench` + `browsecomp` run via watchtower against platform lane (budgets capped).

### 10.3 Invariants (follows `dsh/packages/AGENTS.md` §package invariants)

Each enterprise package writes `src/invariant.ts` registering its manifest and checking one event/data relation — e.g., `iit-core` asserts `PhiResult.mip` indeed yields minimal Φ for N≤8.

---

## 11. Phased Roadmap

| Phase | weeks | Deliverables (verifiable) | Proof artifact |
|-------|-------|----------------------------|----------------|
| **0 — Foundation** | 1-3 | `iit-core` (Rust→WASM, cusp+EI+attractor), `chains` (port facility/harness/chain.ts), `SessionEventMap` extension, `guards-iit/guard-runner` (repeat-tool-reminder + timeout-policy still pass) | WASM bundle + `test:benchmark:chains` snapshot |
| **1 — Governance** | 3-6 | `gateway` (budgets/auth/metering/envelopes), `session-protocol` (CHARTER/ACTIVE), `skill/graduation`, `effect-ethos` Teloids | `test:benchmark:gateway` (virtual-key issue, budget hard-block) |
| **2 — Execution & outcomes** | 6-9 | `sandbox-runner` PhaseRecorder (9 phases) + redaction, `watchtower` + `receipts` hash chain, `telemetry-ui` | Receipt chain verifiable via `dsh-enterprise receipt verify` |
| **3 — Distribution** | 9-12 | `cli` (`init`/`doctor`/`bootstrap`) + workflows, `mcp` server, `sdk`, bilingual docs, `bundle/enterprise` | Fresh-repo `init` e2e + `mcp` stdio smoke |
| **0.5 — Regulated P0** | 2-3 | `auth` OIDC + RBAC 4-eyes, `compliance-erasure` tombstone, `sovereignty` region enforce, `sbom` CycloneDX gate | `pnpm test --filter auth` + `receipt verify` après erasure + `verify-deps.sh` |
| **4 — Hardening** | 12-16 | BrowseComp/Terminal-bench nightly, post-training pipeline hook, load/perf, security audit (threat: covert channel, prompt injection via Phi drift) | Benchmark dashboard + audit report (CES/receipt export) |
| **4.5 — Regulated P1** | 12-16 (parallèle Phase 4) | `resilience` PITR + chaos, `model-registry` Teloids error, Helm air-gapped, COMPLIANCE_MATRIX | `chaos.spec` + `dr-restore` artifact + `sbom --fail-on-critical` |

**"Best in world" is earned at Phase 4 + 4.5**: by then every claim is a dashboard number + a hash-chained receipt + a recomputable CES/Phi proof **et** bankable (SoD, RPO 0, SBOM signé).

---

## 12. Immediate Next Step (if you approve)

Scaffold `packages/enterprise/iit-core` (Cargo crate, WASM `--features wasm`, `ruvector-consciousness 2.1`+`elara-active-inference`+`deep_causality_core` deps, `tpm.rs`+`catastrophe`/`attractor`/`boundary`/`workspace` stubs) and `packages/enterprise/chains` (TS plugin porting `facility/packages/harness/src/chain.ts`) — the Phase 0 spine. No dsh/facility file is touched. Zero AGPL.

---

*End of SPEC v0.1 — lives at `docs/enterprise/SPEC.md`. Sub-specs (`GUARDS_SPEC.md`, `BENCHMARK_MONITORING_SPEC.md`, `AUDITABILITY_SPEC.md`) should be split out as each section's implementation lands.*

