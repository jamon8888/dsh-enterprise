// mock for @deepseek-ai/dsh-enterprise-iit-core/pkg — real WASM not built in CI
export function calculate_phi_js(tpmJson: string, state: number, _budget: string): unknown {
  return { phi: 0.5, cesHash: String(state), mip: { tpm: JSON.parse(tpmJson), state } }
}
// enumerate_frontiers / best_frontier intentionally NOT exported so boundary guard falls back to iitGuards (mirrors todo!() stub)
// export function enumerate_frontiers / best_frontier — uncomment when boundary.rs WASM exports are ready
// ews_variance / ews_ac1 intentionally NOT exported so guards fall back to JS pure (mirrors missing WASM exports)
// Intentionally omit CuspFit so guard falls back to bridge -> JS pure; if you need WASM path, uncomment below
// export const CuspFit = { ... }
