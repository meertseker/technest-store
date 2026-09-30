#!/usr/bin/env bash
# Tests for scripts/check-no-bria.sh. Run: bash scripts/check-no-bria.test.sh
# The forbidden name is assembled at runtime so this file never contains it.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHECK="$HERE/check-no-bria.sh"
NAME="bria""-rmbg"
fails=0
pass=0

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

expect() { # expect <description> <expected-exit> <root>
  local out code
  out=$(bash "$CHECK" "$3" 2>&1)
  code=$?
  if [ "$code" = "$2" ]; then
    pass=$((pass + 1)); echo "ok   - $1"
  else
    fails=$((fails + 1)); echo "FAIL - $1 (exit $code, expected $2)"; echo "$out" | sed 's/^/       /'
  fi
}

new_repo() { # new_repo <dir> [git]
  rm -rf "$1"; mkdir -p "$1/scripts" "$1/src"
  cp "$CHECK" "$1/scripts/check-no-bria.sh"
  echo 'model = "birefnet-general"' > "$1/src/ok.py"
  if [ "${2:-}" = git ]; then
    git -C "$1" init -q && git -C "$1" -c core.autocrlf=false add -A && git -C "$1" -c user.email=t@t -c user.name=t commit -qm init
  fi
}

for mode in git plain; do
  r="$tmp/$mode-clean"; new_repo "$r" "$mode"
  expect "$mode: clean repo passes (the script itself may contain the name)" 0 "$r"

  r="$tmp/$mode-tracked"; new_repo "$r" "$mode"
  echo "new_session(\"$NAME\")" > "$r/src/bad.py"
  expect "$mode: a file using the name fails" 1 "$r"

  r="$tmp/$mode-variant"; new_repo "$r" "$mode"
  echo "BRIA""_RMBG = 1" > "$r/src/const.ts"
  expect "$mode: underscore / upper-case variants fail" 1 "$r"

  r="$tmp/$mode-docs"; new_repo "$r" "$mode"
  mkdir -p "$r/docs" && echo "never use $NAME" > "$r/docs/notes.md"
  expect "$mode: a mention in docs fails too" 1 "$r"
done

r="$tmp/git-ignored"; new_repo "$r" git
mkdir -p "$r/node_modules/rembg" && echo "$NAME" > "$r/node_modules/rembg/x.py"
echo "node_modules/" > "$r/.gitignore"
expect "git: ignored dependency folders are not scanned" 0 "$r"

expect "this repository is clean" 0 "$(cd "$HERE/.." && pwd)"

echo "check-no-bria tests: $pass passed, $fails failed"
[ "$fails" = 0 ]
