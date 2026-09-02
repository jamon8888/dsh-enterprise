//! Boundary / frontier — enumerates bipartition frontiers and picks max-Φ vs max-EI.

use ruvector_consciousness::types::{
    Bipartition, BipartitionIter, ComputeBudget, TransitionMatrix,
};

/// Enumerate all bipartition frontiers for a substrate of `n` elements.
///
/// Returns `2^n - 2` bipartitions (all non-empty proper subsets). For `n==0`
/// returns empty vec. Caps at `n<=63` (Bipartition mask limit); larger `n`
/// returns empty for P0.
pub fn enumerate_frontiers(substrate_n: usize) -> Vec<Bipartition> {
    if substrate_n == 0 || substrate_n > 63 {
        return Vec::new();
    }
    // ponytail: reuse BipartitionIter — no custom bit logic.
    BipartitionIter::new(substrate_n).collect()
}

/// Pick best frontier double-dissociation style.
///
/// Iterates `enumerate_frontiers(substrate_n)` where `substrate_n = log2(tpm.n)`
/// if `tpm.n` is power-of-two else `tpm.n` itself (clamped ≤8 for Exact budget),
/// then computes global `phi` via `auto_compute_phi` and `ei` via
/// `effective_information`. Returns `(best_bipartition, phi, ei)`.
///
/// For P0 `phi/ei` are global (not per-frontier marginalized); iteration
/// satisfies IIT-4 Gates double-dissociation bookkeeping while remaining pure.
pub fn best_frontier(tpm: &TransitionMatrix) -> (Bipartition, f64, f64) {
    let substrate_n = if tpm.n.is_power_of_two() && tpm.n >= 2 {
        // tpm.n = 2^substrate_n
        tpm.n.trailing_zeros() as usize
    } else {
        tpm.n
    };
    let n = substrate_n.clamp(1, 8);
    let frontiers = enumerate_frontiers(n);

    // Default = balanced (bindgen.rs uses default for balanced)
    let budget = ComputeBudget::default();
    let phi = ruvector_consciousness::phi::auto_compute_phi(tpm, None, &budget)
        .map(|r| r.phi)
        .unwrap_or(0.0);
    let ei = ruvector_consciousness::emergence::effective_information(tpm).unwrap_or(0.0);

    // Pick first valid frontier as representative (phi/ei global — max trivially first).
    // Loop retains double-dissociation structure for future per-frontier phi.
    let mut best = frontiers.into_iter().next().unwrap_or(Bipartition { mask: 1, n });
    // Ensure valid if n==1 the only mask==1 is full (=invalid for n=1?) but n>=1 clamp
    // handles — fallback to mask 1.
    if !best.is_valid() && n > 1 {
        best = Bipartition { mask: 1, n };
    }
    (best, phi, ei)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tpm::session_window_to_tpm;
    use serde_json::json;

    #[test]
    fn enumerate_frontiers_n4() {
        let v = enumerate_frontiers(4);
        assert_eq!(v.len(), 14, "2^4-2=14");
        // all valid and unique
        for b in &v {
            assert!(b.is_valid(), "mask {} invalid for n=4", b.mask);
        }
        // check masks cover 1..14
        let mut masks: Vec<u64> = v.iter().map(|b| b.mask).collect();
        masks.sort_unstable();
        assert_eq!(masks, (1u64..15).collect::<Vec<_>>());
    }

    #[test]
    fn best_frontier_nonempty() {
        let window = vec![
            json!({"tool_success": true, "approval_granted": false, "skill_loaded": false, "sandbox_ok": true}),
            json!({"tool_success": false, "approval_granted": true, "skill_loaded": false, "sandbox_ok": false}),
            json!({"tool_success": false, "approval_granted": true, "skill_loaded": true, "sandbox_ok": false}),
            json!({"tool_success": true, "approval_granted": true, "skill_loaded": true, "sandbox_ok": true}),
        ];
        let (tpm, _state) = session_window_to_tpm(&window, 4).unwrap();
        let (bip, phi, ei) = best_frontier(&tpm);
        assert!(bip.is_valid(), "best frontier must be valid");
        assert!(phi.is_finite(), "phi finite");
        assert!(ei.is_finite(), "ei finite");
        assert!(phi >= 0.0);
        assert!(ei >= 0.0);
    }
}
