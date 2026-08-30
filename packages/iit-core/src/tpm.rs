//! Session window → Transition Probability Matrix (TPM).
//!
//! Maps a `K=64` window of `SessionEvent` JSON values to a
//! `ruvector_consciousness::types::TransitionMatrix`.
//!
//! Each event is binarized into `n_vars` booleans
//! `[tool_success, approval_granted, skill_loaded, sandbox_ok, ...]`
//! (configurable order, `n_vars in 4..=8` → `n_states = 1<<n_vars` ∈ 16..256,
//! fits `ComputeBudget::exact()`). Consecutive state pairs are counted,
//! Laplace-smoothed with α=0.5 (ruvector default), then row-normalized
//! to row-stochastic `TransitionMatrix::new(n_states, data)`.

use ruvector_consciousness::types::TransitionMatrix;

/// Ordered variable names for binarization. First four are the canonical
/// DSH booleans; the remaining four are generic extensions for `n_vars > 4`.
const VAR_NAMES: [&str; 8] = [
    "tool_success",
    "approval_granted",
    "skill_loaded",
    "sandbox_ok",
    "var_4",
    "var_5",
    "var_6",
    "var_7",
];

fn get_bool(event: &serde_json::Value, key: &str) -> bool {
    // 1. Direct top-level field (test shorthand: {tool_success:true})
    if let Some(v) = event.get(key) {
        if let Some(b) = v.as_bool() {
            return b;
        }
        if let Some(n) = v.as_u64() {
            return n != 0;
        }
        if let Some(n) = v.as_i64() {
            return n != 0;
        }
    }
    // 2. Real DSH SessionEvent shape: { type, time, seq, data: { ... } }
    //    e.g. { type:'tool/result', data:{ message, error } }
    if let Some(data) = event.get("data") {
        if let Some(v) = data.get(key) {
            if let Some(b) = v.as_bool() {
                return b;
            }
            if let Some(n) = v.as_u64() {
                return n != 0;
            }
            if let Some(n) = v.as_i64() {
                return n != 0;
            }
        }
        // Nested one level deeper (chain payloads: data.signal, data.decision, etc.)
        for wrapper in ["signal", "decision", "task", "verification", "message", "header"] {
            if let Some(inner) = data.get(wrapper).and_then(|o| o.get(key)) {
                if let Some(b) = inner.as_bool() {
                    return b;
                }
                if let Some(n) = inner.as_u64() {
                    return n != 0;
                }
                if let Some(n) = inner.as_i64() {
                    return n != 0;
                }
            }
        }
        // Special-cased DSH semantics for the 4 canonical booleans when no explicit field exists
        // tool_success = tool/result without error; approval_granted = not blocked; etc.
        if key == "tool_success" {
            // tool/result: success iff error absent/null
            if event.get("type").and_then(|t| t.as_str()) == Some("tool/result") {
                return data.get("error").map_or(true, |e| e.is_null());
            }
        }
        if key == "approval_granted" {
            if event.get("type").and_then(|t| t.as_str()) == Some("tool/result") {
                // approval is granted when not blocked by guard
                return data.get("error").map_or(true, |e| e.is_null());
            }
        }
    }
    // 3. Legacy wrappers: payload / event / value
    for wrapper in ["payload", "event", "value"] {
        if let Some(inner) = event.get(wrapper).and_then(|o| o.get(key)) {
            if let Some(b) = inner.as_bool() {
                return b;
            }
            if let Some(n) = inner.as_u64() {
                return n != 0;
            }
            if let Some(n) = inner.as_i64() {
                return n != 0;
            }
        }
    }
    false
}

fn event_to_state(event: &serde_json::Value, n_vars: usize) -> usize {
    let mut state = 0usize;
    for i in 0..n_vars {
        if get_bool(event, VAR_NAMES[i]) {
            state |= 1 << i;
        }
    }
    state
}

/// Build a row-stochastic TPM from a session window.
///
/// * `window` — slice of `SessionEvent` JSON values (K=64 typical, any length accepted).
/// * `n_vars` — number of boolean variables (4..=8). `n_states = 1 << n_vars`.
///
/// Returns `(TransitionMatrix, current_state)` where `current_state` is the
/// binarized state of the last event in `window` (0 if empty).
///
/// Laplace smoothing: `P[i][j] = (count[i][j] + 0.5) / (row_total[i] + n_states*0.5)`
/// so every row sums to 1.0 and `TransitionMatrix` validation passes.
pub fn session_window_to_tpm(
    window: &[serde_json::Value],
    n_vars: usize,
) -> Result<(TransitionMatrix, usize), String> {
    if !(4..=8).contains(&n_vars) {
        return Err(format!("n_vars must be 4..=8, got {n_vars}"));
    }
    let n_states = 1usize << n_vars;
    let mut counts = vec![vec![0usize; n_states]; n_states];

    // Count consecutive transitions
    if window.len() >= 2 {
        for pair in window.windows(2) {
            let cur = event_to_state(&pair[0], n_vars);
            let nxt = event_to_state(&pair[1], n_vars);
            if cur < n_states && nxt < n_states {
                counts[cur][nxt] += 1;
            }
        }
    }

    // Laplace smooth α=0.5 → row-stochastic data
    let alpha = 0.5f64;
    let mut data = Vec::with_capacity(n_states * n_states);
    for i in 0..n_states {
        let row_total: usize = counts[i].iter().sum();
        let denom = row_total as f64 + n_states as f64 * alpha;
        for j in 0..n_states {
            let p = (counts[i][j] as f64 + alpha) / denom;
            data.push(p);
        }
    }

    let tpm = TransitionMatrix::new(n_states, data);
    let current_state = window.last().map(|e| event_to_state(e, n_vars)).unwrap_or(0);

    Ok((tpm, current_state))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[allow(clippy::fn_params_excessive_bools)]
    fn ev(
        tool_success: bool,
        approval_granted: bool,
        skill_loaded: bool,
        sandbox_ok: bool,
    ) -> serde_json::Value {
        json!({
            "tool_success": tool_success,
            "approval_granted": approval_granted,
            "skill_loaded": skill_loaded,
            "sandbox_ok": sandbox_ok,
        })
    }

    #[test]
    fn row_stochastic_and_last_state() {
        let window = vec![
            ev(true, false, false, true),
            ev(false, true, false, false),
            ev(false, true, false, false),
        ];
        let (tpm, state) = session_window_to_tpm(&window, 4).unwrap();
        assert_eq!(tpm.n, 16);
        // each row sums to 1.0
        for i in 0..16 {
            let s: f64 = (0..16).map(|j| tpm.get(i, j)).sum();
            assert!((s - 1.0).abs() < 1e-9, "row {i} sum {s}");
        }
        // last event: false,true,false,false → bit1 set → 0b0010 = 2
        assert_eq!(state, 2);
    }

    #[test]
    fn invalid_n_vars() {
        assert!(session_window_to_tpm(&[], 3).is_err());
        assert!(session_window_to_tpm(&[], 9).is_err());
    }

    #[test]
    fn empty_window_uniform() {
        let (tpm, state) = session_window_to_tpm(&[], 4).unwrap();
        assert_eq!(state, 0);
        for i in 0..16 {
            for j in 0..16 {
                assert!((tpm.get(i, j) - 1.0 / 16.0).abs() < 1e-9);
            }
        }
    }
}
