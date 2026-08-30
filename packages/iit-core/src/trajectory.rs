//! Rolling Φ trajectory — drift, slope, variance over sliding window.
//! Input: vec of Φ values (one per turn). Output: drift/slope/alert.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrajectoryConfig {
    pub window: usize,  // default 10 turns
    pub max_drop: f64,  // default 0.15
    pub max_slope: f64, // default -0.02 per turn
}

impl Default for TrajectoryConfig {
    fn default() -> Self {
        Self { window: 10, max_drop: 0.15, max_slope: -0.02 }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrajectoryResult {
    pub phi_current: f64,
    pub phi_mean: f64,
    pub drift: f64,    // phi_current - phi_mean
    pub slope: f64,    // linear regression slope over window
    pub variance: f64, // rolling variance
    pub alert: TrajectoryAlert,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum TrajectoryAlert {
    #[default]
    None,
    DriftWarning,
    SlopeWarning,
    Critical,
}

/// Compute rolling trajectory metrics over last `window` Φ values.
/// Returns `None` if insufficient data (< 3 points).
pub fn phi_trajectory(phi_history: &[f64], config: &TrajectoryConfig) -> Option<TrajectoryResult> {
    if phi_history.len() < 3 {
        return None;
    }

    let window = phi_history.len().min(config.window);
    let slice = &phi_history[phi_history.len() - window..];

    let n = slice.len() as f64;
    let mean = slice.iter().sum::<f64>() / n;
    let current = *slice.last().unwrap();
    let drift = current - mean;

    // Variance
    let variance = slice.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / n;

    // Linear regression slope (least squares)
    let x_mean = (window - 1) as f64 / 2.0;
    let mut num = 0.0;
    let mut den = 0.0;
    for (i, &y) in slice.iter().enumerate() {
        let xi = i as f64 - x_mean;
        let yi = y - mean;
        num += xi * yi;
        den += xi * xi;
    }
    let slope = if den > 0.0 { num / den } else { 0.0 };

    // Alert logic
    let alert = if drift < -config.max_drop.abs() {
        TrajectoryAlert::DriftWarning
    } else if slope < config.max_slope {
        TrajectoryAlert::SlopeWarning
    } else if drift < -config.max_drop.abs() * 2.0 || slope < config.max_slope * 2.0 {
        TrajectoryAlert::Critical
    } else {
        TrajectoryAlert::None
    };

    Some(TrajectoryResult { phi_current: current, phi_mean: mean, drift, slope, variance, alert })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn trajectory_constant_phi() {
        let hist = vec![0.5; 10];
        let cfg = TrajectoryConfig::default();
        let r = phi_trajectory(&hist, &cfg).unwrap();
        assert_eq!(r.drift, 0.0);
        assert_eq!(r.slope, 0.0);
        assert_eq!(r.alert, TrajectoryAlert::None);
    }

    #[test]
    fn trajectory_dropping() {
        let hist: Vec<f64> = (0..10).map(|i| 0.5 - i as f64 * 0.04).collect();
        let cfg = TrajectoryConfig::default();
        let r = phi_trajectory(&hist, &cfg).unwrap();
        assert!(r.drift < 0.0);
        assert!(r.slope < 0.0);
        assert_eq!(r.alert, TrajectoryAlert::DriftWarning);
    }
}
