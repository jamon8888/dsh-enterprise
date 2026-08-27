//! WASM bindgen — `calculate_phi_js` for `guards-iit` (Node + browser).

use ruvector_consciousness::types::{ComputeBudget, TransitionMatrix};
use wasm_bindgen::prelude::*;

/// Compute Φ from a JSON-serialized TPM via `ruvector::phi::auto_compute_phi`.
///
/// * `tpm_json` — canonical JSON of `TransitionMatrix { n, data }` (row-major).
/// * `state` — current system state index.
/// * `budget` — `"exact"` | `"fast"` | `"balanced"` (default balanced).
///
/// Returns `JsValue` of `PhiResult` (phi, mip, algorithm, elapsed).
#[wasm_bindgen]
pub fn calculate_phi_js(tpm_json: &str, state: usize, budget: &str) -> Result<JsValue, JsValue> {
    let tpm: TransitionMatrix =
        serde_json::from_str(tpm_json).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let budget = match budget {
        "exact" => ComputeBudget::exact(),
        "fast" => ComputeBudget::fast(),
        _ => ComputeBudget::default(), // balanced
    };
    let res = ruvector_consciousness::phi::auto_compute_phi(&tpm, Some(state), &budget)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    serde_wasm_bindgen::to_value(&res).map_err(|e| JsValue::from_str(&format!("{e:?}")))
}
