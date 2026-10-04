#!/usr/bin/env bash
# Tests infra/deploy/deploy.sh against a stand-in `docker` that records its calls.
# Run: bash infra/deploy/test-deploy.sh   (also run by CI)
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
fails=0

check() { # check "what" "expected" "actual"
  if [ "$2" = "$3" ]; then echo "ok   - $1"; else echo "FAIL - $1: expected '$2', got '$3'"; fails=$((fails + 1)); fi
}

# run_case <name> <failing docker subcommand or "none">: runs deploy.sh in a scratch /opt/technest.
run_case() {
  work="$(mktemp -d)"
  mkdir -p "$work/bin"
  printf 'GHCR_OWNER=shop\nIMAGE_TAG=production-old\nOTHER=kept\n' > "$work/.env"
  cat > "$work/bin/docker" <<EOF
#!/usr/bin/env bash
echo "IMAGE_TAG=\${IMAGE_TAG:-unset} \$*" >> "$work/calls"
case "\$*" in *"$2"*) exit 1 ;; esac
# Like the real one, `compose run` reads stdin unless told not to.
case "\$*" in *" run "*) cat >/dev/null ;; esac
exit 0
EOF
  chmod +x "$work/bin/docker"
  # The script is piped to bash over SSH in the workflow: stdin is the script itself.
  (cd "$work" && PATH="$work/bin:$PATH" bash -s -- production-new < "$here/deploy.sh" > "$work/out" 2>&1)
  status=$?
}
calls() { grep -c -- "$1" "$work/calls" 2>/dev/null || true; }
tag() { grep -E '^IMAGE_TAG=' "$work/.env" | cut -d= -f2; }

run_case "success" "none"
check "success: exit code" "0" "$status"
check "success: .env has the new tag" "production-new" "$(tag)"
check "success: other .env lines are kept" "1" "$(grep -c '^OTHER=kept$' "$work/.env")"
check "success: previous tag is saved for rollback" "production-old" "$(cat "$work/.previous_tag")"
check "success: pulled with the new tag" "1" "$(calls 'IMAGE_TAG=production-new compose pull')"
check "success: migrated with the new tag" "1" "$(calls 'IMAGE_TAG=production-new compose --profile ops run --rm -T migrate')"
check "success: containers started" "1" "$(calls 'compose up -d --remove-orphans')"
check "success: Caddy reloaded" "1" "$(calls 'compose exec -T caddy caddy reload')"
check "success: start comes after migrate" "migrate up" \
  "$(grep -oE ' migrate| up -d' "$work/calls" | tr -d ' ' | sed 's/-d//' | tr '\n' ' ' | sed 's/ $//')"

run_case "migrate fails" "migrate"
check "migrate fails: exit code is not 0" "1" "$([ "$status" -ne 0 ] && echo 1 || echo 0)"
check "migrate fails: .env keeps the old tag" "production-old" "$(tag)"
check "migrate fails: nothing is started" "0" "$(calls 'compose up -d')"

run_case "pull fails" "pull"
check "pull fails: exit code is not 0" "1" "$([ "$status" -ne 0 ] && echo 1 || echo 0)"
check "pull fails: .env keeps the old tag" "production-old" "$(tag)"
check "pull fails: no migration is run" "0" "$(calls 'migrate')"

run_case "caddy reload fails" "caddy reload"
check "reload fails: the deploy still succeeds (containers are up)" "0" "$status"
check "reload fails: .env has the new tag" "production-new" "$(tag)"

echo
[ "$fails" -eq 0 ] && echo "all deploy.sh checks passed" || { echo "$fails check(s) failed"; exit 1; }
