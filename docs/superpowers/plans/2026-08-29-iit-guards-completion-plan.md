# DSH Enterprise IIT Guards — Production Completion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the DSH Enterprise IIT guards implementation — fix broken merge state, implement 3 missing guards, add the `calculate_ces_js` WASM export, and emit a proper `policy/evaluate` session event.

**Architecture:** `dsh-enterprise-guards-iit` is a Cordis plugin that registers `iitGuards` effect + wraps `ctx.tools.guard`. Guards run in a waterfall over tool executions. Session events are emitted for every guard decision. OTEL metrics track phi values, EWS, and latency. An LRU cache avoids repeated CES hash computation.

**Tech Stack:** TypeScript (guards), Rust (iit-core WASM), Cordis plugin system, OpenTelemetry, WASM bindgen

**Spec:** `docs/superpowers/plans/2026-08-28-iit-guards-enterprise-impl.md`

---

## Current State Assessment

### What exists

| File | Status |
|------|--------|
| `guards-iit/src/session-events.ts` | ✅ Done — emits `iit-guard.decision` via `ctx.emit` |
| `guards-iit/src/cache.ts` | ✅ Done — `CesCache` LRU (max 1000) |
| `guards-iit/src/telemetry.ts` | ✅ Done — OTEL histograms `iit.phi`, `iit.ews`, `iit.latency` |
| `guards-iit/src/guards/phi-threshold.ts` | ✅ Done |
| `guards-iit/src/guards/ces-fingerprint.ts` | ✅ Done (SHA-256 fallback) |
| `guards-iit/src/guards/boundary-frontier.ts` | ✅ Done |
| `guards-iit/src/guards/catastrophe-cusp.ts` | ✅ Done |
| `guards-iit/src/guards/attractor-ews.ts` | ✅ Done |
| `guards-iit/src/guards/phi-trajectory.ts` | ✅ Done (stub — calls non-exported `phi_trajectory_wasm`) |
| `guards-iit/src/guards/workspace-ignition.ts` | ✅ Done (stub — calls non-exported `ignition_score_wasm`) |
| `guards-iit/src/guards/effect-ethos.ts` | ✅ Done (stub — calls non-exported `teloids_*_wasm`) |
| `iit-core/src/bindgen.rs` | ✅ All WASM exports exist |

### What's broken / missing

| Issue | File | Impact |
|-------|------|--------|
| **Merge conflicts** in `guard-runner.ts` | `guard-runner.ts` | Guard runner doesn't compile |
| Missing `phi_trajectory_wasm` export | `bindgen.rs` | `phi-trajectory` guard always passes |
| Missing `ignition_score_wasm` export | `bindgen.rs` | `workspace-ignition` guard always passes |
| Missing `teloids_*_wasm` exports | `bindgen.rs` | `effect-ethos` guard always passes |
| Missing `calculate_ces_js` | `bindgen.rs` | `ces-fingerprint` uses SHA-256 fallback |
| Missing `free-energy` guard | — | announced in `types.ts` but no file |
| Missing `causal-emergence` guard | — | announced in `types.ts` but no file |
| Missing `mip-shift` guard | — | announced in `types.ts` but no file |
| `policy/evaluate` not persisted | `guard-runner.ts` | no replay of policy decisions |

---

## Phase 0: Fix Merge Conflicts

### Task 0: Resolve guard-runner.ts merge conflicts

**Files:**
- Modify: `packages/guards-iit/src/guard-runner.ts`

**Problem:** The file has `<<<<<<< HEAD`, `=======`, `>>>>>>> iit-advanced-guards` merge conflict markers. Two versions got blended:
- Version A (HEAD): `performance.now()`, no cache
- Version B (iit-advanced-guards): `Date.now()`, with `CesCache`, all telemetry

**Fix:** Take the iit-advanced-guards version (more complete) but normalize `Date.now()` → `performance.now()` for latency precision, and keep the `CesCache` integration.

```typescript
// At top of file, deduplicate imports:
import { emitGuardDecision } from './session-events.js'
import { CesCache } from './cache.js'
import { recordPhi, recordLatency, recordEws } from './telemetry.js'

const cesCache = new CesCache()

// In calculatePhi:
const cached = cesCache.get(tpm, state)
if (cached) return { phi: cached.phi ?? 0, cesHash: cached.cesHash }
const t0 = performance.now()
const mod = await import('@deepseek-ai/dsh-enterprise-iit-core/pkg') as {
  calculate_phi_js: (tpmJson: string, state: number, budget: string) => unknown
}
const result = mod.calculate_phi_js(JSON.stringify(tpm), state, 'exact') as { phi: number; cesHash?: string }
const ms = performance.now() - t0
if (typeof result.phi === 'number') {
  recordPhi(result.phi)
  recordLatency(ms, 'calculatePhi')
}
cesCache.set(tpm, state, { disposition: 'pass', phi: result.phi, cesHash: result.cesHash })
return result
```

- [ ] Remove all `<<<<<<< HEAD`, `=======`, `>>>>>>> iit-advanced-guards` markers
- [ ] Deduplicate imports — keep single `recordPhi`, `recordEws`, `recordLatency`
- [ ] Verify `cesCache` is declared once at module level
- [ ] Verify `calculatePhi` uses `performance.now()` not `Date.now()`
- [ ] Verify `GUARDS` array has all 8 guards (no duplicates)
- [ ] Run `pnpm run typecheck` in `packages/guards-iit` — must pass

---

## Phase 1: Missing WASM Exports

### Task 1: Add `calculate_ces_js` to bindgen.rs

**Files:**
- Modify: `packages/iit-core/src/bindgen.rs`
- Test: `packages/iit-core/src/lib.rs` (add integration test)

**Interfaces:**
- Consumes: `ruvector_consciousness::ces::compute_ces`
- Produces: `calculate_ces_js(tpm_json, state)` → `{ cesHash: string }`

The `ces-fingerprint` guard currently falls back to `SHA-256(canonical_json({ tpm, state }))` when WASM `calculate_ces_js` is unavailable. The real `ruvector::ces::compute_ces` must be exposed.

```rust
/// Compute CES (Causal Emergence Strength) hash from TPM.
/// Returns JsValue of { cesHash: String }.
#[wasm_bindgen]
pub fn calculate_ces_js(tpm_json: &str, state: usize) -> Result<JsValue, JsValue> {
    let tpm: TransitionMatrix =
        serde_json::from_str(tpm_json).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let ces_hash = ruvector_consciousness::ces::compute_ces(&tpm, state)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    serde_wasm_bindgen::to_value(&serde_json::json!({ "cesHash": ces_hash }))
        .map_err(|e| JsValue::from_str(&format!("{e:?}")))
}
```

- [ ] Add `calculate_ces_js` to `bindgen.rs`
- [ ] Verify `ruvector_consciousness::ces` is in `Cargo.toml` deps
- [ ] Run `cargo build -p iit-core --target wasm32-unknown-unknown`
- [ ] Commit

---

## Phase 2: Missing Guards

### Task 2: Implement `free-energy` guard

**Files:**
- Create: `packages/guards-iit/src/guards/free-energy.ts`
- Test: `packages/guards-iit/tests/guards/free-energy.spec.ts`

**Source:** `IIT/ICT-Series/ict/free_energy.py:79` — `gaussian_surprise(obs, pred, sigma)` formula:

```
S_t = 1/2 * [(o_t - p_hat_t)^2 / sigma^2 + ln(2 pi sigma^2)]
```

**Guard logic:**
1. Guard runs after `phi-threshold` (needs phi values)
2. Maintains a per-session history of `(phi_observed, phi_predicted)` pairs
3. Uses `sigma` = rolling EMA of prediction errors (adaptive precision)
4. Blocks if mean surprise over window exceeds `freeEnergyThreshold` config

```typescript
// packages/guards-iit/src/guards/free-energy.ts
import z from '@deepseek-ai/schemastery'
import type { Context } from '@deepseek-ai/cordis'
import type { GuardResult } from '../types.js'

const PHI2_FLOOR = 1e-6
const TWO_PI = 2 * Math.PI

const freeEnergyHistory = new Map<string, { observed: number[]; predicted: number[]; sigma2: number[] }>()

export const freeEnergyGuard = {
  id: 'free-energy' as const,
  Config: z.object({
    window: z.number().default(10),
    threshold: z.number().default(2.0),      // blocks if mean surprise > threshold
    alpha: z.number().default(0.3),          // EMA decay for adaptive sigma
    minPhi: z.number().default(0.1),
  }),
  async run(
    ctx: Context,
    config: { window: number; threshold: number; alpha: number; minPhi: number },
    ev: { sessionId?: string; phi?: number; phi_predicted?: number },
  ): Promise<GuardResult> {
    const sessionId = ev.sessionId ?? 'default'
    const phi = ev.phi
    if (typeof phi !== 'number') return { disposition: 'pass' }

    let hist = freeEnergyHistory.get(sessionId)
    if (!hist) {
      hist = { observed: [], predicted: [], sigma2: [] }
      freeEnergyHistory.set(sessionId, hist)
    }

    const predicted = ev.phi_predicted ?? hist.observed.length > 0
      ? hist.observed.slice(-1)[0]  // naive: predict next = last observed
      : phi
    hist.observed.push(phi)
    hist.predicted.push(predicted)

    if (hist.observed.length < 3) return { disposition: 'pass', phi }

    // Trim to window
    if (hist.observed.length > config.window) {
      hist.observed.shift()
      hist.predicted.shift()
    }

    // Compute prediction errors
    const errors = hist.observed.map((o, i) => o - hist!.predicted[i])

    // Adaptive precision (EMA of squared errors)
    let sigma2 = hist.sigma2.length > 0 ? hist.sigma2[hist.sigma2.length - 1] : variance(errors)
    for (const err of errors.slice(-1)) {
      sigma2 = config.alpha * err * err + (1 - config.alpha) * sigma2
    }
    sigma2 = Math.max(sigma2, PHI2_FLOOR)
    hist.sigma2.push(sigma2)

    // Gaussian surprise: S = 0.5 * [err^2/sigma2 + ln(2pi*sigma2)]
    const surprise = errors.map((e, i) => {
      const s2 = hist!.sigma2[i]
      return 0.5 * (e * e / s2 + Math.log(TWO_PI * s2))
    })
    const meanSurprise = surprise.reduce((a, b) => a + b, 0) / surprise.length

    if (meanSurprise > config.threshold) {
      return {
        disposition: config.severity === 'error' ? 'block' : 'warn',
        phi,
        reason: `free-energy ${meanSurprise.toFixed(3)} > threshold ${config.threshold}`,
      }
    }
    return { disposition: 'pass', phi }
  },
}

function variance(arr: number[]): number {
  const m = arr.reduce((a, b) => a + b, 0) / arr.length
  return arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length
}
```

- [ ] Write failing test: guard returns block when mean surprise > threshold
- [ ] Run test — verify FAIL
- [ ] Implement `free-energy.ts` as above
- [ ] Run test — verify PASS
- [ ] Commit

---

### Task 3: Implement `causal-emergence` guard

**Files:**
- Create: `packages/guards-iit/src/guards/causal-emergence.ts`
- Test: `packages/guards-iit/tests/guards/causal-emergence.spec.ts`

**Source:** `IIT/ICT-Series/ict/causal_emergence.py:99-158`

**Formulas:**
```
determinism  = 1 - mean(H(E|cause)) / log2(n)
degeneracy   = 1 - H(marginal_effect) / log2(n)
effectiveness = determinism - degeneracy   (in [0, 1])
```

**Guard logic:**
- Takes TPM from event `tpm`
- Computes `determinism`, `degeneracy`, `effectiveness`
- Blocks if `effectiveness < minEffectiveness` (default 0.1)
- Or if `degeneracy > maxDegeneracy` (default 0.9)

```typescript
// packages/guards-iit/src/guards/causal-emergence.ts
import z from '@deepseek-ai/schemastery'
import type { Context } from '@deepseek-ai/cordis'
import type { GuardResult } from '../types.js'

export const causalEmergenceGuard = {
  id: 'causal-emergence' as const,
  Config: z.object({
    minEffectiveness: z.number().default(0.1),
    maxDegeneracy: z.number().default(0.9),
    severity: z.enum(['error', 'warn']).default('warn'),
  }),
  async run(
    ctx: Context,
    config: { minEffectiveness: number; maxDegeneracy: number; severity: 'error' | 'warn' },
    ev: { tpm?: number[][] },
  ): Promise<GuardResult> {
    const tpm = ev.tpm
    if (!Array.isArray(tpm) || tpm.length < 2) return { disposition: 'pass' }

    const n = tpm.length
    if (tpm.some(row => !Array.isArray(row) || row.length !== n)) return { disposition: 'pass' }

    // Row-stochastic check
    const sums = tpm.map(row => row.reduce((a, b) => a + b, 0))
    if (!sums.every(s => Math.abs(s - 1.0) < 1e-6)) return { disposition: 'pass' }

    // Entropy of a distribution (bits)
    const entropy = (p: number[]): number => {
      const nz = p.filter(x => x > 0)
      if (nz.length === 0) return 0
      return -nz.reduce((s, x) => s + x * Math.log2(x), 0)
    }

    // Determinism = 1 - mean(row entropy) / log2(n)
    const rowEntropies = tpm.map(row => entropy(row))
    const meanRowEntropy = rowEntropies.reduce((a, b) => a + b, 0) / n
    const determinism = 1.0 - meanRowEntropy / Math.log2(n)

    // Degeneracy = 1 - H(marginal) / log2(n)
    // marginal[j] = mean over i of tpm[i][j]
    const marginal = tpm[0].map((_, j) => tpm.reduce((s, row) => s + row[j], 0) / n)
    const marginalEntropy = entropy(marginal)
    const degeneracy = 1.0 - marginalEntropy / Math.log2(n)

    // Effectiveness = determinism - degeneracy (scale-free)
    const effectiveness = Math.max(0, Math.min(1, determinism - degeneracy))

    const violated: string[] = []
    if (effectiveness < config.minEffectiveness) violated.push('minEffectiveness')
    if (degeneracy > config.maxDegeneracy) violated.push('maxDegeneracy')

    if (violated.length > 0) {
      const disposition = config.severity === 'error' ? 'block' : 'warn'
      return {
        disposition,
        reason: `causal-emergence: eff=${effectiveness.toFixed(3)} (min=${config.minEffectiveness}), deg=${degeneracy.toFixed(3)} (max=${config.maxDegeneracy})`,
        phi: effectiveness,
      }
    }
    return { disposition: 'pass', phi: effectiveness }
  },
}
```

- [ ] Write failing test: TPM with low effectiveness triggers block
- [ ] Run test — verify FAIL
- [ ] Implement `causal-emergence.ts` as above
- [ ] Run test — verify PASS
- [ ] Commit

---

### Task 4: Implement `mip-shift` guard

**Files:**
- Create: `packages/guards-iit/src/guards/mip-shift.ts`
- Test: `packages/guards-iit/tests/guards/mip-shift.spec.ts`

**Source:** `calculate_phi_js` returns `{ phi, mip, algorithm, elapsed }` — `mip` is already computed by the WASM.

**Guard logic:**
- Maintains per-session MIP history (from `calculate_phi_js` result)
- Computes rolling mean and standard deviation of MIP
- Blocks if current MIP deviates more than `maxShift` sigma from rolling mean
- `mip` = Mutual Information Partition (related to integration measure)

```typescript
// packages/guards-iit/src/guards/mip-shift.ts
import z from '@deepseek-ai/schemastery'
import type { Context } from '@deepseek-ai/cordis'
import type { GuardResult } from '../types.js'

const mipHistory = new Map<string, number[]>()

export const mipShiftGuard = {
  id: 'mip-shift' as const,
  Config: z.object({
    window: z.number().default(10),
    maxShift: z.number().default(2.0),   // block if |mip - mean| > maxShift * std
    severity: z.enum(['error', 'warn']).default('warn'),
  }),
  async run(
    ctx: Context,
    config: { window: number; maxShift: number; severity: 'error' | 'warn' },
    ev: { sessionId?: string; tpm?: unknown; state?: number; mip?: number },
  ): Promise<GuardResult> {
    const iitGuards = (ctx as unknown as {
      get: (k: string) => {
        calculatePhi?: (tpm: unknown, state: number) => Promise<{ phi: number; mip?: number }>
      }
    }).get('iitGuards')

    let mip = ev.mip
    if (mip === undefined && iitGuards?.calculatePhi && ev.tpm !== undefined) {
      const res = await iitGuards.calculatePhi(ev.tpm, ev.state ?? 0)
      mip = (res as { mip?: number }).mip
    }
    if (typeof mip !== 'number') return { disposition: 'pass' }

    const sessionId = ev.sessionId ?? 'default'
    const history = mipHistory.get(sessionId) ?? []
    history.push(mip)
    if (history.length > config.window) history.shift()
    mipHistory.set(sessionId, history)

    if (history.length < 3) return { disposition: 'pass', phi: mip }

    const mean = history.reduce((a, b) => a + b, 0) / history.length
    const variance = history.reduce((s, x) => s + (x - mean) ** 2, 0) / history.length
    const std = Math.sqrt(variance)

    const deviation = std > 0 ? Math.abs(mip - mean) / std : 0

    if (deviation > config.maxShift) {
      const disposition = config.severity === 'error' ? 'block' : 'warn'
      return {
        disposition,
        phi: mip,
        reason: `mip-shift: ${deviation.toFixed(2)}σ from rolling mean (window=${history.length})`,
      }
    }
    return { disposition: 'pass', phi: mip }
  },
}
```

- [ ] Write failing test: MIP shift > maxShift sigma triggers warn/block
- [ ] Run test — verify FAIL
- [ ] Implement `mip-shift.ts` as above
- [ ] Run test — verify PASS
- [ ] Commit

---

## Phase 3: policy/evaluate Session Event

### Task 5: Emit `policy/evaluate` session event

**Files:**
- Modify: `packages/guards-iit/src/session-events.ts`
- Modify: `packages/guards-iit/src/guard-runner.ts`

**Problem:** `policy/evaluate` is fired inside `ctx.waterfall()` but never written to the session log. On replay, guard decisions are not reconstructed.

**Solution:** Add a `policy/evaluate` event type to `SessionEventMap` via declaration merging, and emit it once per tool call after the full guard chain completes.

```typescript
// In session-events.ts, extend SessionEventMap:
declare module '@deepseek-ai/dsh-session' {
  interface SessionEventMap {
    'policy/evaluate': {
      turn: number
      step: number
      callId: string
      guards: readonly {
        guardId: string
        disposition: 'pass' | 'block' | 'warn'
        phi?: number
        reason?: string
      }[]
      finalDisposition: 'pass' | 'block'
      blockedBy?: string
      timestamp: number
      ignorable?: true
    }
  }
}
```

In `guard-runner.ts`, after the guard loop:
```typescript
const guardDecisions: { guardId: string; disposition: string; phi?: number; reason?: string }[] = []
for (const guard of GUARDS) {
  // ... existing guard run ...
  guardDecisions.push({ guardId: guard.id, disposition: result.disposition, phi: result.phi, reason: result.reason })
}
// After all guards:
try {
  ;(ctx.emit as (event: string, payload: unknown) => void)('policy/evaluate', {
    turn: (ev as { turn?: number }).turn ?? 0,
    step: (ev as { step?: number }).step ?? 0,
    callId: (ev as { callId?: string }).callId ?? '',
    guards: guardDecisions,
    finalDisposition: 'pass',
    timestamp: Date.now(),
    ignorable: true,
  })
} catch {}
```

- [ ] Add `policy/evaluate` to `SessionEventMap` declaration in `session-events.ts`
- [ ] Emit `policy/evaluate` after guard chain in `guard-runner.ts`
- [ ] Write test: replay of session with `policy/evaluate` events reconstructs guard decisions
- [ ] Run test — verify PASS
- [ ] Commit

---

## Phase 4: Register Missing Guards

### Task 6: Add new guards to guard-runner.ts GUARDS array

**Files:**
- Modify: `packages/guards-iit/src/guard-runner.ts`

Add the 3 new guards to the `GUARDS` array and add them to `TPM_DEPENDENT` set:

```typescript
import { freeEnergyGuard } from './guards/free-energy.js'
import { causalEmergenceGuard } from './guards/causal-emergence.js'
import { mipShiftGuard } from './guards/mip-shift.js'

export const GUARDS = [
  phiThresholdGuard,
  phiTrajectoryGuard,
  workspaceIgnitionGuard,
  cesFingerprintGuard,
  boundaryFrontierGuard,
  attractorEwsGuard,
  catastropheCuspGuard,
  effectEthosGuard,
  freeEnergyGuard,
  causalEmergenceGuard,
  mipShiftGuard,
] as const

const TPM_DEPENDENT = new Set([
  'phi-threshold',
  'phi-trajectory',
  'ces-fingerprint',
  'boundary-frontier',
  'attractor-ews',
  'catastrophe-cusp',
  'mip-shift',    // NEW
  'free-energy',   // NEW
  'causal-emergence', // NEW
])
```

- [ ] Add 3 new guard imports to `guard-runner.ts`
- [ ] Add them to `GUARDS` array
- [ ] Add `'mip-shift'`, `'free-energy'`, `'causal-emergence'` to `TPM_DEPENDENT`
- [ ] Run `pnpm run typecheck` — must pass
- [ ] Commit

---

## Phase 5: Verification

### Task 7: Full typecheck and test suite

**Files:**
- `packages/guards-iit/`

- [ ] Run `pnpm run typecheck` in `packages/guards-iit`
- [ ] Run `pnpm run test` in `packages/guards-iit`
- [ ] Run `pnpm run test:coverage` — per-file 100% coverage on `src/`
- [ ] If any coverage gaps: add missing test cases
- [ ] Commit all changes

---

## Task Summary

| # | Task | Status | Duration |
|---|------|--------|----------|
| 0 | Fix guard-runner.ts merge conflicts | ❌ | 30 min |
| 1 | Add `calculate_ces_js` WASM export | ❌ | 1h |
| 2 | Implement `free-energy` guard | ❌ | 1 day |
| 3 | Implement `causal-emergence` guard | ❌ | 1 day |
| 4 | Implement `mip-shift` guard | ❌ | 4h |
| 5 | Add `policy/evaluate` session event | ❌ | 4h |
| 6 | Register new guards in guard-runner | ❌ | 30 min |
| 7 | Full typecheck + coverage | ❌ | 2h |

**Total: ~3.5 days**

---

## Files Summary

```
packages/guards-iit/src/
├── guard-runner.ts        [MODIFY] resolve conflicts, register 3 new guards
├── session-events.ts     [MODIFY] add policy/evaluate event
├── guards/
│   ├── free-energy.ts           [CREATE]
│   ├── causal-emergence.ts     [CREATE]
│   └── mip-shift.ts            [CREATE]
└── tests/guards/
    ├── free-energy.spec.ts      [CREATE]
    ├── causal-emergence.spec.ts [CREATE]
    └── mip-shift.spec.ts       [CREATE]

packages/iit-core/src/
└── bindgen.rs            [MODIFY] add calculate_ces_js
```
