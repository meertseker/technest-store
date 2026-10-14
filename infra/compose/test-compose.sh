#!/usr/bin/env bash
# Renders the production compose file (and the staging override on top of it) with dummy
# secrets and checks what a deploy would get: which service sits on which network, that
# Redis wants a password and the backend sends it, that every Node service has a heap
# limit below its memory limit, that Caddy publishes 80 and 443 over TCP only, and that
# the base images are pinned by digest.
# Needs docker compose and python3. Run: bash infra/compose/test-compose.sh   (also run by CI)
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../.." && pwd)"
fails=0

check() { # check "what" "expected" "actual"
  if [ "$2" = "$3" ]; then echo "ok   - $1"; else echo "FAIL - $1: expected '$2', got '$3'"; fails=$((fails + 1)); fi
}

export POSTGRES_PASSWORD=pgdummy REDIS_PASSWORD=redisdummy JWT_SECRET=x COOKIE_SECRET=x \
  S3_FILE_URL=x S3_ACCESS_KEY_ID=x S3_SECRET_ACCESS_KEY=x S3_BUCKET=x S3_ENDPOINT=x \
  GHCR_OWNER=ci SMTP_PASS=x
# A compose project name that cannot collide with a running stack.
export COMPOSE_PROJECT_NAME=technest-composetest

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

render() { # render <out.json> <compose files...>
  local out="$1"; shift
  local args=()
  for f in "$@"; do args+=(-f "$root/$f"); done
  docker compose "${args[@]}" --profile ops config --format json > "$out" 2> "$work/err" \
    || { echo "FAIL - docker compose config ($*):"; cat "$work/err"; fails=$((fails + 1)); return 1; }
}

inspect() { # inspect <json> <python expression over `c` (the config dict)>
  python3 - "$1" "$2" <<'PY'
import json, sys
c = json.load(open(sys.argv[1]))
s = c["services"]
def nets(name): return sorted((s[name].get("networks") or {}).keys())
def env(name, key): return (s[name].get("environment") or {}).get(key)
def mem(name): return int(s[name]["deploy"]["resources"]["limits"]["memory"])
def heap_mb(name):
    v = env(name, "NODE_OPTIONS") or ""
    for part in v.split():
        if part.startswith("--max-old-space-size="): return int(part.split("=")[1])
    return None
def heap_ok(name):
    h, m = heap_mb(name), mem(name) / (1024 * 1024)
    return h is not None and 0.6 * m <= h <= 0.75 * m
print(eval(sys.argv[2]))
PY
}

for variant in production staging; do
  if [ "$variant" = production ]; then files=(docker-compose.yml); else files=(docker-compose.yml infra/staging/docker-compose.staging.yml); fi
  json="$work/$variant.json"
  echo "# $variant (${files[*]})"
  render "$json" "${files[@]}" || continue
  check "$variant: config renders" "1" "$([ -s "$json" ] && echo 1 || echo 0)"

  echo "## networks"
  check "$variant: caddy is on the edge network only" "['edge']" "$(inspect "$json" 'nets("caddy")')"
  check "$variant: storefront is on the edge network only (no Redis, no Postgres)" "['edge']" "$(inspect "$json" 'nets("storefront")')"
  check "$variant: server bridges edge and data" "['data', 'edge']" "$(inspect "$json" 'nets("server")')"
  for svc in worker postgres redis backup migrate; do
    check "$variant: $svc is on the data network only" "['data']" "$(inspect "$json" "nets(\"$svc\")")"
  done

  echo "## redis password"
  check "$variant: redis requires the password" "True" "$(inspect "$json" '"--requirepass" in s["redis"]["command"] and "redisdummy" in s["redis"]["command"]')"
  check "$variant: redis healthcheck can authenticate" "redisdummy" "$(inspect "$json" 'env("redis", "REDISCLI_AUTH")')"
  for svc in server worker migrate; do
    check "$variant: $svc connects with the password" "redis://:redisdummy@redis:6379" "$(inspect "$json" "env(\"$svc\", \"REDIS_URL\")")"
  done

  echo "## heap limits (60-75 % of the container's memory limit)"
  for svc in server worker storefront; do
    check "$variant: $svc has NODE_OPTIONS below its memory limit" "True" "$(inspect "$json" "heap_ok(\"$svc\")")"
  done
  check "$variant: the one-shot migrate has no heap flag of its own" "None" "$(inspect "$json" 'env("migrate", "NODE_OPTIONS")')"

  echo "## ports and images"
  check "$variant: caddy publishes 80/tcp and 443/tcp only" "[('80', 'tcp'), ('443', 'tcp')]" \
    "$(inspect "$json" 'sorted((str(p["published"]), p.get("protocol", "tcp")) for p in s["caddy"]["ports"])')"
  check "$variant: no other service publishes a port" "[]" \
    "$(inspect "$json" '[n for n, v in s.items() if n != "caddy" and v.get("ports")]')"
  for svc in caddy postgres redis; do
    check "$variant: $svc image is pinned by digest" "True" "$(inspect "$json" "\"@sha256:\" in s[\"$svc\"][\"image\"]")"
  done
done

echo "## the production .env template names every required variable"
for var in REDIS_PASSWORD POSTGRES_PASSWORD; do
  check "template has $var" "1" "$(grep -c "^$var=" "$root/.env.production.template")"
done

echo
if [ "$fails" -eq 0 ]; then echo "all compose checks passed"; else echo "$fails check(s) failed"; exit 1; fi
