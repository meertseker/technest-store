#!/usr/bin/env bash
# Runs the real Caddyfile in the real Caddy image against two stand-in upstreams and checks
# which host serves what: the admin dashboard and admin API only on admin.<domain>, the
# Stripe webhook on api.<domain>, and a visitor-supplied CF-Connecting-IP never reaching
# the backend.
# Needs docker. Run: bash infra/caddy/test-caddyfile.sh [path/to/Caddyfile]   (also run by CI)
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
caddyfile="${1:-$here/../../Caddyfile}"
image="${CADDY_IMAGE:-caddy:2.10-alpine}"
domain="technest.localhost" # *.localhost: Caddy signs with its own local CA, no ACME
id="technest-caddytest-$$"
fails=0

# Git Bash on Windows rewrites arguments that look like paths; docker must get them as written.
export MSYS_NO_PATHCONV=1
hostpath() { if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi; }

cleanup() {
  docker rm -f "$id-edge" "$id-upstream" >/dev/null 2>&1
  docker network rm "$id" >/dev/null 2>&1
  rm -rf "$work"
}
work="$(mktemp -d)"
trap cleanup EXIT

check() { # check "what" "expected" "actual"
  if [ "$2" = "$3" ]; then echo "ok   - $1"; else echo "FAIL - $1: expected '$2', got '$3'"; fails=$((fails + 1)); fi
}

# Stand-ins for the backend (9000) and the storefront (8000): they answer with who they are,
# the path they were asked for and the CF-Connecting-IP header they received.
cat > "$work/upstream.Caddyfile" <<'EOF'
{
	auto_https off
	admin off
}
:9000 {
	respond "backend {path} cf={header.CF-Connecting-IP}"
}
:8000 {
	respond "storefront {path} cf={header.CF-Connecting-IP}"
}
EOF

docker network create "$id" >/dev/null || { echo "FAIL - docker network"; exit 1; }
docker create --name "$id-upstream" --network "$id" --network-alias server --network-alias storefront \
  "$image" caddy run --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null
docker cp "$(hostpath "$work/upstream.Caddyfile")" "$id-upstream:/etc/caddy/Caddyfile" >/dev/null
docker start "$id-upstream" >/dev/null

docker create --name "$id-edge" --network "$id" -p 127.0.0.1::443 \
  -e SHOP_DOMAIN="$domain" -e ACME_EMAIL=ci@example.com \
  "$image" caddy run --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null
docker cp "$(hostpath "$caddyfile")" "$id-edge:/etc/caddy/Caddyfile" >/dev/null
docker start "$id-edge" >/dev/null
port="$(docker port "$id-edge" 443/tcp | head -1 | sed 's/.*://')"

# req <host> <path> [curl args...] -> "<status> <body>"
req() {
  local host="$1" path="$2"; shift 2
  curl -sk --max-time 10 --resolve "$host:$port:127.0.0.1" -w '\n%{http_code}' "$@" "https://$host:$port$path" \
    | awk '{ lines[NR] = $0 } END { printf "%s %s", lines[NR], lines[1] }'
}
status() { req "$@" | cut -d' ' -f1; }

for _ in $(seq 1 30); do
  [ "$(status "api.$domain" /health)" = "200" ] && break
  sleep 1
done

spoof=(-H "CF-Connecting-IP: 6.6.6.6")
api="api.$domain"; admin="admin.$domain"

echo "# api host"
check "health reaches the backend" "200 backend /health" "$(req "$api" /health | sed 's/ cf=.*//')"
check "store API reaches the backend" "200 backend /store/products" "$(req "$api" /store/products | sed 's/ cf=.*//')"
check "customer sign-in reaches the backend" "200 backend /auth/customer/emailpass" \
  "$(req "$api" /auth/customer/emailpass -X POST | sed 's/ cf=.*//')"
check "Stripe webhook reaches the backend" "200 backend /hooks/payment/stripe_stripe" \
  "$(req "$api" /hooks/payment/stripe_stripe -X POST -d '{}' | sed 's/ cf=.*//')"
for path in /admin /admin/users /admin/orders/order_1 /ADMIN/users /app /app/login /app/orders /panel /panel/ /panel/orders /auth/user/emailpass /auth/user/emailpass/reset-password; do
  check "$path is not served" "404" "$(status "$api" "$path" -X POST)"
  check "$path is not served (GET)" "404" "$(status "$api" "$path")"
done
check "a path that only starts like /admin still reaches the backend" "200" "$(status "$api" /administrator)"
check "a visitor cannot choose the client IP" "0" "$(req "$api" /store/products "${spoof[@]}" | grep -c '6\.6\.6\.6')"
check "the backend is told a client IP" "1" "$(req "$api" /store/products "${spoof[@]}" | grep -cE 'cf=[0-9a-f.:]+$')"

echo "# admin host"
check "dashboard reaches the backend" "200 backend /app/login" "$(req "$admin" /app/login | sed 's/ cf=.*//')"
check "admin API reaches the backend" "200 backend /admin/users" "$(req "$admin" /admin/users | sed 's/ cf=.*//')"
check "admin sign-in reaches the backend" "200 backend /auth/user/emailpass" \
  "$(req "$admin" /auth/user/emailpass -X POST | sed 's/ cf=.*//')"
check "shop panel reaches the backend" "200 backend /panel/orders/order_1" "$(req "$admin" /panel/orders/order_1 | sed 's/ cf=.*//')"
check "/ goes to the shop panel" "302" "$(status "$admin" /)"
check "/ goes to the shop panel (where)" "/panel/" "$(curl -sk -o /dev/null -w '%{redirect_url}' --max-time 10 --resolve "$admin:$port:127.0.0.1" "https://$admin:$port/" | sed -E 's#^https://[^/]+##')"
check "store API is not served" "404" "$(status "$admin" /store/products)"
check "webhook is not served" "404" "$(status "$admin" /hooks/payment/stripe_stripe -X POST)"
check "a visitor cannot choose the client IP" "0" "$(req "$admin" /auth/user/emailpass -X POST "${spoof[@]}" | grep -c '6\.6\.6\.6')"
check "the backend is told a client IP" "1" "$(req "$admin" /auth/user/emailpass -X POST "${spoof[@]}" | grep -cE 'cf=[0-9a-f.:]+$')"
check "framing is refused" "1" "$(curl -skI --max-time 10 --resolve "$admin:$port:127.0.0.1" "https://$admin:$port/app/login" | grep -ci '^x-frame-options: DENY')"

echo "# shop host"
check "pages reach the storefront" "200 storefront /account/login" "$(req "$domain" /account/login | sed 's/ cf=.*//')"
check "a visitor cannot choose the client IP" "0" "$(req "$domain" /account/login "${spoof[@]}" | grep -c '6\.6\.6\.6')"
check "the storefront is told a client IP" "1" "$(req "$domain" /account/login "${spoof[@]}" | grep -cE 'cf=[0-9a-f.:]+$')"
check "www goes to the shop" "301" "$(status "www.$domain" /products/x)"

echo "# access log"
# Stripe sends the shopper back with the payment's client secret in the query string.
secret="pi_3CaddyTest_secret_Zz9Yy8"
req "$domain" "/api/payment-return?payment_intent=pi_3CaddyTest&payment_intent_client_secret=$secret&redirect_status=succeeded" >/dev/null
req "$api" /store/products?caddy_log_probe=1 >/dev/null
sleep 1
log="$(docker logs "$id-edge" 2>&1)"
check "the shop's access log never holds a payment's client secret" "0" "$(printf '%s\n' "$log" | grep -c "$secret")"
check "the payment return is still logged, with the secret replaced" "1" \
  "$(printf '%s\n' "$log" | grep '/api/payment-return' | grep 'payment_intent_client_secret=REDACTED' | grep -c 'redirect_status=succeeded')"
check "the API host keeps its access log" "1" "$(printf '%s\n' "$log" | grep -c 'caddy_log_probe=1')"

echo
if [ "$fails" -eq 0 ]; then echo "all Caddyfile checks passed"; else
  echo "$fails check(s) failed"; docker logs "$id-edge" 2>&1 | grep -v "handled request" | tail -5 | cut -c1-300; exit 1
fi
