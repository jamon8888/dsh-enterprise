//! Attractor early-warning signals — stub bridging `ict/early_warning.py` (192 LOC).
//!
//! Wissel 1984 / Scheffer 2009: variance↑ and lag-1 autocorrelation↑ as
//! critical slowing down precursors. Full port uses `sliding_window_view`
//! + `rolling_variance` / `rolling_lag1_autocorr` from `ict/early_warning.py`.

// ponytail: pure std without ndarray/nalgebra — O(n) variance + Pearson AC1 + power iteration

/// Rolling variance EWS (cf. `ict/early_warning.py::rolling_variance`).
pub fn ews_variance(window: &[f64]) -> f64 {
    if window.is_empty() {
        return 0.0;
    }
    let n = window.len() as f64;
    let mean = window.iter().sum::<f64>() / n;
    let var = window.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / n;
    if var.is_finite() { var } else { 0.0 }
}

/// Lag-1 autocorrelation EWS (cf. `ict/early_warning.py::rolling_lag1_autocorr`).
///
/// Pearson lag-1 (matches `ict/early_warning.py::lag1_autocorr`).
/// Returns 0 if variance zero, length <2, or non-finite.
pub fn ews_ac1(window: &[f64]) -> f64 {
    let n = window.len();
    if n < 2 {
        return 0.0;
    }
    // Use Pearson definition on overlapping windows (like early_warning.py)
    let a = &window[..n - 1];
    let b = &window[1..];
    let am = a.iter().sum::<f64>() / a.len() as f64;
    let bm = b.iter().sum::<f64>() / b.len() as f64;
    let mut num = 0.0;
    let mut den_a = 0.0;
    let mut den_b = 0.0;
    for (x, y) in a.iter().zip(b.iter()) {
        let da = x - am;
        let db = y - bm;
        num += da * db;
        den_a += da * da;
        den_b += db * db;
    }
    let den = (den_a * den_b).sqrt();
    if den == 0.0 || !den.is_finite() || !num.is_finite() {
        return 0.0;
    }
    let r = num / den;
    if r.is_finite() { r } else { 0.0 }
}

/// Spectral radius `max|λ|` of boolean connectivity matrix.
///
/// Power iteration (500 steps) on `M` with `M_ij = 1` if connected else `0`.
/// Falls back to 0 for empty, 1×1 returns that entry.
pub fn spectral_radius(connectivity: &[Vec<bool>]) -> f64 {
    let n = connectivity.len();
    if n == 0 {
        return 0.0;
    }
    // verify square? allow ragged — treat missing as false
    let mut mat = vec![vec![0.0; n]; n];
    for (i, row) in connectivity.iter().enumerate().take(n) {
        for (j, &v) in row.iter().enumerate().take(n) {
            mat[i][j] = if v { 1.0 } else { 0.0 };
        }
    }
    if n == 1 {
        return f64::abs(mat[0][0]);
    }

    // power iteration
    let mut v = vec![1.0 / (n as f64).sqrt(); n]; // normalized uniform
    let mut lambda = 0.0;
    for _ in 0..500 {
        // w = M * v
        let mut w = vec![0.0; n];
        for i in 0..n {
            let mut s = 0.0;
            for j in 0..n {
                s += mat[i][j] * v[j];
            }
            w[i] = s;
        }
        let norm = w.iter().map(|x| x * x).sum::<f64>().sqrt();
        if norm == 0.0 || !norm.is_finite() {
            return 0.0;
        }
        // Rayleigh quotient for next lambda estimate: vᵀ M v
        // but ||w|| already estimates |λ| for normalized v
        lambda = norm;
        // normalize
        for val in &mut w {
            *val /= norm;
        }
        v = w;
    }
    if lambda.is_finite() { lambda } else { 0.0 }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn variance_constant_zero() {
        assert_eq!(ews_variance(&[1.0, 1.0, 1.0, 1.0]), 0.0);
        assert_eq!(ews_variance(&[5.0]), 0.0);
    }

    #[test]
    fn ac1_perfect_corr() {
        let ac = ews_ac1(&[1.0, 2.0, 3.0, 4.0]);
        assert!((ac - 1.0).abs() < 1e-9, "ac1={ac} expected ~1");
        // constant variance zero -> 0
        assert_eq!(ews_ac1(&[2.0, 2.0, 2.0, 2.0]), 0.0);
    }

    #[test]
    fn spectral_radius_fully_connected() {
        // 3x3 all true => eigenvalues n,0,0 => radius 3
        let n = 3;
        let conn = vec![vec![true; n]; n];
        let r = spectral_radius(&conn);
        assert!((r - n as f64).abs() < 1e-6, "radius {r} expected {}", n as f64);
        // 2x2 fully connected => 2
        let conn2 = vec![vec![true; 2]; 2];
        let r2 = spectral_radius(&conn2);
        assert!((r2 - 2.0).abs() < 1e-6, "radius {r2} expected 2");
        // empty
        assert_eq!(spectral_radius(&[]), 0.0);
    }
}
