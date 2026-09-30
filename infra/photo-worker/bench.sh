#!/usr/bin/env bash
# Times POST /remove per image against a running photo-worker.
# Usage: bash infra/photo-worker/bench.sh http://127.0.0.1:7000 birefnet-general img1.jpg [img2.jpg ...]
# Prints wall time (request incl. upload/download) and the worker's X-Inference-Ms.
set -euo pipefail
url="$1"; model="$2"; shift 2
for img in "$@"; do
  out=$(mktemp)
  hdr=$(mktemp)
  wall=$(curl -sS -o "$out" -D "$hdr" -w '%{time_total}' -F "file=@${img}" -F "model=${model}" "${url%/}/remove")
  code=$(head -1 "$hdr" | awk '{print $2}')
  inf=$(grep -i '^x-inference-ms:' "$hdr" | tr -d '\r' | awk '{print $2}')
  printf '%-28s model=%-18s http=%s wall=%6.2fs inference=%sms out=%s bytes\n' \
    "$(basename "$img")" "$model" "$code" "$wall" "${inf:-?}" "$(wc -c < "$out")"
  rm -f "$out" "$hdr"
done
