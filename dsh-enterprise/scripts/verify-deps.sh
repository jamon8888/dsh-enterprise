#!/bin/bash
set -euo pipefail
echo "[verify-deps] pnpm ls"
pnpm ls --depth 0 --filter "@deepseek-ai/dsh-enterprise-*" 2>&1 | grep -v "test/dsh" || true
echo "[verify-deps] cargo tree"
if [ -f "packages/iit-core/Cargo.toml" ]; then
  cargo tree --manifest-path packages/iit-core/Cargo.toml --locked 2>&1 | grep -v "test/facility" || true
fi
echo "[verify-deps] no vendored facility src"
if pnpm pack --dry-run --filter @deepseek-ai/dsh-enterprise-chains 2>&1 | tar tz 2>&1 | grep -q "facility/packages/harness/src/chain.ts"; then
  echo "FAIL: vendored facility src"; exit 1
fi
echo "[verify-deps] sbom"
if command -v cyclonedx-npm >/dev/null 2>&1; then cyclonedx-npm --output-file sbom.cyclonedx.json || true; fi
echo "OK verify-deps"
