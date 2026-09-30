#!/usr/bin/env bash
# Fails if a non-commercial background-removal model is referenced anywhere in code or config.
# rembg's DEFAULT model (Bria RMBG) needs a paid licence for commercial use; we only ever run
# birefnet-general (MIT) or isnet-general-use (Apache-2.0). Docs and Markdown may name the
# forbidden model to explain the rule, so they are excluded; this script excludes itself.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
pattern='bria-rmbg|briaai|rmbg-?1\.4|rmbg-?2\.0|rmbg_?1_?4'
status=0
git grep -nI -i -E "$pattern" -- . ':!docs/**' ':!*.md' ':!scripts/licence-guard.sh' || status=$?
case "$status" in
  0) echo "licence-guard: forbidden model reference found (see above). Use birefnet-general or isnet-general-use." >&2
     exit 1 ;;
  1) echo "licence-guard: OK" ;;
  *) echo "licence-guard: git grep failed (exit $status)" >&2
     exit "$status" ;;
esac
