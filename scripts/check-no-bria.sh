#!/usr/bin/env bash
# Fails if rembg's default model "bria-rmbg" (BRIA RMBG, licence not safe for
# commercial use) is mentioned anywhere in the repository. We only use
# birefnet-general and isnet-general-use (MIT). See docs/adr/0003-photo-pipeline.md.
#
# Usage: bash scripts/check-no-bria.sh [repo-root]
# Exit 0 = clean, 1 = found (matching files are listed). This script is the only
# file allowed to contain the name. Variants (underscore, no dash, any case) count too,
# and so do docs: explain the rule without spelling the name (say "rembg's default model").
set -euo pipefail

SELF_NAME="scripts/check-no-bria.sh"
ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
# The model name and its Hugging Face ids (briaai/RMBG-1.4, RMBG-2.0), in any case.
PATTERN='bria[-_ ]?rmbg|briaai|rmbg[-_ ]?[12][._]?[04]'

cd "$ROOT"

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  # Tracked files plus untracked, non-ignored ones (node_modules etc. are ignored).
  found=$(git grep --untracked -I -i -l -E "$PATTERN" -- . ":(exclude)$SELF_NAME" || true)
else
  found=$(grep -r -I -i -l -E "$PATTERN" . \
    --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=.medusa --exclude-dir=.next \
    --exclude-dir=.turbo --exclude-dir=dist --exclude-dir=.claude \
    | sed 's#^\./##' | grep -v -x -F "$SELF_NAME" || true)
fi

if [ -n "$found" ]; then
  echo "check-no-bria: forbidden model name found (use birefnet-general or isnet-general-use):" >&2
  echo "$found" | sed 's/^/  /' >&2
  exit 1
fi
echo "check-no-bria: ok"
