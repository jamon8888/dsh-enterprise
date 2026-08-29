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
// Intentionally omit CuspFit so guard falls back to bridge -> JS pure; if you need WASM path, uncomment below
// export const CuspFit = { ... }
