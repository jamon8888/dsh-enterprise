//! Catastrophe (cusp) — stub bridging `ict/catastrophe.py` (16KB).
//!
//! Potential `V(x;a,b) = x⁴/4 + a·x²/2 + b·x`, equilibria `x³ + a·x + b = 0`,
//! bifurcation set `4·a³ + 27·b² = 0`. Full fit ports `ict/catastrophe.py::fit_cusp`
//! (numpy `roots`) — P0 bridges via `PYTHONPATH=IIT/ICT-Series` python subprocess.

// ponytail: pure Rust LSTQ without nalgebra/ndarray — 2-param normal equations O(n)

/// Fitted cusp parameters and distance to bifurcation.
#[derive(Debug, Clone)]
pub struct CuspFit {
    /// Normal (quadratic) control parameter `a`.
    pub alpha: f64,
    /// Splitting (linear) control parameter `b`.
    pub beta: f64,
    /// Signed distance to bifurcation curve `4a³+27b²=0` (<0 inside cusp).
    pub distance_to_bifurcation: f64,
    /// Whether trajectory shows hysteresis (path-dependent jumps).
    pub hysteresis: bool,
}

impl CuspFit {
    /// Fit `(a,b)` from a scalar trajectory (cf. `ict/catastrophe.py::fit_cusp`).
    ///
    /// Linear regression on `x³ ≈ -a·x - b`  (equilibrium `x³+a·x+b=0`).
    /// Solves `y = c0·x + c1` with `y=x³`, `c0=-a`, `c1=-b` via normal equations.
    /// Falls back to `a=-mean(x²)`, `b=-mean(x³)` if degenerate.
    pub fn from_trajectory(traj: &[f64]) -> Self {
        if traj.is_empty() {
            return Self { alpha: 0.0, beta: 0.0, distance_to_bifurcation: 0.0, hysteresis: false };
        }
        // filter non-finite
        let xs: Vec<f64> = traj.iter().copied().filter(|v| v.is_finite()).collect();
        if xs.is_empty() {
            return Self { alpha: 0.0, beta: 0.0, distance_to_bifurcation: 0.0, hysteresis: false };
        }
        let n = xs.len() as f64;
        // sums for normal equations: X = [x, 1], y = x³
        let mut sum_x = 0.0;
        let mut sum_x2 = 0.0;
        let mut sum_x3 = 0.0;
        let mut sum_x4 = 0.0;
        let sum_x6_check = 0.0;
        let _ = sum_x6_check;
        for &x in &xs {
            let x2 = x * x;
            let x3 = x2 * x;
            sum_x += x;
            sum_x2 += x2;
            sum_x3 += x3;
            sum_x4 += x2 * x2;
        }

        // XᵀX = [[sum_x2, sum_x],[sum_x, n]], Xᵀy = [sum_x4, sum_x3]
        let det = n * sum_x2 - sum_x * sum_x;
        let (alpha, beta) = if det.abs() < 1e-12 || !det.is_finite() {
            // heuristic fallback
            let mean_x2 = sum_x2 / n;
            let mean_x3 = sum_x3 / n;
            (-mean_x2, -mean_x3)
        } else {
            let c0 = (n * sum_x4 - sum_x * sum_x3) / det; // -a
            let c1 = (sum_x2 * sum_x3 - sum_x * sum_x4) / det; // -b
            let a = -c0;
            let b = -c1;
            // guard against degenerate huge values from noisy fits
            if a.is_finite() && b.is_finite() { (a, b) } else { (-sum_x2 / n, -sum_x3 / n) }
        };

        let distance_to_bifurcation = 4.0 * alpha.powi(3) + 27.0 * beta.powi(2);

        // hysteresis = inside cusp && range > 0.5*std
        let inside = distance_to_bifurcation < 0.0;
        let hysteresis = if inside {
            let min = xs.iter().copied().fold(f64::INFINITY, f64::min);
            let max = xs.iter().copied().fold(f64::NEG_INFINITY, f64::max);
            let range = max - min;
            let mean = sum_x / n;
            let var = xs.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / n;
            let std = var.sqrt();
            if std > 1e-12 && std.is_finite() && range.is_finite() {
                range > 0.5 * std
            } else {
                false
            }
        } else {
            false
        };

        Self { alpha, beta, distance_to_bifurcation, hysteresis }
    }

    /// True iff `(alpha,beta)` lies inside the cusp (three real roots).
    pub fn is_inside_cusp(&self) -> bool {
        4.0 * self.alpha.powi(3) + 27.0 * self.beta.powi(2) < 0.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn inside_cusp_example() {
        let fit = CuspFit {
            alpha: -1.0,
            beta: 0.0,
            distance_to_bifurcation: 4.0 * (-1.0_f64).powi(3) + 27.0 * 0.0,
            hysteresis: false,
        };
        assert!(fit.is_inside_cusp());
        assert!(fit.distance_to_bifurcation < 0.0);
    }

    #[test]
    fn from_trajectory_nonempty() {
        let traj = [0.5, -0.3, 0.8, -0.6];
        let fit = CuspFit::from_trajectory(&traj);
        assert!(fit.distance_to_bifurcation.is_finite());
        // hysteresis is bool — just check it doesn't panic and is determined
        let _ = fit.hysteresis;
        // also check that empty doesn't panic
        let empty = CuspFit::from_trajectory(&[]);
        assert!(empty.distance_to_bifurcation.is_finite());
    }
}
