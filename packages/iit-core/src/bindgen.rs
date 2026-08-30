//! WASM bindgen — `calculate_phi_js` for `guards-iit` (Node + browser).

use crate::teloids::{ActionContext, Severity, Teloid, TeloidsConfig, evaluate_teloids};
use crate::trajectory::{TrajectoryConfig, phi_trajectory};
use crate::workspace::{ignition_score, is_ignited};
use ruvector_consciousness::ces::compute_ces;
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

/// Compute GWT ignition score from broadcast vector and fan-out.
///
/// * `broadcast_json` — JSON array of f64 broadcast values.
/// * `fan_out` — number of recipient modules (usize).
/// * `threshold` — ignition threshold (f64).
///
/// Returns `JsValue` with `{ score: f64, ignited: bool, threshold: f64 }`.
#[wasm_bindgen]
pub fn ignition_score_wasm(
    broadcast_json: &str,
    fan_out: usize,
    threshold: f64,
) -> Result<JsValue, JsValue> {
    let broadcast: Vec<f64> = serde_json::from_str(broadcast_json).unwrap_or_default();
    let score = ignition_score(&broadcast, fan_out);
    let ignited = is_ignited(score, threshold);
    serde_wasm_bindgen::to_value(&serde_json::json!({
        "score": score,
        "ignited": ignited,
        "threshold": threshold,
    }))
    .map_err(|e| JsValue::from_str(&format!("{e:?}")))
}

/// Compute rolling Φ trajectory metrics (drift, slope, variance, alert).
///
/// * `phi_history_json` — JSON array of f64 Φ values (one per turn).
/// * `config_json` — JSON of TrajectoryConfig { window, max_drop, max_slope }.
///
/// Returns `JsValue` of `Option<TrajectoryResult>`.
#[wasm_bindgen]
pub fn phi_trajectory_wasm(phi_history_json: &str, config_json: &str) -> Result<JsValue, JsValue> {
    let phi_history: Vec<f64> = serde_json::from_str(phi_history_json).unwrap_or_default();
    let config: TrajectoryConfig = serde_json::from_str(config_json).unwrap_or_default();
    let result = phi_trajectory(&phi_history, &config);
    serde_wasm_bindgen::to_value(&result).map_err(|e| JsValue::from_str(&format!("{e:?}")))
}

/// Compile Teloids YAML to internal representation.
///
/// * `yaml` — Teloids YAML string (array of Teloid objects).
///
/// Returns `JsValue` of compiled teloids config.
#[wasm_bindgen]
pub fn teloids_compile_wasm(yaml: &str) -> Result<JsValue, JsValue> {
    let teloids: Vec<Teloid> = serde_yaml::from_str(yaml).unwrap_or_default();
    serde_wasm_bindgen::to_value(&serde_json::json!({
        "teloids": teloids,
        "default_severity": "warn",
    }))
    .map_err(|e| JsValue::from_str(&format!("{e:?}")))
}

/// Evaluate compiled Teloids against an action.
///
/// * `compiled_json` — JSON from `teloids_compile_wasm`.
/// * `action_json` — JSON of ActionContext { tool, args, principal, resource }.
///
/// Returns `JsValue` of `EthosResult`.
#[wasm_bindgen]
pub fn teloids_evaluate_wasm(compiled_json: &str, action_json: &str) -> Result<JsValue, JsValue> {
    let compiled: serde_json::Value = serde_json::from_str(compiled_json).unwrap_or_default();
    let action: ActionContext = serde_json::from_str(action_json).unwrap_or_default();
    let default_severity = compiled["default_severity"].as_str().unwrap_or("warn");

    // Extract teloids array safely
    let teloids_vec: Vec<Teloid> = compiled["teloids"]
        .as_array()
        .map(|arr| {
            serde_json::from_value(serde_json::Value::Array(arr.clone())).unwrap_or_default()
        })
        .unwrap_or_default();

    let default_sev = if compiled["default_severity"].as_str().unwrap_or("warn") == "error" {
        Severity::Error
    } else {
        Severity::Warn
    };

    let config = TeloidsConfig {
        teloids: teloids_vec,
        default_severity: if default_severity == "error" {
            Severity::Error
        } else {
            Severity::Warn
        },
    };

    let result =
        evaluate_teloids(&serde_json::to_string(&config.teloids).unwrap(), &action, &config);
    serde_wasm_bindgen::to_value(&result).map_err(|e| JsValue::from_str(&format!("{e:?}")))
}

/// Compute CES (Causal Emergence Strength) hash from TPM.
///
/// * `tpm_json` — canonical JSON of `TransitionMatrix { n, data }` (row-major).
/// * `state` — current system state index.
///
/// Returns `JsValue` of `{ cesHash: String }` where `cesHash` is `big_phi` as hex.
#[wasm_bindgen]
pub fn calculate_ces_js(tpm_json: &str, state: usize) -> Result<JsValue, JsValue> {
    let tpm: TransitionMatrix =
        serde_json::from_str(tpm_json).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let ces = compute_ces(&tpm, state, 0.0, &ComputeBudget::default())
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    let ces_hash = format!("{:x}", ces.big_phi.to_bits());
    serde_wasm_bindgen::to_value(&serde_json::json!({ "cesHash": ces_hash }))
        .map_err(|e| JsValue::from_str(&format!("{e:?}")))
}

#[cfg(all(test, target_arch = "wasm32"))]
mod tests {
    use super::*;

    #[test]
    fn calculate_ces_js_returns_ces_hash_object() {
        let tpm_json = serde_json::json!({
            "n": 2,
            "data": [[0.5, 0.5], [0.5, 0.5]]
        });
        let result = calculate_ces_js(&tpm_json.to_string(), 0);
        assert!(result.is_ok());
        let val: serde_json::Value = serde_wasm_bindgen::from_value(result.unwrap()).unwrap();
        assert!(val.get("cesHash").is_some());
        assert!(val["cesHash"].is_string());
    }
}
