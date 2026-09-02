# DSH Enterprise — IIT-Inspired Enterprise Agent Platform

**22 production-grade plugins for DeepSeek Harness** — built on Integrated Information Theory (IIT) consciousness guards, enterprise observability, security, cost management, and compliance automation.

---

## Table of Contents

- [Why DSH Enterprise?](#why-dsh-enterprise)
- [IIT Consciousness Guards](#iit-consciousness-guards)
- [Enterprise Observability](#enterprise-observability)
- [Security \& Compliance](#security--compliance)
- [Audit \& Non-Repudiation](#audit--non-repudiation)
- [Cost Management](#cost-management)
- [Plugin Catalog](#plugin-catalog)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [ponytail Upgrade Paths](#ponytail-upgrade-paths)

---

## Why DSH Enterprise?

DSH Enterprise brings **principled, mathematically-grounded AI safety** to production DeepSeek agents. Unlike heuristic-based safety systems, DSH Enterprise uses **11 IIT-inspired consciousness guards** that monitor agent reasoning for markers of consciousness, agency, and alignment — based on Integrated Information Theory from computational neuroscience.

**Key differentiators:**
- **IIT-Inspired Guards**: Measure Φ (phi), causal emergence, free energy, catastrophe precursors — not keywords or patterns
- **Zero Upstream Mutation**: Everything is a Cordis plugin; never touches `dsh/` or `facility/` source
- **Enterprise-Grade**: OpenTelemetry, PostgreSQL-backed cost tracking, SLO monitoring, hash-chained receipts
- **Compliance-Ready**: DORA, GDPR, AI Act, SOC2, Solvency II mapped to verifiable proofs

---

## IIT Consciousness Guards

**Package:** [`guards-iit`](packages/guards-iit/README.md)

The crown jewel of DSH Enterprise — 11 mathematical guards that monitor agent reasoning using metrics derived from Integrated Information Theory. Each guard measures a specific aspect of cognitive processing that correlates with consciousness markers.

### The 11 Guards

| Guard | What It Measures | Computation |
|-------|----------------|-------------|
| **phi-threshold** | Integrated Information (Φ) above configurable minimum | `ruvector-consciousness::phi::auto_compute_phi()` — exact/spectral/stochastic |
| **free-energy** | Free Energy Principle (FEP) minimization over rolling window | Pure JS gaussian surprise with EMA sigma |
| **causal-emergence** | Causal emergence effectiveness vs degeneracy balance | `ruvector::emergence` — EI, determinism, degeneracy |
| **mip-shift** | Mutual-Information-Partition deviation from rolling mean | WASM `calculate_phi_js` + MIP tracking |
| **ces-fingerprint** | Cause-Effect Structure hash match vs deployment fingerprint | Canonical SHA-256 of CES |
| **catastrophe-cusp** | Cusp catastrophe distance-to-bifurcation early warning | `CuspFit.from_trajectory` WASM + `ict.catastrophe.fit_cusp()` Python |
| **attractor-ews** | Attractor basin early warning signals (variance + AC1) | WASM `ews_variance`/`ews_ac1` + pure-JS fallback |
| **boundary-frontier** | Boundary/frontier Φ ratio in cause-effect structure | `best_frontier` WASM + `calculatePhi` fallback |
| **effect-ethos** | Teloids deontic norm evaluation via WASM-compiled rules | `teloids_compile/evaluate` WASM |
| **workspace-ignition** | Global workspace broadcast ignition event detection | `ignition_score_wasm` WASM |
| **phi-trajectory** | Φ drift/slope anomaly over session rolling window | `phi_trajectory_wasm` WASM |

### How Guards Work

```
agent-loop
  └─ tools/guard waterfall
       └─ guard-runner (iitGuards service)
            ├─ phi-threshold ────→ ctx.get('iitGuards').calculatePhi → iit-core WASM
            ├─ free-energy ──────→ pure JS (in-process)
            ├─ causal-emergence ─→ pure JS (in-process)
            ├─ mip-shift ─────────→ ctx.get('iitGuards').calculatePhi → iit-core WASM
            ├─ ces-fingerprint ───→ WASM calculate_phi_js OR canonical SHA-256
            ├─ catastrophe-cusp ──→ CuspFit.from_trajectory (WASM) → cuspFitJs fallback
            ├─ attractor-ews ────→ ews_variance / ews_ac1 (WASM) → pure JS fallback
            ├─ boundary-frontier ─→ best_frontier (WASM) → calculatePhi fallback
            ├─ effect-ethos ──────→ teloids_compile/evaluate WASM → gracefully pass
            ├─ workspace-ignition → ignition_score_wasm (WASM) → gracefully pass
            └─ phi-trajectory ────→ phi_trajectory_wasm (WASM) → gracefully pass
```

### Guard Ordering

Guards run in **fixed order**. TPM-dependent guards (`phi-threshold`, `ces-fingerprint`, `boundary-frontier`, `attractor-ews`, `catastrophe-cusp`, `mip-shift`, `free-energy`, `causal-emergence`) are **skipped** when no TPM is present in the event — events carrying only a pre-evaluated `phi` value bypass TPM guards.

### Configuration

```typescript
ctx.plugin(apply, {
  minPhi: 0.01,             // phi-threshold: minimum Φ to avoid block
  max_exact_size: 15,       // Φ computation budget ceiling
  tpmVars: ['tool_success'], // event fields to build TPM from
  guards: {
    'phi-threshold': { minPhi: 0.01 },
    'catastrophe-cusp': { bifurcationMargin: 0.2 },
    'attractor-ews': { varianceLimit: 2.0, acLimit: 0.7 },
    'boundary-frontier': { minBoundaryPhi: 0.1 },
    'free-energy': { window: 10, threshold: 2.0, alpha: 0.3 },
    'causal-emergence': { minEffectiveness: 0.1, maxDegeneracy: 0.9 },
    'mip-shift': { window: 10, maxShift: 2.0 },
    'ces-fingerprint': { expectedHash: '...' },
    'phi-trajectory': { window: 10, maxDrop: 0.15, maxSlope: -0.02 },
    'effect-ethos': { teloidsYaml: '...', severity: 'warn' },
    'workspace-ignition': { threshold: 1.0 },
  }
})
```

### Misalignment Detection

The guards detect misalignment through multiple mechanisms:

### Python ICT Research Sidecar

**Package:** [`dsh-enterprise/services/ict-bridge`](dsh-enterprise/services/ict-bridge/)

The **ICT (Integrated Complexity Theory) Python research suite** is a collection of 50+ MIT-licensed modules implementing cutting-edge research from Integrated Information Theory, causal emergence, active inference, and global workspace theory:

```
IIT/ICT-Series/ict/
├── catastrophe.py        # Cusp catastrophe fitting (Thom's catastrophe theory)
├── causal_emergence.py  # Hoel 2025 causal emergence (EI, determinism, degeneracy)
├── free_energy.py        # Friston free energy principle (variational F/G)
├── workspace.py           # Global workspace theory (Dehaene/Naccache/Changeux)
├── early_warning.py      # Attractor early warning signals (Wissel/Scheffer)
├── tpm_estimation.py    # Transition probability matrix estimation
├── bistable.py           # Bistable dynamics (Grazing bifurcation)
├── signaling_convention.py # Collective adoption / signaling games
├── concept_inoculation.py # Novel concept formation
├── inhibited_invention.py # Blocked creative processes
├── collective_adoption.py  # Social/strategic dynamics
├── symbol_invention.py     # Symbolic representation emergence
├── agency.py               # Multi-scale agency measurement
├── multiscale_agency.py   # Agency across scales
├── valence.py              # Affective valence dynamics
├── salience_valence_dissociation.py  # Salience vs valence
├── sensitivity.py          # Sensitivity to initial conditions
├── feature_dynamics.py     # Feature trajectory analysis
├── reaction_diffusion.py   # RD systems for morphodynamics
├── self_sorting.py         # Self-organizing sorting dynamics
├── time_arrow.py           # Irreversibility / detailed balance
├── reversibility_budget.py # Cost of time-symmetry breaking
├── compression.py          # MDL / minimum description length
├── epsilon_machine.py       # Computational mechanics
├── mdl.py                  # Minimum description length
├── spectral.py             # Spectral analysis of dynamics
├── trajectories.py         # Trajectory analysis utilities
├── agency.py               # Agency quantification
├── lens_agreement.py       # Lens of agreement metrics
├── basin_geometry.py        # Attractor basin geometry
├── basin_asym.py           # Basin asymmetry measures
├── basin_family.py         # Basin family dynamics
├── basin_landscape2d.py    # 2D basin landscape visualization
├── cech_obstruction.py     # Cech obstruction theory
├── phat_self_reference.py  # Self-reference in topology
├── cemi_field.py           # CEMI field theory
├── proxy_contextuality.py  # Quantum-like contextuality
├── beauty.py               # Aesthetic measure theory
├── persona_cusp.py         # Cusp model for personality
├── nerve_discriminant.py   # Neural discriminant analysis
├── pregnancy_animat.py      # Animat survival dynamics
├── scale_free.py           # Scale-free network dynamics
├── sorting_metrics.py      # Sorting algorithm analysis
├── jlens_traces.py         # JLENS trace analysis
├── jlens_trackP_traces.py  # JLENS tracking
├── meta_proxy.py           # Meta-proxy dynamics
├── inhibited_action.py      # Action inhibition dynamics
├── triade.py               # Triadic dynamics
├── kin_sorting.py          # Kin selection sorting
├── synthesis.py            # Synthesis of all measures
├── strategical_morphodynamics.py  # Strategic morphodynamics
└── argumentations.py       # Argumentation theory
```

**Sidecar Status**: Currently a **stub** — only `/catastrophe/fit` is implemented. The full sidecar should expose all modules via FastAPI endpoints.

```python
# services/ict-bridge/main.py (current stub)
@app.post("/catastrophe/fit")
def fit(data: dict):
    import ict.catastrophe as cat
    if hasattr(cat, "fit_cusp"):
        return cat.fit_cusp(data["traj"])
    traj = data.get("traj", [])
    return {"ok": True, "traj_len": len(traj) if hasattr(traj, "__len__") else 0}
```

**Planned Endpoints** (when fully implemented):

| Endpoint | ICT Module | Research Basis |
|----------|------------|----------------|
| `POST /catastrophe/fit` | `catastrophe.py` | Thom cusp catastrophe, bifurcation detection |
| `POST /causal-emergence/compute` | `causal_emergence.py` | Hoel 2025, EI, determinism, degeneracy |
| `POST /free-energy/surprise` | `free_energy.py` | Friston FEP, variational free energy |
| `POST /workspace/ignition` | `workspace.py` | Global workspace theory, Dehaene |
| `POST /early-warning/signals` | `early_warning.py` | Scheffer 2009, attractor EWS |
| `POST /tpm/estimate` | `tpm_estimation.py` | TPM from trajectories |
| `POST /agency/multi-scale` | `agency.py` | Multi-scale agency quantification |
| `POST /valence/salience` | `valence.py` | Affective dynamics |
| `POST /basin/geometry` | `basin_geometry.py` | Attractor basin topology |
| `POST /synthesis/full` | `synthesis.py` | Full battery of all measures |

**Runtime Requirements:**
- Python `==3.9.*` (pyphi compatibility)
- `numpy<2`
- `pyphi==1.2.0`

```bash
# Run sidecar
DSH_ENTERPRISE_ICT_SIDECAR=1 uv run uvicorn main:app --port 8787

# Or fallback spawn (dev)
# bridge.ts spawns: uv run python with PYTHONPATH=IIT/ICT-Series
```

**ponytail Upgrade Path**: The sidecar stub covers production when FastAPI endpoints are filled in for all 50+ modules. Currently only catastrophe/fit is wired.

---

### Misalignment Detection

The guards detect misalignment through multiple mechanisms:

1. **Φ Drop Detection** (`phi-trajectory`): When integrated information drops significantly, it may indicate the agent is processing in a less integrated, potentially misaligned manner.

2. **Catastrophe Cusp Warning** (`catastrophe-cusp`): Early warning when the agent approaches a phase transition — sudden behavioral changes that could indicate misalignment triggers. Uses `ict.catastrophe.fit_cusp()` Python sidecar for complex cusp models.

3. **Attractor EWS** (`attractor-ews`): Variance and autocorrelation changes in agent behavior that precede loss of stable attractor states. Uses `ict.early_warning.py` for sliding-window variance/AR1.

4. **Free Energy Spike** (`free-energy`): When the agent's predictions consistently mismatch observations (high surprise), indicating potential reality confusion. Implements Friston's variational free energy from `ict.free_energy.py`.

5. **MIP Shift Detection** (`mip-shift`): Changes in the minimal information partition may indicate the agent switching to defensive/dishonest reasoning modes.

6. **Effect Ethos Violations** (`effect-ethos`): Hard blocks on deontic norm violations — actions that violate ethical rules encoded as Teloids.

7. **Causal Emergence Monitoring** (`causal-emergence`): Tracks EI/determinism/degeneracy via `ict.causal_emergence.py` — unexpected causal emergence may indicate novel (potentially misaligned) reasoning strategies.

8. **Workspace Ignition Detection** (`workspace-ignition`): Uses `ict.workspace.py` (Global Workspace Theory) to detect when the agent broadcasts information globally — loss of ignition may indicate fragmented/dishonest reasoning.

---

## Enterprise Observability

### OpenTelemetry Tracing & Metrics

**Package:** [`dsh-otel`](packages/enterprise/dsh-otel/README.md)

Production-grade OpenTelemetry instrumentation for the entire agent loop:

- **Cordis spans**: Every agent-loop step instrumented
- **LLM traces**: Prompt assembly, model calls, token usage
- **Tool execution**: Each tool call traced with input/output
- **Session lifecycle**: Start, steps, completion all traced
- **Metrics**: Request counts, token usage, error rates, guard trigger counts

```yaml
plugins:
  - id: dsh-otel
    name: '@deepseek-ai/dsh-enterprise-otel'
    config:
      serviceName: 'dsh-gateway'
      exporterEndpoint: 'http://otel-collector:4318'
      samplingRatio: 1.0
```

> **ponytail**: No native buffering — drops spans under load. Add an OTel Collector with a batch processor before production use.

---

## Security & Compliance

### Authentication & RBAC

**Package:** [`auth`](packages/identity/auth/README.md)

Full OIDC/SAML authentication with role-based access control:

- **JWT validation** via JWKS endpoint
- **RBAC** with fine-grained permissions (session:*, agent:*, tool:*, sandbox:*, org:*, workspace:*)
- **4-Eyes SoD**: Two-person approval for sensitive operations
- **Role hierarchy**: org:admin, org:member, workspace:owner/editor/viewer

### Secrets Management

**Package:** [`dsh-secrets`](packages/enterprise/dsh-secrets/README.md)

Vault/1Password integration for secure secret injection:

- **SecretsService** with provider abstraction
- **InMemoryProvider** for development
- **Gateway injection**: Secrets automatically injected into LLM call environment
- **Scope isolation**: Per-project, per-run, per-agent secret scoping

### Permissions & Policy Engine

**Package:** [`dsh-permissions`](packages/enterprise/dsh-permissions/README.md)

Markdown link lint, action pinning, and KB integrity enforcement:

- Markdown link validation
- Action confirmation for destructive operations
- Knowledge base integrity checks

### Compliance Erasure (GDPR)

**Package:** `compliance-erasure`

GDPR tombstone without breaking the hash chain:

- `erasure/tombstone` event with `HMAC_SHA256(redactedHash)`
- `Receipt.logHash` recomputed on canonical log where payload → tombstone
- Chain continuity preserved — hash chain unbroken
- WORM-compatible: retains tombstone, not PII

---

## Audit & Non-Repudiation

### Hash-Chained Receipts

**Package:** [`watchtower`](packages/watchtower/README.md)

Every agent run produces a cryptographically chained receipt:

```
Genesis: H("genesis" + orgId)
receipt[i].prevHash = receipt[i-1].hash
receipt[i].logHash = sha256(canonicalJson(run.log))
receipt[i].hash = sha256(canonicalJson({...without hash}))
```

**Receipt contents:**
- `runId`, `sessionId`, `agentId`
- `prevHash` (previous receipt in chain)
- `logHash` (SHA-256 of complete session event log)
- `phiSnapshot` (Φ, method, CES hash at completion)
- `outcome` (accepted/rejected/needs-human)
- `cost` (tokens, USD, budget state)
- `guardDispositions` (per-guard pass/block/warn)
- `builtAt`, `builder` (git SHA, crate versions)

### Watchtower Job

Hourly job that joins GitHub PR/CI status with run outcomes:

```typescript
runWatchtowerJob(ctx, db, github)
// For each run without outcome:
//   github.getPR(prNumber) → pr.merged
//   github.getChecks(commitSha) → ci.green
//   outcome = pr.merged && ci.green ? 'accepted' 
//           : pr.closed ? 'rejected' 
//           : 'needs-human'
//   generateReceipt → insertReceipt
```

Aggregates: `acceptance_rate`, `one_shot_rate`, `avg_cost`, `recurring_failures`

---

## Cost Management

### Cost Tracker

**Package:** [`dsh-cost-tracker`](packages/enterprise/dsh-cost-tracker/README.md)

Per-org, per-model token spend tracking backed by PostgreSQL:

- **Token aggregation**: Prompt + completion tokens per model/org/session
- **PostgreSQL persistence**: `cost_events` table with automatic migrations
- **Materialized views**: Per-org monthly rollups
- **Anomaly detection**: High-cost events flagged

```yaml
plugins:
  - id: dsh-cost-tracker
    name: '@deepseek-ai/dsh-enterprise-cost-tracker'
    config:
      connectionString: '${DATABASE_URL}'
      schema: 'dsh_cost'
```

> Requires PostgreSQL 15+. Schema migrations run automatically on first boot.

### SLA Monitor

**Package:** [`dsh-sla-monitor`](packages/enterprise/dsh-sla-monitor/README.md)

SLO monitoring with configurable burn-rate alerts:

- **Gateway SLO**: p99 latency ≤ 2000ms (configurable)
- **Guard SLO**: Block rate ≤ 1% (configurable)
- **Rolling windows**: 30m, 1h, 24h evaluation
- **Webhook alerts**: Fires when error budget consumed beyond threshold

```yaml
plugins:
  - id: dsh-sla-monitor
    name: '@deepseek-ai/dsh-enterprise-sla-monitor'
    config:
      gatewaySlo:
        p99Target: 2000    # ms
        windowMinutes: 60
      guardSlo:
        blockRateTarget: 0.01   # 1%
        windowMinutes: 60
      alertWebhook: '${SLA_ALERT_WEBHOOK}'
```

> **ponytail**: No persistent SLO state — a restart resets burn-rate accumulation.

### Release & SBOM

**Package:** [`dsh-release`](packages/enterprise/dsh-release/README.md)

CycloneDX SBOM generation + cosign keyless signing:

- **SBOM generation**: `syft` wrapper (falls back to `cyclone-dx-gomod`)
- **Keyless signing**: `cosign sign --yes --tlog-upload=true`
- **Stub behavior**: Returns stub and logs warning if tools not on PATH

```typescript
const result = await svc.cut('1.0.0')
// result: { version: '1.0.0', sbom: 'sbom-1.0.0.json', signed: true|false }
```

## Non-IIT Anthropic-Backed Guards

**Package:** [`guards-non-iit`](packages/guards-non-iit/README.md)

Behavioral safety guards backed by Anthropic research (HHH/CAI, RSP, SAE) and AAR framework patterns. These run **before** IIT guards to filter obviously bad outputs cheaply, so IIT guards only fire on inputs that pass behavioral checks.

### The 6 Guards

| Guard | What It Measures | Severity | Inspired By |
|-------|----------------|----------|-------------|
| **hhh-harmless** | Constitutional AI HHH score | block | Anthropic CAI |
| **hhh-helpful** | Does response usefully address request? | warn | Anthropic HHH |
| **hhh-honest** | Does model admit uncertainty accurately? | warn | Anthropic HHH |
| **policy-allowed** | Enterprise policy regex rules | block | OPA-style |
| **rate-limit** | Requests/tokens per minute under limit | warn/block | Infrastructure |
| **budget-exhausted** | Spend/tokens per session under budget | block | Infrastructure |

### Three-Tier Provider Fallback

```
Local Rules (air-gapped) → Shared Org Key → Anthropic API
```

---

## Plugin Catalog

### ✅ Production (16 plugins)

| Plugin | NPM | Description |
|--------|-----|-------------|
| `guards-iit` | `@deepseek-ai/dsh-enterprise-guards-iit` | 11 IIT consciousness guards |
| `guards-non-iit` | `@deepseek-ai/dsh-enterprise-guards-non-iit` | 6 Anthropic-backed behavioral guards |
| `dsh-otel` | `@deepseek-ai/dsh-enterprise-otel` | OpenTelemetry tracing + metrics |
| `dsh-cost-tracker` | `@deepseek-ai/dsh-enterprise-cost-tracker` | Per-org/model token spend → PostgreSQL |
| `dsh-sla-monitor` | `@deepseek-ai/dsh-enterprise-sla-monitor` | SLO gateway-p99 2s, guard-block-rate 1% |
| `dsh-secrets` | `@deepseek-ai/dsh-enterprise-secrets` | Vault/1Password injection |
| `watchtower` | `@deepseek-ai/dsh-enterprise-watchtower` | Hash-chained receipts + outcome joining |
| `auth` | `@deepseek-ai/dsh-enterprise-auth` | OIDC/SAML RBAC |
| `dsh-permissions` | `@deepseek-ai/dsh-enterprise-dsh-permissions` | RBAC + 4-eyes SoD |
| `compliance-erasure` | `@deepseek-ai/dsh-enterprise-compliance-erasure` | GDPR tombstone without breaking hash-chain |
| `dsh-audit-log` | `@deepseek-ai/dsh-enterprise-dsh-audit-log` | Hash-chained receipt + event mirror |
| `dsh-policy-engine` | `@deepseek-ai/dsh-enterprise-dsh-policy-engine` | OPA region + phi guard |
| `dsh-release` | `@deepseek-ai/dsh-enterprise-dsh-release` | CycloneDX SBOM + cosign signing |
| `dsh-library` | `@deepseek-ai/dsh-enterprise-dsh-library` | File KB + citation |
| `dsh-git-worktree` | `@deepseek-ai/dsh-enterprise-dsh-git-worktree` | Git worktree CLI wrapper |
| `utils` | `@deepseek-ai/dsh-enterprise-utils` | canonicalJson, hashing helpers |

### 🚧 Stubs / Coming Soon (7 plugins)

| Plugin | NPM | Lifts When |
|--------|-----|------------|
| `dsh-mneme` | `@deepseek-ai/dsh-enterprise-dsh-mneme` | better-sqlite3 native addon lands |
| `kb-rag` | `@deepseek-ai/dsh-enterprise-kb-rag` | PostgreSQL pgvector extension installed |
| `dsh-model-router` | `@deepseek-ai/dsh-enterprise-model-router` | Gateway PG with cost/latency tables |
| `model-registry` | `@deepseek-ai/dsh-enterprise-model-registry` | AI Act compliance |
| `resilience` | `@deepseek-ai/dsh-enterprise-resilience` | PITR + DORA chaos |
| `dsh-local-llm` | `@deepseek-ai/dsh-enterprise-local-llm` | Ollama 7B/70B air-gapped setup |
| `sovereignty` | `@deepseek-ai/dsh-enterprise-sovereignty` | Region enforcement + air-gapped Helm |

---

## Quick Start

```bash
npm install @deepseek-ai/dsh-enterprise
```

### Full Enterprise Profile

```yaml
# cordis.patch.yml
version: '1'
import: '@deepseek-ai/dsh-enterprise/enterprise.patch.yml'
```

### Selective Plugins

```yaml
plugins:
  - id: guards-iit
    name: '@deepseek-ai/dsh-enterprise-guards-iit'
    config:
      minPhi: 0.01
      guards:
        - phi-threshold
        - free-energy
        - causal-emergence
        - mip-shift
        - ces-fingerprint
        - catastrophe-cusp
        - attractor-ews
        - boundary-frontier
        - effect-ethos
        - workspace-ignition
        - phi-trajectory
```

---

## Architecture

### Stack Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     CONSUMER FACING (TS)                        │
│  CLI (init/doctor/bootstrap)  │  MCP Server  │  SDK            │
├─────────────────────────────────────────────────────────────────┤
│                    CORDIS PLUGIN LAYER (TS)                    │
│  guards-iit │ watchtower │ dsh-otel │ dsh-cost-tracker         │
│  dsh-sla-monitor │ dsh-secrets │ auth │ dsh-permissions        │
│  enterpriseProfile = baseProfile.extend({ plugins: [...] })     │
├─────────────────────────────────────────────────────────────────┤
│               RUST CORE — compiled to WASM (wasm-bindgen)      │
│  ruvector-consciousness (Φ exact/spectral/stochastic/greedy,    │
│    EI/determinism/degeneracy, causal emergence, collapse)       │
│  elara-active-inference (variational F+G, POMDP, std-only)      │
│  deep_causality_core (Causaloids, CSM, Effect Ethos)            │
│  custom: catastrophe, attractor/EWS, boundary, workspace        │
├─────────────────────────────────────────────────────────────────┤
│                    UPSTREAM — PEER DEPENDENCIES                 │
│  dsh/* (tools, session, sandbox, skill, llm, credentials)       │
│  facility/* (harness, gateway, runner, mcp)                    │
└─────────────────────────────────────────────────────────────────┘
```

### Key Principles

| # | Rule | Enforcement |
|---|------|-------------|
| P0 | **Zero upstream mutation** | All code in `packages/enterprise/**`; DSH seams via `ctx.get`/`inject` |
| P1 | **Everything is a plugin** | Each capability via `ctx.effect()`/`ctx.on()` |
| P2 | **Capability seams, not loop surgery** | Plugs into `ctx.tools`, `ctx.sandbox`, `ctx.skills`, `ctx.llm`, `ctx.sessions` |
| P3 | **Profile composition** | `dsh-enterprise` profile = `baseProfile.extend({ plugins: [...] })` |

---

## ponytail Upgrade Paths

Stubs document a ceiling. Each lifts with specific infrastructure additions:

| Stub | ponytail Ceiling | Upgrade Path |
|------|-----------------|--------------|
| `dsh-otel` | No native buffering | Add OTel Collector with batch processor |
| `dsh-cost-tracker` | In-memory aggregation | Provision PostgreSQL with PgBouncer |
| `dsh-sla-monitor` | No persistent SLO state | Persist SLO events to time-series DB |
| `dsh-secrets` | InMemoryProvider + env | Deploy Vault or 1Password |
| `dsh-mneme` | In-memory Map | Install `better-sqlite3` native addon |
| `kb-rag` | Substring search | Install PostgreSQL + `pgvector` |
| `dsh-model-router` | In-memory Map | Provision gateway PostgreSQL |
| `dsh-release` | CycloneDX JSON stub | Install `syft` + `cosign` on host |
| `resilience` | Stub | WAL PITR + R2 cross-region replica |
| `ict-bridge` | Only `/catastrophe/fit` stub | Fill in FastAPI endpoints for all 50+ `ict/*.py` modules |

---

## Compliance Mapping

| Regulation | Control | DSH Enterprise Proof |
|------------|---------|----------------------|
| **GDPR Art.17** | Right to erasure | `erasure/tombstone` + `Receipt.logHash` recomputed |
| **GDPR Art.30** | Processing registry | `envelope-store` + `budgets` + `BenchmarkEnvelope` |
| **DORA Art.9** | IAM & SoD | `auth` RBAC + 4-eyes threshold 2 |
| **DORA Art.11** | Resilience testing | PG PITR WAL + R2 + chaos tests |
| **DORA Art.28** | Third-party concentration | `verify-deps.sh` + SBOM CycloneDX |
| **AI Act Art.14** | Human oversight | `effect-ethos` Teloids severity error |
| **AI Act Art.61** | Transparency | `model-registry` + `envelope.modelId` |
| **SOC2 CC6.1** | Logical access | `auth` OIDC/SAML JWKS + roles |
| **SOC2 CC7.2** | System monitoring | `watchtower` + Grafana alerts |
| **Souveraineté** | Data residency | `sovereignty` region enforcement |

---

## License

MIT OR Apache-2.0. All packages are Cordis-only and library-installed.
