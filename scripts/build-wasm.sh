#!/usr/bin/env bash
# Build the iit-core WASM package and smoke-test its guard-facing surface.
# Used by .github/workflows/ci.yml (wasm job) and publish.yml (tags).
# Fails the build when the artifact is missing, exports drift, or the
# trajectory shape no longer matches guards-iit's destructure.
set -euo pipefail

cd "$(dirname "$0")/../packages/iit-core"

echo "--- cargo test ---"
cargo test --locked -p dsh-enterprise-iit-core

echo "--- wasm-pack build ---"
wasm-pack build --target nodejs --out-dir pkg

echo "--- node smoke ---"
node --input-type=module -e "
import * as pkg from './pkg/dsh_enterprise_iit_core.js';
const need = ['calculate_phi_js','phi_trajectory_wasm','ignition_score_wasm','teloids_compile_wasm','teloids_evaluate_wasm'];
for (const f of need) {
  if (typeof pkg[f] !== 'function') throw new Error('missing export: ' + f);
}
const traj = pkg.phi_trajectory_wasm(
  JSON.stringify([0.5, 0.48, 0.46]),
  JSON.stringify({ window: 10, max_drop: 0.15, max_slope: -0.02 }),
);
for (const k of ['phi_current','phi_mean','drift','slope','variance','alert']) {
  if (!(k in traj)) throw new Error('trajectory missing key: ' + k);
}
console.log('wasm smoke OK:', JSON.stringify(traj));
"
