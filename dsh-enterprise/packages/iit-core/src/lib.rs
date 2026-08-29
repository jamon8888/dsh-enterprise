//! DSH Enterprise IIT Core — Rust → WASM bridge.
//! Re-exports `ruvector-consciousness` (phi/emergence/collapse) and
//! `elara-active-inference` for downstream crates / WASM consumers.

pub mod attractor;
pub mod bindgen;
pub mod boundary;
pub mod catastrophe;
pub mod teloids;
pub mod tpm;
pub mod trajectory;
pub mod workspace;

/// Re-export as `elara` for `elara::Agent` etc.
pub use elara_active_inference as elara;
/// Re-export as `ruvector` for ergonomic `ruvector::phi::auto_compute_phi`.
pub use ruvector_consciousness as ruvector;
