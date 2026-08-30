# DSH Enterprise — Detailed Implementation Plan (Full Thickness)

**Version:** 1.0 — 2026-08-27  
**Grounding:** `dsh@b150a551b8` / `facility@b150d96` / `ruvector-consciousness@2.1.0 MIT` + `elara-active-inference@0.1 MIT` + `deep_causality_core@0.11 MIT` + `IIT/ICT-Series` 50 `ict/*.py` (`~22.7k LOC`) + `basemind` index 344 roots  
**Constraint:** Zero file in `dsh/` or `facility/` edited — all in `packages/enterprise/**` via Cordis `ctx.effect()` / `inject` / `profile.extend`  
**Parent:** `SPEC.md` (architecture) + `IMPLEMENTATION_PLAN.md` (gated roadmap) — this file is the file-by-file build manual

---

## Table of Contents

- [0. Executive Summary](#0-executive-summary)
- [1. Verified Repo Map](#1-verified-repo-map)
- [2. Architecture & Data Flows](#2-architecture--data-flows)
- [3. Workspace & Toolchain](#3-workspace--toolchain)
- [4. Rust Core `iit-core`](#4-rust-core-iit-core)
- [5. `chains` — Artifact Chains](#5-chains--artifact-chains)
- [6. `session-protocol` — CHARTER/ACTIVE](#6-session-protocol--charteractive)
- [7. `guards-iit` — IIT/ICT Guard Runner](#7-guards-iit--iitict-guard-runner)
- [8. `gateway` — Model Gateway](#8-gateway--model-gateway)
- [9. `sandbox-runner` — Phased Runner](#9-sandbox-runner--phased-runner)
- [10. `watchtower` — Receipts & Outcome Joining](#10-watchtower--receipts--outcome-joining)
- [11. Benchmark Monitoring](#11-benchmark-monitoring)
- [12. Auditability & Compliance Proofs](#12-auditability--compliance-proofs)
- [13. CLI](#13-cli)
- [14. MCP](#14-mcp)
- [15. SDK](#15-sdk)
- [16. Docs & Bundle](#16-docs--bundle)
- [17. Session Event Model](#17-session-event-model)
- [18. Security, Governance, Deployment](#18-security-governance-deployment)
- [19. Testing & Verification Matrix](#19-testing--verification-matrix)
- [20. Roadmap — Weekly Task Breakdown](#20-roadmap--weekly-task-breakdown)
- [21. Risk Register](#21-risk-register)
- [22. Appendices](#22-appendices)

---

## 0. Executive Summary

This is the build manual for the best-in-world agent harness: DSH (DeepSeek Harness, Cordis plugin system, `vendor/cordis@4.0.0-rc.7`) + Facility governance (chains, gateway, runner, mcp) + IIT/ICT causal guards (Φ, EWS, cusp, workspace) — all as Cordis plugins in a new aggregate `packages/enterprise/**` at the test-root. No upstream file is touched; `scripts/verify-no-upstream-mutation.sh` gates CI. Rust core is 100% MIT/Apache (`ruvector-consciousness 2.1` + `elara-active-inference 0.1` + `deep_causality_core 0.11` → WASM `wasm-bindgen` + `getrandom/js`); Python `ict/*.py` (50 modules, `~22.7k LOC`) is bridged via `python3.9` subprocess `PYTHONPATH=IIT/ICT-Series` for P0, Rust ports replace the bridge per-module when latency matters. Every claim ships with a benchmark + a hash-chained receipt + a recomputable Φ/CES proof.

---

## 1. Verified Repo Map

### 1.1 Top-level

```
test/                          # not a git repo — new enterprise git root recommended
├── dsh/                       # git: deepseek-ai/deepseek-harness @ b150a551b8 (0.1.1-rc.2)
│   ├── pnpm-workspace.yaml    # packages/*/*, vendor/cosmokit@1.8.1 (16f6fc0), cordis@4.0.0-rc.7 (56b3d4f7), schemastery@3.18.0
│   ├── packages/core/session/src/types.ts          # SessionEventMap (lines 236-337), SessionId Branded, SESSION_FORMAT_VERSION=0 (line 56)
│   ├── packages/core/session/src/known-event-types.ts
│   ├── packages/core/session/src/{chunk-rows,surface,request-header}.ts
│   ├── packages/guard/repeat-tool-reminder, timeout-policy  # 123 files — only 2 guards, not a framework
│   ├── packages/skill/skill/src/index.ts          # SkillRegistry, SkillProvider, 124 symbols
│   ├── packages/sandbox/sandbox-local/src/profiles.ts  # bwrap, landlock, seatbelt
│   ├── packages/credentials/authorization/src/index.ts
│   ├── packages/mcp/mcp-client                    # client-only
│   ├── packages/boot/cmdline
│   ├── packages/session/session-{collaboration,persistence-postgres}  # postgres at test-root packages/session, not dsh
│   └── vendor/{cordis,cosmokit,schemastery}/
├── facility/                  # git: theam/facility @ b150d96 (also ae68401 gateway meter, etc.)
│   ├── pnpm-workspace.yaml    # packages/*, services/*, runner
│   ├── packages/harness/src/chain.ts       # 4642 B, 12 symbols: ChainTypeConfig, ArtifactChainConfig, SharedFrontmatter, WsjfSchema, productChain, researchChain, bundledChains, chainFromConfig
│   ├── packages/harness/src/session.ts     # 4738 B, HarnessSessionInput, buildHarnessBundle, sessionMd, toolsMd
│   ├── packages/harness/src/validate.ts    # chain validation
│   ├── packages/core/src/detect.ts, permissions.ts, fingerprints.ts
│   ├── packages/db/src/schema.ts           # drizzle pgTable: users, userIdentities, orgs, roles, orgMembers, ...
│   ├── services/gateway/src/budgets.ts     # 9941 B, BudgetDef, applicableBudgets, hardBudgetBlock, reserveHardBudgets
│   ├── services/gateway/src/auth.ts, provider-auth.ts, metering.ts, envelope-store.ts, types.ts
│   ├── runner/src/phases.ts                # 3769 B, RUN_PHASE_NAMES 9 phases, RunPhaseRecorder
│   ├── packages/mcp/                       # server + client
│   └── packages/cli/src/init.mjs           # 27569 B
├── IIT/                       # NOT git — notebooks + ict/ package
│   ├── IIT-1..4.ipynb (XOR 3-node, MIP, 4-node ring, pyphi.macro, 11 frontiers)
│   ├── ICT-Series/ICT-*.ipynb 58 notebooks (1 PhiTrajectories, 8 Attractor EWS, 10 CatastropheGrammar, 14 FreeEnergy, 22 LLMSubstrat, 23 PersonaCusp, 24 WorkspaceIgnition, 26-30 A-E, etc.)
│   ├── ICT-Series/ict/*.py 50 modules ~22.7k LOC (catastrophe.py 16KB, early_warning 192 LOC, causal_emergence 16KB, tpm_estimation 156 LOC pyphi, free_energy 20KB, workspace 677 LOC, bistable 153 LOC, etc.)
│   └── ICT-Series/pyproject.toml  # pyphi==1.2.0, Python ≤3.9, NumPy<2, pip install -e .
├── packages/                  # test-root packages (no pnpm-workspace.yaml)
│   ├── identity/auth
│   ├── session/session-collaboration, session-persistence-postgres
│   └── enterprise/            # ← NEW — all work here
└── docs/enterprise/{SPEC.md, IMPLEMENTATION_PLAN.md, DETAILED_PLAN.md (this)}
```

Verified via `basemind query find-files`, `git -C dsh log --oneline -1`, `tar tzf /tmp/ruvector-2.1.0.crate`, `tar tzf /tmp/iit-0.1.0.crate`, `wc -l IIT/ICT-Series/ict/*.py`.

### 1.2 Pinned crate APIs (real, MIT/Apache)

```rust
// ruvector-consciousness = "2.1" MIT, features ["phi","emergence","collapse","wasm"], getrandom/js for wasm32
use ruvector_consciousness::types::{TransitionMatrix, ComputeBudget, PhiResult, EmergenceResult, Bipartition};
use ruvector_consciousness::phi::auto_compute_phi; // (&TransitionMatrix, Option<state>, &ComputeBudget) -> Result<PhiResult>
use ruvector_consciousness::emergence::{effective_information, determinism, causal_emergence};
// PhiResult { phi: f64, algorithm: PhiAlgorithm, mip: Option<Bipartition>, computation_time_ms, n_partitions }
// TransitionMatrix::new(n: usize, data: Vec<f64>) // row-major, row-stochastic, validates sum≈1.0
// ComputeBudget::exact() / ::balanced() / ::fast()

// elara-active-inference = "0.1" MIT OR Apache-2.0, pure std zero deps
use elara_active_inference::{Agent, AgentConfig, Observation, Action}; // discrete POMDP, F+G

// deep_causality_core = "0.11" MIT (LF AI & Data)
use deep_causality_core::{Causaloid, Context, PropagatingEffect};

// iit = "0.1" MIT — kept as alt, superseded by ruvector
// IITSystem::new(n) -> tpm [2;2n] uniform 0.5, connectivity false; calculate_phi() -> PhiResult
```

PyPhi `1.2.0` is **Python GPL-3.0 ≤3.9** — not a Rust dep. `symthaea-fep 0.1.0` **AGPL-3.0** — rejected. Only `facility/harness/chain.ts` is ported verbatim (MIT, small).

---

## 2. Architecture & Data Flows

### 2.1 Stack

```
Consumer: CLI  │  MCP (stdio + HTTP)  │  SDK  │  Docs (VitePress)  │  Grafana
─────────────────────────────────────────────────────────────────────────────
Cordis plugins (TS): chainsPlugin │ sessionProtocolPlugin │ guardRunnerPlugin(iit-bridge)
  │ gatewayPlugin (wraps ctx.llm) │ sandboxPhasesPlugin (wraps ctx.sandbox) │ mcpServerPlugin │
  │ watchtowerPlugin │ skillGraduation (extends ctx.skills) │ enterpriseProfile = baseProfile.extend
─────────────────────────────────────────────────────────────────────────────
Rust core (WASM cdylib+rlib): ruvector-consciousness (phi+emergence+collapse, SIMD, bump arena)
  │ elara-active-inference (F+G) │ deep_causality_core (Causaloid/CSM) │
  │ custom: catastrophe (cusp), attractor_ews, boundary (frontier), workspace (GWT), tpm.rs
─────────────────────────────────────────────────────────────────────────────
Upstream peers (never edited): dsh/* (tools, session, sandbox, skill, llm, credentials, boot, mcp-client)
                              facility/* (harness/chain, gateway, runner/phases, mcp server)
                              ict/*.py (50 modules) bridged via python3.9 subprocess P0, ported to Rust incrementally
```

### 2.2 Data flows

1. **Chain flow:** `SDK chains.createSignal` → `SessionEvent 'chain/signal'` (required, `ignorable` absent) → `watchtower` validates `S→D→T→V` → `Receipt outcome=accepted` only if chain valid.
2. **Guard flow:** `tool/call` → `ctx.tools.guard` waterfall (dsh builtins → `guards-iit/preflight` phi/threshold/ces/boundary/cusp/ews → `next()` → `sandbox.run`). `error` blocks step (`turn reason=blocked`), `warning` annotates + emits `audit/event`.
3. **Gateway flow:** `ctx.llm.generate` → `gateway` decorator (`applicableBudgets → hardBudgetBlock → reserveHardBudgets → envelopeStore.capture` before/after `next()` → `adjustBudgetReservations` on usage) → `BenchmarkEnvelope` dual-write Postgres `run_events` + R2 WORM.
4. **Phase flow:** `sandbox.run` → `RunPhaseRecorder.measure(bootstrap→delivery)` 9 phases → `phases[]` in `Receipt` + `BenchmarkEnvelope` → Grafana + Watchtower hourly job (`GitHub PR merged? CI green?` → `outcome`).
5. **IIT flow:** `SessionEvent` window `K=64` → `tpm.rs session_window_to_tpm` → `TransitionMatrix` → `ruvector::auto_compute_phi` → `PhiResult{phi, mip}` → `iit/coherence` event (`ignorable:true`) + `Receipt phiSnapshot`.

---

## 3. Workspace & Toolchain

### 3.1 New workspace `packages/enterprise/`

```
packages/enterprise/
├── Cargo.toml              # [workspace] members = ["iit-core"]
├── pnpm-workspace.yaml     # packages = ["*"]  # pnpm at enterprise level
├── package.json            # private, name: @deepseek-ai/dsh-enterprise-umbrella
├── iit-core/               # Rust
├── guards-iit/             # TS
├── chains/
├── session-protocol/
├── gateway/
├── sandbox-runner/
├── watchtower/
├── cli/
├── mcp/
├── sdk/
└── bundle-enterprise/
```

Root `test/` is not a git repo — `git init` at `test/` recommended, or keep enterprise as standalone repo with `file:` deps on `../dsh` and `../facility`. CI runs `pnpm --filter @deepseek-ai/dsh-enterprise-*` and `cargo test` in `iit-core`.

### 3.2 Toolchain

* **Rust:** `1.85` (from `rust-skills.md` default), `edition = "2024"`, `lints.rust.unsafe_code = warn`, `lints.clippy.{all,pedantic}=warn`, `cargo +1.85`.
* **TS:** `typescript ^5` `strict: true`, `tsdown` bundles, `vitest` per leaf, `knip` hygiene, `eslint` via `dsh` config.
* **Python bridge:** `python3.9` + `numpy<2` + `pyphi==1.2.0` in `IIT/ICT-Series/.venv` (`python -m venv .venv && .venv/bin/pip install -e .` per `pyproject.toml`). `Node` spawns `python -c "import ict.catastrophe; print(json.dumps(...))"` with `PYTHONPATH=IIT/ICT-Series`.
* **WASM:** `wasm-pack build --target bundler --features wasm` + `wasm-bindgen-cli`, `getrandom/js` for `wasm32`.

### 3.3 Gating script `scripts/verify-no-upstream-mutation.sh`

```bash
#!/bin/bash
set -euo pipefail
for repo in dsh facility; do
  if ! git -C "$repo" diff --quiet; then echo "FAIL: $repo has uncommitted changes"; git -C "$repo" diff --stat; exit 1; fi
  if ! git -C "$repo" diff --cached --quiet; then echo "FAIL: $repo has staged changes"; exit 1; fi
done
echo "OK: no upstream mutation"
```

---

## 4. Rust Core `iit-core`

### 4.1 `iit-core/Cargo.toml`

```toml
[package]
name = "dsh-enterprise-iit-core"
version = "0.1.0"
edition = "2024"
rust-version = "1.85"
license = "MIT OR Apache-2.0"
description = "MIT IIT/ICT causal core for DSH Enterprise — ruvector + elara + deep_causality"

[lib]
crate-type = ["cdylib", "rlib"]
name = "dsh_enterprise_iit_core"

[dependencies]
ruvector-consciousness = { version = "2.1", features = ["phi","emergence","collapse","wasm"] }
elara-active-inference = "0.1"
deep_causality_core = { version = "0.11", default-features = false, features = ["std"] }
wasm-bindgen = "0.2"
serde = { version = "1", features = ["derive"] }
serde-wasm-bindgen = "0.6"
getrandom = { version = "0.2", features = ["js"] }
thiserror = "1"
tracing = "0.1"

[dev-dependencies]
criterion = "0.5"
proptest = "1"
approx = "0.5"
```

### 4.2 `src/lib.rs` (re-exports)

```rust
pub mod tpm;
pub mod catastrophe;
pub mod attractor;
pub mod boundary;
pub mod workspace;
pub use ruvector_consciousness as ruvector;
pub use elara_active_inference as elara;
```

### 4.3 `src/tpm.rs` (sole DSH-specific file)

```rust
use ruvector_consciousness::types::TransitionMatrix;
use crate::error::IITCoreError;

/// Map session window to TPM.
/// `n_vars` in [4,8] → `n_states = 1<<n_vars` (16..256, fits Exact budget).
/// Vars (configurable): [tool_success, approval_granted, skill_loaded, sandbox_ok, ...]
/// Counts transitions in window, Laplace smooth α=0.5 (ruvector default), row-stochastic.
pub fn session_window_to_tpm(window: &[SessionEvent], n_vars: usize) -> Result<(TransitionMatrix, usize), IITCoreError> {
  assert!((4..=8).contains(&n_vars));
  let n_states = 1 << n_vars;
  let mut counts = vec![vec![0usize; n_states]; n_states];
  // ... for each consecutive pair in window, binarize vars → state idx, counts[cur][nxt] += 1
  // smooth: (count+0.5)/(total+ n_states*0.5) → row sums 1.0
  // data = counts flattened row-major
  // TransitionMatrix::new(n_states, data) validates sum≈1.0
  // current_state = last window bin
}
```

Test: `tpm_from_trajectory` synthetic 8-state block model vs `pyphi` (tolerance `1e-6` exact, `1e-3` approx).

### 4.4 `src/catastrophe.rs` (`ict/catastrophe.py` 16 KB → ~250 Rust)

```rust
pub struct CuspParams { pub a: f64, pub b: f64 } // control params: a = normal, b = bifurcation
pub struct CuspFit { pub alpha: f64, pub beta: f64, pub distance_to_bifurcation: f64, pub hysteresis: bool }

impl CuspFit {
  pub fn from_trajectory(traj: &[f64]) -> Self {
    // V(x;a,b)=x⁴/4 + a x²/2 + b x, equilibria x³+ax+b=0, bifurcation 4a³+27b²=0
    // Fit a,b via least-squares to traj (bridge ict/catastrophe.py fit_cusp for P0 validation)
  }
  pub fn is_inside_cusp(&self) -> bool { 4.0*self.alpha.powi(3) + 27.0*self.beta.powi(2) < 0.0 }
}
```

P0 bridges `ict/catastrophe.py fit_cusp` via `python -c` and compares Rust vs Python `distance` within `1e-4`.

### 4.5 `src/attractor.rs` (`ict/early_warning.py` 192 LOC → ~300 Rust)

```rust
pub fn ews_variance(window: &[f64]) -> f64 { /* sliding_window_view, var */ }
pub fn ews_ac1(window: &[f64]) -> f64 { /* lag-1 autocorr */ }
pub fn spectral_radius(connectivity: &[Vec<bool>]) -> f64 { /* nalgebra eigenvalues max|λ| */ }
// ICT-8 GrazingModel dx/dt = r x(1-x/K) - c x²/(x²+h²) — port ict/bistable.py GrazingModel (153 LOC) as helper
```

Thresholds from `ICT-8` Gates: `varianceLimit`, `acLimit` in `iit-config.yaml`.

### 4.6 `src/boundary.rs` (IIT-4 frontier, ~200 Rust)

```rust
pub fn enumerate_frontiers(substrate_n: usize) -> Vec<Bipartition> { /* all 2^n cuts via ruvector::phi::BipartitionIter */ }
pub fn best_frontier(tpm: &TransitionMatrix) -> (Bipartition, f64 /*phi*/, f64 /*ei*/) {
  // double dissociation: maxΦ vs maxEI frontier — ICT-4 Gates, ruvector phi + emergence EI
}
```

### 4.7 `src/workspace.rs` (ICT-24, ~250 Rust)

```rust
pub fn ignition_score(broadcast: &[f64], fan_out: usize) -> f64 { broadcast.iter().sum::<f64>() * fan_out as f64 / broadcast.len() as f64 }
pub fn is_ignited(score: f64, threshold: f64) -> bool { score > threshold } // Gate 22 T=128, S4 SAE precomputed
// Bridges ict/workspace.py 677 LOC numpy-only for off-line S4 .npz load
```

### 4.8 WASM bindgen `src/bindgen.rs`

```rust
#[wasm_bindgen]
pub fn calculate_phi_js(tpm_json: &str, state: usize, budget: &str) -> Result<JsValue, JsValue> {
  let tpm: TransitionMatrix = serde_json::from_str(tpm_json).map_err(|e| e.to_string())?;
  let budget = match budget { "exact" => ComputeBudget::exact(), _ => ComputeBudget::balanced() };
  let res = ruvector_consciousness::phi::auto_compute_phi(&tpm, Some(state), &budget).map_err(|e| e.to_string())?;
  Ok(serde_wasm_bindgen::to_value(&res)?)
}
```

Build: `wasm-pack build --target bundler --features wasm` → `pkg/dsh_enterprise_iit_core_bg.wasm` + `pkg/*.js` consumed by `guards-iit`.

### 4.9 Benches `benches/phi_bench.rs` (criterion, from ruvector)

```rust
criterion_group!(benches, phi_exact_8, phi_spectral_64, emergence_ei, cusp_fit);
```

Gate: `phi_exact_8 < 50ms`, `phi_spectral_64 < 200ms` (includes WASM overhead 1.5×).

---

## 5. `chains` — Artifact Chains

### 5.1 Source

`facility/packages/harness/src/chain.ts` (12 symbols, `productChain` `S→D→T→V`, `researchChain` `H→E→F`, `bundledChains`, `chainFromConfig(config)`, `SharedFrontmatter` `z.object`, `WsjfSchema`). Also `facility/packages/harness/src/validate.ts` (chain validation, WSJF).

### 5.2 Package

```
packages/enterprise/chains/
├── package.json          # @deepseek-ai/dsh-enterprise-chains, peers: @deepseek-ai/cordis, @deepseek-ai/schemastery
├── tsconfig.json         # extends tsconfig.base.json, rootDir src, outDir lib/types
├── tsdown.config.ts
├── src/
│   ├── types.ts          # ChainTypeConfig, ArtifactChainConfig, SharedFrontmatter, WsjfSchema — copy from facility, zod→schemastery
│   ├── chain.ts          # productChain, researchChain, bundledChains, chainFromConfig — verbatim copy
│   ├── validate.ts       # from facility validate.ts
│   ├── plugin.ts         # Cordis plugin
│   └── invariant.ts      # register manifest, check S→D→T→V linking
└── tests/
    ├── chain.spec.ts     # S→D→T→V happy, missing parent, WSJF scoring, declaration-merge SessionEventMap
    └── chain.bench.spec.ts
```

`src/types.ts` (excerpt):

```ts
import { z } from '@deepseek-ai/schemastery';
export const SharedFrontmatter = z.object({ title: z.string(), status: z.enum(['draft','active','done']), wsjf: z.number().optional() });
export type ChainTypeConfig = { name: string; parents: string[]; schema: z.ZodType };
export type ArtifactChainConfig = { types: Record<string, ChainTypeConfig> };
export const productChain: ArtifactChainConfig = {
  S: { name: 'Signal', parents: [], schema: SharedFrontmatter.extend({ source: z.string(), evidence_refs: z.array(z.string()) }) },
  D: { name: 'Decision', parents: ['S'], schema: SharedFrontmatter.extend({ status: z.string(), decided_by: z.string() }) },
  T: { name: 'Task', parents: ['D'], schema: SharedFrontmatter.extend({ status: z.string(), wsjf: z.number() }) },
  V: { name: 'Verification', parents: ['T'], schema: SharedFrontmatter.extend({ task: z.string(), outcome: z.enum(['pass','fail']) }) },
  R: { name: 'Reference', parents: [], schema: SharedFrontmatter.extend({ area: z.string() }) },
};
```

`src/plugin.ts`:

```ts
import type { Context } from '@deepseek-ai/cordis';
export const name = 'dsh-enterprise:chains';
export function apply(ctx: Context) {
  ctx.effect('chains', () => ({
    productChain, researchChain, bundledChains, validate, chainFromConfig,
  }));
}
```

Tests must assert `chainFromConfig({ artifact_types: [...] })` round-trips and `validate` rejects cycle.

---

## 6. `session-protocol` — CHARTER/ACTIVE

### 6.1 Source

`facility/packages/harness/src/session.ts` (`HarnessSessionInput{chain, org, project}`, `buildHarnessBundle`, `sessionMd(input): string` with `$FACILITY_API_URL`, `toolsMd`, `productOwnerToolsMd`). ~200 LOC, no DB.

### 6.2 Package

```
packages/enterprise/session-protocol/
├── src/
│   ├── types.ts          # declare module '@deepseek-ai/dsh-session' { interface SessionEventMap { 'chain/signal':... } }
│   ├── session.ts        # buildHarnessBundle, sessionMd — port from facility
│   ├── plugin.ts         # ctx.effect('sessionProtocol', ...)
│   └── invariant.ts
└── tests/session-protocol.spec.ts  # CHARTER/ACTIVE round-trip, ignorable check, sessionMd snapshot
```

`src/types.ts`:

```ts
declare module '@deepseek-ai/dsh-session' {
  interface SessionEventMap {
    'chain/signal': { chainId: string; signal: { title: string; source: string; evidence_refs: string[] } };
    'chain/decision': { chainId: string; decision: { signalId: string; status: string; decided_by: string } };
    'chain/task': { chainId: string; task: { decisionId: string; status: string; wsjf?: number } };
    'chain/verification': { chainId: string; verification: { taskId: string; outcome: 'pass'|'fail' } };
    'iit/coherence': { phi: number; cesHash: string; mip: { part1:number[]; part2:number[] }; ignorable: true };
    'iit/cusp': { distanceToBifurcation: number; hysteresis: boolean; ignorable: true };
    'iit/ews': { variance: number; ac1: number; ignorable: true };
  }
}
```

Chain events `ignorable` absent → old readers **refuse** (correct). `iit/*` `ignorable:true` → old readers skip. No `SESSION_FORMAT_VERSION` bump per `dsh/packages/core/session/src/types.ts:338`.

---

## 7. `guards-iit` — IIT/ICT Guard Runner

### 7.1 Package

```
packages/enterprise/guards-iit/
├── package.json          # peers: cordis, schemastery, plus dev: @deepseek-ai/dsh-enterprise-iit-core (WASM pkg)
├── src/
│   ├── types.ts          # GuardId, GuardConfig, GuardResult{disposition:'pass'|'block'|'warn', phi?, cesHash?, cusp?}
│   ├── guard-runner.ts   # decorates ctx.tools.guard waterfall
│   ├── guards/
│   │   ├── phi-threshold.ts   # ruvector auto_compute_phi, minPhi
│   │   ├── ces-fingerprint.ts # cesHash compare
│   │   ├── boundary.ts        # frontier maxΦ
│   │   ├── attractor-ews.ts   # variance, AC1, spectral radius
│   │   ├── catastrophe-cusp.ts# cusp distance
│   │   ├── workspace-ignition.ts
│   │   ├── free-energy.ts     # elara vs ict/free_energy.py
│   │   ├── causal-emergence.ts# ruvector emergence CE
│   │   ├── effect-ethos.ts    # deep_causality_core Teloid
│   │   └── signaling.ts
│   ├── config.ts         # zod schema for .dsh/iit-config.yaml
│   ├── bridge.ts         # Node→python3.9 subprocess for ict/*.py (P0)
│   └── invariant.ts
└── tests/
    ├── guard-runner.spec.ts   # waterfall next() delegation, error short-circuit, warning annotation
    ├── phi-threshold.spec.ts  # synthetic TPMs vs pyphi tolerance
    └── benchmark.spec.ts
```

### 7.2 `src/guard-runner.ts`

```ts
import type { Context } from '@deepseek-ai/cordis';
import { z } from '@deepseek-ai/schemastery';
export const name = 'dsh-enterprise:guards-iit';
export const inject = ['tools','sessions','audit','chains'] as const;
export const Config = z.object({ iitConfigPath: z.string().default('.dsh/iit-config.yaml'), minPhi: z.number().default(0.1) });
export function apply(ctx: Context, config: z.infer<typeof Config>) {
  const originalGuard = ctx.tools?.guard?.bind(ctx.tools);
  ctx.effect('iitGuards', () => {
    // lazy import WASM pkg
    let wasm: any = null;
    const getWasm = async () => wasm ??= await import('@deepseek-ai/dsh-enterprise-iit-core/pkg');
    return {
      async calculatePhi(tpm: unknown, state: number) {
        const w = await getWasm(); return w.calculate_phi_js(JSON.stringify(tpm), state, 'exact');
      },
      async runCusp(traj: number[]) {
        // try WASM, fallback to python bridge ict/catastrophe.py
        try { const w = await getWasm(); return w.cusp_fit(JSON.stringify(traj)); }
        catch { return bridge.cuspFit(traj); }
      },
    };
  });
  // decorate waterfall
  if (ctx.tools?.guard) {
    const wrapped = async (ev: any, next: any) => {
      const phi = await ctx.get('iitGuards')?.calculatePhi?.(ev.tpm, ev.state);
      if (phi?.phi < config.minPhi) throw new GuardError(`phi ${phi.phi} < ${config.minPhi}`);
      return next(ev);
    };
    ctx.tools.guard = wrapped as any;
  }
}
```

### 7.3 Guard specs (each `src/guards/*.ts`)

| Guard | Config | WASM call | Python bridge (`ict/*.py`) | Threshold |
|-------|--------|-----------|-------------|-----------|
| `phi-threshold` | `minPhi, method, max_exact_size` | `ruvector::auto_compute_phi(&TransitionMatrix, &ComputeBudget::exact())` | `pyphi` synthetic validation only | `phi < 0.1` → `block` |
| `ces-fingerprint` | `expectedHash` | `ruvector::ces` (via `iit::concepts`) | — | mismatch → `block` |
| `boundary` | `minBoundaryPhi` | `boundary::enumerate_frontiers` + `emergence::effective_information` | `ict/causal_emergence.py` Hoel path | `bestPhi < min` → `block` |
| `attractor-ews` | `varianceLimit, acLimit` | `attractor::ews_variance, ews_ac1` | `ict/early_warning.py` `early_warning_signals()` (192 LOC) | `var>limit || ac1>limit` → `warn` |
| `catastrophe-cusp` | `maxRisk, bifurcationMargin=0.2` | `catastrophe::CuspFit::from_trajectory` | `ict/catastrophe.py` `fit_cusp()` (16 KB) | `distance<0.2` → `warn`, `<0` → `block` |
| `workspace-ignition` | `maxIgnition, sensitiveScopes` | `workspace::ignition_score` | `ict/workspace.py` `ignition_score()` (677 LOC) | `score>max` → `block` |
| `free-energy` | `maxSurprise` | `elara::Agent` `F`/`G` + `ict/free_energy.py` `F_t=½[(o-p̂)²/σ²+ln(2πσ²)]` | Gate 1 monotone MSE note: at fixed σ² just MSE | `F>max` → `warn` (disclose) |
| `causal-emergence` | `maxCE` | `ruvector::emergence::causal_emergence` | `ict/causal_emergence.py` Hoel 2.0 path | `CE>max` → `warn` |
| `effect-ethos` | `teloids: Teloid[]` | `deep_causality_core::Causaloid` (Phase 2) | TS `GuardTeloid` check for P0 | `Teloid violated` → `block` |

Every guard has `src/guards/<id>.spec.ts` with synthetic `TransitionMatrix` (`n=4, 8, 16`) and snapshot of `GuardResult`; `invariant.ts` checks one event/data relation.

### 7.4 `src/bridge.ts` (P0 Python bridge)

```ts
import { spawn } from 'node:child_process';
export async function cuspFit(traj: number[]): Promise<CuspFit> {
  const py = spawn('python3.9', ['-c', `
import json, sys
sys.path.insert(0, 'IIT/ICT-Series')
import ict.catastrophe as cat
traj = json.loads(sys.argv[1])
fit = cat.fit_cusp(traj)  # measured in ict/catastrophe.py
print(json.dumps(fit))
`, JSON.stringify(traj)], { env: { ...process.env, PYTHONPATH: 'IIT/ICT-Series' } });
  // collect stdout, parse JSON, return
}
```

Gated by `process.env.DSH_ENTERPRISE_PYTHON_BRIDGE ?? '1'`.

---

## 8. `gateway` — Model Gateway

### 8.1 Source

`facility/services/gateway/src/{budgets.ts(9941 B), auth.ts, provider-auth.ts(2442 B), metering.ts(6413 B), envelope-store.ts(893 B), types.ts, app.ts(20234 B)}` + `facility/packages/core/src/provider-auth.ts`.

### 8.2 Package

```
packages/enterprise/gateway/
├── src/
│   ├── types.ts          # BudgetDef, BudgetState, VirtualKey, BudgetReservation, Envelope
│   ├── budgets.ts        # port budgets.ts: applicableBudgets, hardBudgetBlock, reserveHardBudgets, adjustBudgetReservations, addBudgetSpend
│   ├── auth.ts           # VirtualKey issue/verify, TTL, scopes
│   ├── provider-auth.ts  # WIF/Bedrock/Vertex/API-key/OAuth stubs (NotImplemented + config gate)
│   ├── metering.ts       # token counting, cost calc, spendCounters(budget_id, window_start)
│   ├── envelope-store.ts # dual-write object store (S3/R2) + Postgres run_events
│   ├── plugin.ts         # ctx.effect('gateway', ...) + wraps ctx.llm
│   └── invariant.ts
└── tests/
    ├── budgets.spec.ts   # hardBudgetBlock correctness (window, counters, over-budget)
    ├── auth.spec.ts
    └── gateway.bench.spec.ts
```

`src/plugin.ts`:

```ts
export const inject = ['credentials','audit','objectStore?'] as const;
export function apply(ctx: Context, cfg: Config) {
  ctx.effect('gateway', () => ({
    issueVirtualKey: (p: VirtualKeyParams) => budgets.issue(p),
    checkBudget: budgets.checkBudget,
    captureEnvelope: envelopeStore.capture,
  }));
  // decorator around ctx.llm
  const orig = ctx.llm?.generate?.bind(ctx.llm);
  if (orig) ctx.llm.generate = async (req) => {
    const budgets = await applicableBudgets(db, key, now);
    const block = hardBudgetBlock(budgets);
    if (block) throw new BudgetError(block);
    const reservations = await reserveHardBudgets(db, budgets, key, estimatedCents);
    const envelope = await envelopeStore.capture(req);
    const res = await orig(req);
    await envelopeStore.capture(res);
    await adjustBudgetReservations(db, reservations, actualCents(res));
    return res;
  };
}
```

DB: `packages/session/session-persistence-postgres` migration `002_enterprise_budgets.sql` adds `budgets(scope, projectId, orgId, enabled, period, limitCents)`, `spendCounters(budgetId, window_start, spentCents)` — drizzle pattern from `facility/packages/db/src/schema.ts`.

---

## 9. `sandbox-runner` — Phased Runner

### 9.1 Source

`facility/runner/src/phases.ts` (`RUN_PHASE_NAMES`, `RunPhaseRecorder`, `RunPhaseOutcome`, `PhaseDetails`, `EmitRunEvents`).

### 9.2 Package

```
packages/enterprise/sandbox-runner/
├── src/
│   ├── phases.ts         # verbatim port + TS types
│   ├── redaction.ts      # secret redaction at event boundary (regex + ctx.get('credentials'))
│   ├── plugin.ts         # wraps ctx.sandbox.run
│   └── invariant.ts
└── tests/
    ├── phases.spec.ts    # measure/start/finish/fail/skip, durationMs, issuance of run_events
    └── benchmark.spec.ts # phase durations, redaction coverage
```

`src/plugin.ts`:

```ts
export const inject = ['sandbox','audit','gateway?'] as const;
export function apply(ctx: Context) {
  const orig = ctx.sandbox.run.bind(ctx.sandbox);
  ctx.sandbox.run = async (bundle) => {
    const recorder = new RunPhaseRecorder((evs) => ctx.audit.emit('run/event', evs));
    await recorder.measure('bootstrap', () => api.post(`/internal/runs/${runId}/hello`));
    await recorder.measure('workspace', () => /* setupWorkspace */);
    // ... package_install, provision, agent: orig(bundle), result_capture, acceptance, delivery
  };
}
```

---

## 10. `watchtower` — Receipts & Outcome Joining

### 10.1 Receipt shape

```ts
interface Receipt {
  runId: RunId; sessionId: SessionId; agentId: string;
  prevHash: string; logHash: string; // SHA-256(canonical JSON)
  phiSnapshot: { phi:number; method:string; cesHash:string; mip?:Bipartition };
  outcome: 'accepted'|'rejected'|'needs-human';
  cost: { tokens: TokenUsage; usd:number; budgets: BudgetState[] };
  guardDispositions: { guardId:string; disposition:'pass'|'block'|'warn'; phi?:number }[];
  builtAt: number; builder: { gitSha:string; crateVersions:Record<string,string> };
  hash: string; // SHA-256(canonical without hash)
}
```

`prevHash = receipts[i-1].hash`, seed `H("genesis"+orgId)`. Append-only `receipts` table + R2 WORM.

### 10.2 Package

```
packages/enterprise/watchtower/
├── src/
│   ├── types.ts
│   ├── receipts.ts       # hash chain, canonical JSON, SHA-256
│   ├── job.ts            # hourly node-cron, inject ['sessions','audit','scheduler','objectStore']
│   ├── aggregates.ts     # acceptance_rate, one_shot_rate, avg_cost, recurring_failures
│   ├── plugin.ts
│   └── invariant.ts
└── tests/
    ├── receipts.spec.ts  # chain continuity, recompute, tamper detection
    └── job.spec.ts       # outcome joining: PR merged? CI green? human approved?
```

`src/job.ts`:

```ts
export async function runWatchtowerJob(ctx: Context) {
  for (const run of await db.query.runs.findMany({ where: eq(runs.outcome, null) })) {
    const pr = await github.api.getPR(run.prNumber);
    const ci = await github.api.getChecks(run.commitSha);
    const outcome = (pr.merged && ci.green) ? 'accepted' : pr.closed ? 'rejected' : 'needs-human';
    const receipt = await generateReceipt(run, outcome);
    await db.insert(receipts).values(receipt);
    await objectStore.put(`receipts/${receipt.hash}.json`, JSON.stringify(receipt));
  }
}
```

DB migration `002_enterprise_receipts.sql` in `packages/session/session-persistence-postgres`.

---

## 11. Benchmark Monitoring

### 11.1 Suites

| Suite | Measures | Cmd | Gate |
|-------|----------|-----|------|
| `guards` | builtin + iit guards `pass/block` correct (99%) | `pnpm --filter @deepseek-ai/dsh-enterprise-guards-iit test -- benchmark` | per-PR |
| `session-protocol` | CHARTER/ACTIVE round-trip fidelity | same | per-PR |
| `chains` | `S→D→T→V` + WSJF | same | per-PR |
| `gateway` | `hardBudgetBlock` window/counters | `gateway` bench | per-PR |
| `watchtower` | hash-chain continuity | `watchtower` bench | per-PR |
| `iit-guards` | `auto_compute_phi` exact≤16 / spectral 64, cusp/ews latency | `iit-core` `criterion` `benches/phi_bench.rs` | per-PR + nightly soak |
| `terminal-bench`/`browsecomp` | e2e agent | `test:e2e` + facility `pilot-bench` nightly | nightly budget-capped |

### 11.2 Telemetry envelope

```ts
interface BenchmarkEnvelope { runId:SessionId; suite:string; benchId:string;
  startedAt:number; durationMs:number; outcome:RunPhaseOutcome;
  tokenUsage?:TokenUsage; costUsd?:number; modelRoute?:RequestContext;
  phi?:number; phiMethod?:string; cesHash?:string; cuspDistance?:number; ewsVariance?:number;
  phases?:{name:RunPhaseName; durationMs:number; outcome:RunPhaseOutcome; hash:string}[];
  artifactUrl?:string; receiptHash?:string; }
```

Dual-write Postgres `run_events` + R2 (object lock). Grafana dashboards query Postgres; alerts `cost>budget`, `phi<min`, `ews>threshold`.

### 11.3 Observability

```
turn/step/tool → SessionEvent log (append-only)
        ↓ tap
PhaseRecorder + iit snapshots
        ↓
EnvelopeStore (facility envelope-store.ts)
        ↓ dual-write
Postgres run_events + Object store (payloads) → Grafana + Watchtower hourly job → Receipts (hash-chained)
```

New leaves: `watchtower` + `gateway` (wraps `ctx.llm`, no `llm/` edit); optional `telemetry-ui` Client plugin.

---

## 12. Auditability & Compliance Proofs

Auditor with only `receipts` + public code verifies:

1. **Reconstruct** `SessionEvent` log (`seq` contiguous, `SESSION_FORMAT_VERSION` check).
2. **Integrity:** `receipt.logHash == SHA256(canonical log)` + `receipt.hash == SHA256(canonical without hash)` + `prevHash` chain.
3. **Recompute Φ/CES:** `(TransitionMatrix hash, state, ComputeBudget)` → `auto_compute_phi` deterministic (`1e-9` exact, `1e-3` approx); `mip` witness checks minimality; `cesHash` canonical JSON.
4. **Guard disposition** matches `.dsh/iit-config.yaml` thresholds versioned in `builder.crateVersions`.
5. **Cost** cross-checked `envelope-store` captures (provider-reported, residual trust).
6. **Lineage** `Verification → Task → Decision → Signal` via chain events.

| Regulation | Satisfaction |
|------------|--------------|
| Traceability | SessionEvent + Receipt chain + `RequestContext.provider/model` |
| Explainability | CES snapshot + guard trace + `ict/early_warning` EWS |
| Cost control | `budgets` + `hardBudgetBlock` + `spendCounters(budget_id, window_start)`; receipt `budgets[]` |
| Lineage | `S→D→T→V` |
| Non-repudiation | `H("genesis"+orgId)` anchored chain |
| Retention | R2 object lock + Postgres append-only |

**Residual:** provider `TokenUsage`, TPM boolean abstraction (non-unique), `Tau`/`Geometric` no proven bound — receipts record `method`.

---

## 13. CLI

```
packages/enterprise/cli/
├── package.json # bin: dsh-enterprise, deps: @deepseek-ai/cordis
├── src/
│   ├── index.ts          # yargs: init, doctor, bootstrap, guard, receipt
│   ├── init.ts           # port facility 27KB: detect pnpm, write .dsh.json{profile:"enterprise"}, .dsh/iit-config.yaml, .github/workflows, AGENTS.md blocks, skills/guards
│   ├── doctor.ts         # validate workflows, guard signatures, GH App, budgets, receipt chain
│   ├── bootstrap.ts      # bind org + App installation
│   ├── guard.ts          # guard run <id> [--agent]
│   ├── receipt.ts        # receipt verify <runId> (recomputes chain + Φ)
│   └── invariant.ts
└── tests/cli.spec.ts     # init on fresh container, doctor, verify
```

`init` writes `.dsh/iit-config.yaml`:

```yaml
minPhi: 0.1
max_exact_size: 15
phiMethod: auto  # exact→spectral/stochastic
tpmVars: [tool_success, approval_granted, skill_loaded, sandbox_ok]
catastrophe: { bifurcationMargin: 0.2 }
ews: { varianceLimit: 2.0, acLimit: 0.7 }
```

---

## 14. MCP

```
packages/enterprise/mcp/
├── src/
│   ├── server.ts         # createMcpServer from facility/packages/mcp, tools = DSH tools + chains/gateway/watchtower/iit
│   ├── tools/
│   │   ├── chains.ts     # chain.createSignal/Decision/Task/Verification
│   │   ├── gateway.ts    # gateway.issueVirtualKey
│   │   ├── watchtower.ts # watchtower.generateReceipt
│   │   ├── iit.ts        # iit.calculatePhi (WASM)
│   │   └── guard.ts      # guard.run
│   ├── plugin.ts         # ctx.effect('mcpEnterprise', () => server)
│   └── invariant.ts
└── tests/mcp.spec.ts     # stdio + streamable HTTP smoke
```

Transport: stdio (default) + HTTP for daemon (mirrors basemind MCP).

---

## 15. SDK

```
packages/enterprise/sdk/
├── src/
│   ├── index.ts          # createEnterprise({profile}) -> {chains, gateway, watchtower, iit, tpm}
│   ├── types.ts          # branded SessionId, RunId, BudgetState
│   └── client.ts
└── tests/sdk.spec.ts
```

```ts
import { createEnterprise } from '@deepseek-ai/dsh-enterprise-sdk';
const ent = await createEnterprise({ profile: 'enterprise' });
const sig = await ent.chains.createSignal({ source, evidence_refs });
await ent.gateway.issueVirtualKey({ projectId, scopes, ttl, budgetUsd });
const r = await ent.watchtower.generateReceipt(runId); // hash-chained
```

---

## 16. Docs & Bundle

* `docs/enterprise/SPEC.md` + `GUARDS.md` + `BENCHMARKING.md` + `AUDITABILITY.md` — rendered via DSH `website` VitePress.
* Each leaf `README.md` + `README.zh.md` with model/token/KV effects per `dsh/docs/cookbook/adding-a-package.md#4`.
* `packages/enterprise/bundle-enterprise/` — `tsdown` patch-layer over `bundle/base`, emits `enterprise` `cordis.yml`.

---

## 17. Session Event Model

```ts
declare module '@deepseek-ai/dsh-session' {
  interface SessionEventMap {
    'chain/signal': { chainId: string; signal: { title: string; source: string; evidence_refs: string[] } };
    'chain/decision': { chainId: string; decision: { signalId: string; status: string; decided_by: string } };
    'chain/task': { chainId: string; task: { decisionId: string; status: string; wsjf?: number } };
    'chain/verification': { chainId: string; verification: { taskId: string; outcome: 'pass'|'fail' } };
    'iit/coherence': { phi: number; cesHash: string; mip: { part1:number[]; part2:number[] }; ignorable: true };
    'iit/cusp': { distanceToBifurcation: number; hysteresis: boolean; ignorable: true };
    'iit/ews': { variance: number; ac1: number; ignorable: true };
  }
}
```

Chain: required (`ignorable` absent) → old readers refuse. `iit/*`: `ignorable:true` → old readers skip. No `SESSION_FORMAT_VERSION` bump per `types.ts:338`.

---

## 18. Security, Governance, Deployment

* Secrets: `facility/services/gateway/provider-auth.ts` (WIF OIDC, Bedrock assume-role, Vertex WIP) → `gateway/provider-auth.ts` stubs `NotImplemented` + config gate; virtual keys short-TTL auto-revoked.
* Sandbox: `dsh/sandbox/sandbox-local` bwrap/landlock/seatbelt → `sandbox-runner` wraps + redaction (regex deny-list + `ctx.get('credentials')`).
* Permissions: `facility/core/permissions.ts` → `enterprise/permissions` markdown-link lint, actions pinned.
* Two-lane: `enterprise/lanes` `LaneConfig` repo vs platform toggle.
* Deployment: `bundle-enterprise` single `dsh` bin; publish `@deepseek-ai/dsh-enterprise-*` npm; infra PG 15+ Redis 7+ R2 WORM.
* **Regulated add-ons**: `auth` RBAC (P0), `sovereignty` region enforce + air-gapped Helm (P0), `compliance-erasure` tombstone (P0), `sbom` CycloneDX+SLSA (P0), `resilience` PITR+chaos (P1), `model-registry` AI Act (P1) — see §18.1-§18.6.

### 18.1 `auth` — RBAC & 4-eyes (P0, banque SoD)

```
packages/enterprise/auth/
├── package.json          # @deepseek-ai/dsh-enterprise-auth, deps: jose, schemastery, cordis
├── src/
│   ├── types.ts          # Principal{userId, orgId, roles}, Permission
│   ├── plugin.ts         # inject ['sessions','tools'], validateToken via jose JWKS, checkPermission
│   ├── rbac.ts           # role table, SoD: trader cannot approve own signal
│   └── invariant.ts
└── tests/rbac.spec.ts    # 4-eyes threshold 2, SoD block, JWKS mock
```

`src/plugin.ts`:
```ts
import { z } from '@deepseek-ai/schemastery'; import * as jose from 'jose';
export const Config = z.object({ provider: z.enum(['oidc','saml']), issuer: z.string().url(), jwksUrl: z.string().url(), roles: z.array(z.string()) });
export function checkPermission(p: Principal, r: Resource, a: string): boolean {
  if (a==='approve' && r.owner===p.userId) return false; // SoD
  return p.roles.includes('risk') || p.roles.includes('audit') || p.roles.includes('org:admin');
}
```

### 18.2 `sovereignty` — region enforce + air-gapped (P0)

```
packages/enterprise/sovereignty/
├── src/region-guard.ts   # enforceRegion(req, allowedRegions) throws GuardError if egress not in allowlist
├── helm/values-airgapped.yaml
└── tests/region.spec.ts  # rejects us-east-1 when eu-only
```

### 18.3 `compliance-erasure` — GDPR tombstone (P0)

```
packages/enterprise/compliance-erasure/
├── src/
│   ├── types.ts          # declare module '@deepseek-ai/dsh-session' { 'erasure/tombstone': {targetEventSeq, redactedHash, reason} }
│   ├── tombstone.ts      # redact(log, seq) => log' with HMAC, recompute logHash
│   └── plugin.ts         # ctx.on('erasure/tombstone', recompute Receipt)
└── tests/erasure.spec.ts # chain continuity after tombstone, receipt verify passes
```

### 18.4 `sbom` — CycloneDX + Cosign (P0)

```
packages/enterprise/sbom/
├── src/sbom.ts           # wrap cyclonedx-npm + cargo-cyclonedx, failOnCritical
└── tests/sbom.spec.ts    # snapshot sbom.cyclonedx.json contains ruvector 2.1
```

### 18.5 `resilience` — PITR + chaos (P1, DORA)

```
packages/enterprise/resilience/
├── src/pitr.ts           # PG PITR WAL archive, R2 cross-region replica
├── tests/chaos.spec.ts   # testcontainers: kill PG pod, partition network, assert BenchmarkEnvelope still emitted
└── runbook/DR.md         # RTO 4h / RPO 0
```

### 18.6 `model-registry` — AI Act (P1)

```
packages/enterprise/model-registry/
├── src/registry.ts       # registerModel({modelId, trainingDataHash, metrics, approvalBy}), link envelope.modelId
├── src/teloids.ts        # compile YAML Teloids -> deep_causality_core::Causaloid, guard effect-ethos error
└── tests/registry.spec.ts
```

---

## 19. Testing & Verification Matrix

| Gate | Cmd | Scope |
|------|-----|-------|
| type | `pnpm run typecheck` `cargo clippy -- -W clippy::pedantic` | all |
| unit | `pnpm run test` per leaf (Vitest), `cargo test` (`proptest`) | per leaf |
| coverage | `pnpm run test:coverage` per-file 100% `src/` | per leaf |
| snapshot | `pnpm run test:snapshot` pins receipt JSON, Φ, guard disposition | per leaf |
| bench | `criterion` `phi_bench` + `pnpm test:benchmark:*` | per leaf |
| invariant | `src/invariant.ts` per leaf + `verify-package-invariants` HMR disposal | per leaf |
| e2e | `test:e2e` + `pilot-bench` nightly, `cli init` fresh container | nightly |

Clone verification prerequisite: `git -C dsh log --oneline -1` `git -C facility log --oneline -1` `cargo metadata` `tar tzf /tmp/ruvector-2.1.0.crate`.

---

## 20. Roadmap — Weekly Task Breakdown

| Week | Tasks (file-by-file) | Exit artifact |
|------|----------------------|---------------|
| **1** | `enterprise/iit-core/Cargo.toml` + `src/lib.rs` + `src/tpm.rs` + `wasm-pack`; `enterprise/chains` `package.json` `types.ts` `chain.ts` `validate.ts` `plugin.ts` | `chains` snapshot, `TransitionMatrix::new(4, data)` `auto_compute_phi` bench <50ms |
| **2** | `enterprise/session-protocol` `types.ts` `session.ts` `plugin.ts`; `enterprise/guards-iit` `guard-runner.ts` `bridge.ts` `phi-threshold.ts` `config.ts`; `.dsh/iit-config.yaml` | `test:benchmark:chains` snapshot, `verify-no-upstream-mutation` green, WASM import in Vitest |
| **3-5** | `iit-core` `catastrophe.rs` (bridge `ict/catastrophe.py`), `attractor.rs` (bridge `ict/early_warning.py`), `boundary.rs`, `workspace.rs` (bridge `ict/workspace.py`); `guards-iit` add `ces-fingerprint/boundary/attractor-ews/cusp/causal-emergence` | `cargo test` + `criterion` + `bridge.py` vs Rust distance `1e-4` |
| **6-7** | `enterprise/gateway` `budgets.ts` `auth.ts` `metering.ts` `envelope-store.ts` `plugin.ts` (wrap `ctx.llm`); `002_enterprise_budgets.sql` | `hardBudgetBlock` bench, virtual-key issue |
| **8-9** | `enterprise/sandbox-runner` `phases.ts` `redaction.ts` `plugin.ts`; `enterprise/watchtower` `receipts.ts` `job.ts` `002_enterprise_receipts.sql` | `PhaseRecorder` 9-phase bench, `receipt verify` recompute, receipt chain snapshot |
| **9-10** | `enterprise/cli` `init.ts` `doctor.ts` `bootstrap.ts` `guard.ts` `receipt.ts` + workflows `plan/build/review` | `cli init` on fresh container e2e |
| **11-12** | `enterprise/mcp` `server.ts` + 5 tools, `enterprise/sdk` `index.ts` `types.ts`, `docs` VitePress, bilingual READMEs, `bundle-enterprise` | MCP stdio smoke, SDK types, `website:build` |
| **12-16** | Nightly `terminal-bench`/`browsecomp` via watchtower (budget-capped), Grafana dashboards + `cost>budget` `phi<min` `ews>threshold` alerts, load/perf, security review (covert channel via Φ drift), `receipts → WORM` export | Dashboard + audit report `CES/receipt` export |
| **12-16 (P0 reg)** | `auth` RBAC 4-eyes + `compliance-erasure` tombstone + `sovereignty` region enforce + `sbom` CycloneDX gate (parallèle dès sem 2) | `rbac.spec` + `erasure.spec` chain continuity + `region.spec` + `sbom.cyclonedx.json` + `verify-deps.sh` |
| **12-16 (P1 reg)** | `resilience` PITR + chaos + R2 replica + `model-registry` Teloids error + Helm air-gapped | `chaos.spec` + `receipts-restore-*.json` + `helm template` air-gapped |

---

## 21. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| `ruvector` spectral `1e-3` divergence from exact | M | M | Record `method` in receipt, pin `max_exact_size=15`, bridge `pyphi` synthetic validation `1e-6` |
| TPM boolean abstraction dispute | M | M | Doc `tpm.rs` mapping, hash `tpmHash` in receipt |
| `python3.9` `pyphi==1.2.0` env drift (NumPy<2) | M | M | Pin `.venv` `pyproject.toml`, `verify-pyphi-env` gate |
| `deep_causality` WASM Bazel | L | M | Teloids TS-only P0, P1 compile to Causaloid error |
| SoD bypass (RBAC) | M | H | `checkPermission` unit + 4-eyes threshold 2 |
| GDPR erasure breaks chain | M | H | Tombstone HMAC + recompute logHash, watchtower verify |
| SBOM drift | M | M | `verify-deps.sh` + `cyclonedx` per-PR gate |
| Data residency bypass | M | H | `sovereignty` region enforce in gateway + envelope-store |
| Root `test/` not git | H | L | `git init` at `test/` or standalone `enterprise` repo |

---

## 22. Appendices

### A. Crate API (verified)

```rust
// /tmp/ruvector-consciousness-2.1.0/src/lib.rs
TransitionMatrix::new(n: usize, data: Vec<f64>) // row-stochastic
ComputeBudget::exact() / ::balanced() / ::fast()
auto_compute_phi(&tpm, Some(state), &budget) -> Result<PhiResult{phi, algorithm, mip}>
effective_information(&tpm) -> f64 // (1/n)Σ D_KL
causal_emergence(&micro, &macro) -> f64
```

### B. Facility source map

`chain.ts` 12 symbols → `chains/src/chain.ts`; `session.ts` HarnessSessionInput → `session-protocol`; `budgets.ts` applicableBudgets → `gateway`; `phases.ts` RUN_PHASE_NAMES → `sandbox-runner`; `db/schema.ts` pgTable → migration 002; `cli/init.mjs` 27KB → `cli/init.ts`; `mcp` server → `enterprise/mcp`.

### C. ICT notebook → guard map

`IIT-1..4` → `phi-threshold`/`boundary`; `ICT-8` GrazingModel + `ict/early_warning.py` → `attractor-ews`; `ICT-10` `ict/catastrophe.py` fronce → `catastrophe-cusp`; `ICT-14` `ict/free_energy.py` Gates 1-3 créneau → `free-energy`; `ICT-22/21` `ict/sae_traces.py` S4 → `workspace` off-line; `ICT-23` `ict/persona_cusp.py` fronce + Wissel/Scheffer → `persona-cusp`; `ICT-24` `ict/workspace.py` 677 LOC → `workspace-ignition`; `ICT-26..30` A-E → `signaling` etc. (not P0). See `SPEC.md:3.2` full table.

### D. Verification commands (prerequisite)

```bash
git -C dsh log --oneline -1          # b150a551b8
git -C facility log --oneline -1     # b150d96
tar tzf /tmp/ruvector-2.1.0.crate | head
tar tzf /tmp/iit-0.1.0.crate | head
ls IIT/ICT-Series/ict/*.py | wc -l   # 50
wc -l IIT/ICT-Series/ict/*.py | tail -1  # ~22.7k
basemind query search "b150a551"     # 331 hits
```

*No upstream file edited to produce this plan. All paths verified via `basemind` + direct reads.*

