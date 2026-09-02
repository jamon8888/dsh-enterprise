//! Global Workspace ignition — GWT fan-out gate (cf. `ict/workspace.py` 677 LOC, numpy-only).

/// Ignition score (cf. `ict/workspace.py::ignition_score`): `mean(broadcast) * fan_out`.
pub fn ignition_score(broadcast: &[f64], fan_out: usize) -> f64 {
    if broadcast.is_empty() || fan_out == 0 {
        return 0.0;
    }
    let sum: f64 = broadcast.iter().sum();
    let mean = sum / broadcast.len() as f64;
    if mean.is_finite() { mean * fan_out as f64 } else { 0.0 }
}

/// Whether ignition fires.
pub fn is_ignited(score: f64, threshold: f64) -> bool {
    score > threshold
}

/// Map a trace of `(broadcast, fan_out)` to ignited bools (default threshold 1.0).
pub fn workspace_ignition_trace(broadcasts: &[(Vec<f64>, usize)]) -> Vec<bool> {
    workspace_ignition_trace_with_threshold(broadcasts, 1.0)
}

/// Trace with explicit threshold.
pub fn workspace_ignition_trace_with_threshold(
    broadcasts: &[(Vec<f64>, usize)],
    threshold: f64,
) -> Vec<bool> {
    broadcasts.iter().map(|(b, fo)| is_ignited(ignition_score(b, *fo), threshold)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ignition_score_basic() {
        let s = ignition_score(&[1.0, 1.0], 2);
        assert!((s - 2.0).abs() < 1e-9, "got {s}");
        // mean 0.5 * 2 =1
        assert!((ignition_score(&[0.0, 1.0], 2) - 1.0).abs() < 1e-9);
        assert!(ignition_score(&[], 2).abs() < 1e-9);
    }

    #[test]
    fn is_ignited_threshold() {
        assert!(is_ignited(2.0, 1.0));
        assert!(!is_ignited(1.0, 1.0));
        assert!(!is_ignited(0.5, 1.0));
        assert!(is_ignited(1.01, 1.0));
    }

    #[test]
    fn trace_basic() {
        let trace = vec![(vec![1.0, 1.0], 2usize), (vec![0.0], 5usize)];
        let out = workspace_ignition_trace(&trace);
        assert_eq!(out, vec![true, false]);
    }
}
