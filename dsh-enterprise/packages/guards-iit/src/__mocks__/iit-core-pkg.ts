// mock for @deepseek-ai/dsh-enterprise-iit-core/pkg — real WASM not built in CI
export function calculate_phi_js(tpmJson: string, state: number, _budget: string): unknown {
  return { phi: 0.5, cesHash: String(state), mip: 0.5 }
}

export function phi_trajectory_wasm(_phiHistoryJson: string, _configJson: string): unknown {
  return { phi_current: 0.5, phi_mean: 0.5, drift: 0, slope: 0, variance: 0.01, alert: 'none' }
}

export function ignition_score_wasm(_broadcastJson: string, _fanOut: number, _threshold: number): unknown {
  return { score: 0.8, normalized_score: 0.8 }
}

export function teloids_compile_wasm(_yaml: string): unknown {
  return { compiled: true, rules: [] }
}

export function teloids_evaluate_wasm(_compiledJson: string, _actionJson: string): unknown {
  return { result: 'allowed', score: 0.9 }
}

// enumerate_frontiers / best_frontier intentionally NOT exported so boundary guard falls back to iitGuards (mirrors todo!() stub)
// export function enumerate_frontiers / best_frontier — uncomment when boundary.rs WASM exports are ready
// ews_variance / ews_ac1 intentionally NOT exported so guards fall back to JS pure (mirrors missing WASM exports)
export const CuspFit = {
  from_trajectory: (traj: number[]): { distance_to_bifurcation: number; hysteresis: boolean } => {
    if (!traj || traj.length === 0) return { distance_to_bifurcation: 0, hysteresis: false }
    const xs = traj.filter((v) => Number.isFinite(v))
    if (xs.length === 0) return { distance_to_bifurcation: 0, hysteresis: false }
    const n = xs.length
    let sumX = 0, sumX2 = 0, sumX3 = 0, sumX4 = 0
    for (const x of xs) {
      const x2 = x * x
      sumX += x
      sumX2 += x2
      sumX3 += x2 * x
      sumX4 += x2 * x2
    }
    const det = n * sumX2 - sumX * sumX
    let alpha: number, beta: number
    if (Math.abs(det) < 1e-12 || !Number.isFinite(det)) {
      alpha = -sumX2 / n; beta = -sumX3 / n
    } else {
      const c0 = (n * sumX4 - sumX * sumX3) / det
      const c1 = (sumX2 * sumX3 - sumX * sumX4) / det
      alpha = -c0; beta = -c1
      if (!Number.isFinite(alpha) || !Number.isFinite(beta)) { alpha = -sumX2 / n; beta = -sumX3 / n }
    }
    const distance_to_bifurcation = 4 * alpha ** 3 + 27 * beta ** 2
    let hysteresis = false
    if (distance_to_bifurcation < 0) {
      const min = Math.min(...xs), max = Math.max(...xs), range = max - min
      const mean = sumX / n
      const variance = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / n
      const std = Math.sqrt(variance)
      if (Number.isFinite(std) && std > 1e-12 && Number.isFinite(range)) hysteresis = range > 0.5 * std
    }
    return { distance_to_bifurcation, hysteresis }
  },
}
