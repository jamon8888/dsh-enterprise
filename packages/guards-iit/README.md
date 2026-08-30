# guards-iit — IIT-Inspired Consciousness Guards

**IIT-Inspired Consciousness Guards for DeepSeek Harness**

11 guards measuring markers of consciousness in agent reasoning:
- **phi-threshold** — integrated information (Φ) above configurable minimum
- **free-energy** — free energy principle (FEP) minimization over rolling window
- **causal-emergence** — causal emergence effectiveness vs degeneracy balance
- **mip-shift** — mutual-information-partition (MIP) deviation from rolling mean
- **ces-fingerprint** — conscious energy signature hash match vs deployment fingerprint
- **catastrophe-cusp** — cusp catastrophe distance-to-bifurcation early warning
- **attractor-ews** — attractor basin early warning signals (variance + AC1)
- **boundary-frontier** — boundary/frontier Φ ratio in cause-effect structure
- **effect-ethos** — Teloids deontic norm evaluation via WASM-compiled rules
- **workspace-ignition** — global workspace broadcast ignition event detection
- **phi-trajectory** — Φ drift/slope anomaly over session rolling window

## Quick Start

```typescript
import { apply } from '@deepseek-ai/dsh-enterprise-guards-iit'

// In your cordis.patch.yml or app plugin registration:
ctx.plugin(apply, {
  minPhi: 0.01,       // phi-threshold: block below this Φ
  tpmVars: ['tool_success'],
})
```

## Architecture

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

## Guard ordering

Guards run in fixed order. TPM-dependent guards (`phi-threshold`, `ces-fingerprint`, `boundary-frontier`, `attractor-ews`, `catastrophe-cusp`, `mip-shift`, `free-energy`, `causal-emergence`) are skipped when no TPM is present in the event — events carrying only a pre-evaluated `phi` value bypass TPM guards.

## Configuration

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

## ponytail upgrade paths

| Guard | ponytail ceiling |
|-------|-----------------|
| phi-threshold | WASM `calculate_phi_js` is 50x faster than pure-JS Φ computation — upgrade when guard latency matters |
| catastrophe-cusp | Pure JS `cuspFitJs` covers the full cusp model; ICT Python sidecar can replace WASM for complex catastrophe models |
| attractor-ews | WASM `ews_variance`/`ews_ac1` provides ~10x speedup; add when performance-critical guard chain uses EWS |
| effect-ethos | WASM Teloids compiler is the production path; pure-JS fallback gracefully passes when unavailable |
| workspace-ignition | WASM `ignition_score_wasm` is the production path; gracefully passes when unavailable |
