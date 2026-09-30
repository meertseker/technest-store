#!/usr/bin/env bash
# Lighthouse (mobile) on the pages gated by docs/specs/design.md section 8:
# home, category, product and checkout. Run against a PRODUCTION build:
#   pnpm run build && PORT=8018 pnpm start
# then, from apps/storefront:
#   CHROME_PATH=/path/to/chrome bash scripts/lighthouse.sh [out-dir]
# Env: BASE (default http://localhost:8018), BACKEND + KEY (default from .env.local),
#      CATEGORY_PATH, PRODUCT_PATH, CHECKOUT_PATH, PAGES (default "home category product checkout").
# The cart cookie is sent with --extra-headers; Chrome drops it when following a
# redirect, so point CHECKOUT_PATH at a URL that renders without one.
set -euo pipefail

OUT=$(realpath -m "${1:-lighthouse-out}")
cd "$(dirname "$0")/.."
if [[ -f .env.local ]]; then set -a; source .env.local; set +a; fi
BASE=${BASE:-http://localhost:8018}
BACKEND=${BACKEND:-${NEXT_PUBLIC_MEDUSA_BACKEND_URL:-http://localhost:9000}}
KEY=${KEY:-${NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY:?set KEY or NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY}}
CATEGORY_PATH=${CATEGORY_PATH:-/c/phone-accessories/cases}
PRODUCT_PATH=${PRODUCT_PATH:-/p/silicone-case-magsafe}
CHECKOUT_PATH=${CHECKOUT_PATH:-/checkout}
PAGES=${PAGES:-home category product checkout}
mkdir -p "$OUT"

H=(-H "x-publishable-api-key: $KEY" -H "content-type: application/json")
json() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const o=JSON.parse(s);console.log($1)})"; }

# /checkout needs a basket: a fresh cart with one item, passed as the cart cookie
REGION=$(curl -sf "${H[@]}" "$BACKEND/store/regions" | json 'o.regions[0].id')
CART=$(curl -sf "${H[@]}" -X POST "$BACKEND/store/carts" -d "{\"region_id\":\"$REGION\"}" | json 'o.cart.id')
# the first variant that is in stock (shared dev databases run low)
VARIANTS=$(curl -sf "${H[@]}" "$BACKEND/store/products?limit=20&fields=id,*variants" | json 'o.products.flatMap(p=>p.variants.map(v=>v.id)).join(" ")')
for V in $VARIANTS; do
  if curl -sf "${H[@]}" -X POST "$BACKEND/store/carts/$CART/line-items" -d "{\"variant_id\":\"$V\",\"quantity\":1}" >/dev/null; then break; fi
done

run() {
  local name=$1 path=$2; shift 2
  npx --yes lighthouse@13.5.0 "$BASE$path" \
    --form-factor=mobile \
    --only-categories=performance,accessibility,best-practices,seo \
    --chrome-flags="--headless=new --no-sandbox" \
    --output=json --output=html --output-path="$OUT/$name" --quiet "$@"
  node -e "
    const d = require('$OUT/$name.report.json'); const a = d.audits;
    const s = Object.fromEntries(Object.entries(d.categories).map(([k, v]) => [k, Math.round(v.score * 100)]));
    console.log('$name', JSON.stringify(s), 'LCP', a['largest-contentful-paint'].displayValue,
      'CLS', a['cumulative-layout-shift'].displayValue, 'TBT', a['total-blocking-time'].displayValue)"
}

for page in $PAGES; do
  case $page in
    home) run home / ;;
    category) run category "$CATEGORY_PATH" ;;
    product) run product "$PRODUCT_PATH" ;;
    checkout) run checkout "$CHECKOUT_PATH" --extra-headers="{\"Cookie\":\"_medusa_cart_id=$CART\"}" ;;
  esac
done
