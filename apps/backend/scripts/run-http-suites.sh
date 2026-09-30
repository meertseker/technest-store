#!/usr/bin/env bash
# Runs each HTTP integration spec in its own Jest process.
# One --runInBand process for every suite runs out of memory (each suite boots a full Medusa app).
# Usage: bash scripts/run-http-suites.sh [spec files...]   (default: all integration-tests/http/*.spec.ts)
set -uo pipefail
cd "$(dirname "$0")/.."
files=("$@")
[ ${#files[@]} -eq 0 ] && files=(integration-tests/http/*.spec.ts)
failed=()
for f in "${files[@]}"; do
  echo "::group::$f"
  TEST_TYPE=integration:http NODE_OPTIONS="--experimental-vm-modules --max-old-space-size=${HTTP_SUITE_HEAP_MB:-4096}" \
    npx jest --silent=false --runInBand --forceExit "$f" || failed+=("$f")
  echo "::endgroup::"
done
echo "HTTP suites run: ${#files[@]}, failed: ${#failed[@]}"
for f in "${failed[@]}"; do echo "FAILED: $f"; done
[ ${#failed[@]} -eq 0 ]
