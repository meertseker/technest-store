/**
 * Content-Security-Policy for /checkout (owner: E2). Loaded by next.config.js
 * via security-headers.js#loadCheckoutCsp. Rule: the only third-party script
 * on /checkout is Stripe's.
 *
 * Stripe hosts: https://docs.stripe.com/security/guide#content-security-policy
 * (Stripe.js + Payment Element, 3DS via hooks.stripe.com, Link on link.com).
 * Apple Pay / Google Pay run inside Stripe's frames, so no extra hosts.
 *
 * Known trade-off: Next.js App Router injects inline bootstrap scripts, so
 * script-src needs 'unsafe-inline' until we add a per-request nonce (needs the
 * storefront middleware, E3). Adding a nonce later makes browsers ignore
 * 'unsafe-inline' automatically.
 */

const STRIPE_JS = ["https://js.stripe.com", "https://*.js.stripe.com"]
const LINK = ["https://link.com", "https://*.link.com"]

function origin(url) {
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

/**
 * @param {{ isDev: boolean, backendUrl?: string, imageHost?: string }} opts
 * @returns {string}
 */
function buildCheckoutCsp({ isDev, backendUrl, imageHost }) {
  const backend = backendUrl ? origin(backendUrl) : null
  const images = imageHost ? `https://${imageHost}` : null

  const directives = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : []), ...STRIPE_JS],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", "https://*.stripe.com", "https://*.link.com", images],
    "font-src": ["'self'", "data:"],
    "connect-src": [
      "'self'",
      "https://api.stripe.com",
      ...LINK,
      backend,
      ...(isDev ? ["ws:"] : []),
    ],
    "frame-src": [...STRIPE_JS, "https://hooks.stripe.com", ...LINK],
    "frame-ancestors": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
  }

  const parts = Object.entries(directives).map(
    ([name, values]) => `${name} ${[...new Set(values.filter(Boolean))].join(" ")}`
  )
  if (!isDev) {
    parts.push("upgrade-insecure-requests")
  }
  return parts.join("; ")
}

const checkoutCsp = buildCheckoutCsp({
  isDev: process.env.NODE_ENV !== "production",
  backendUrl: process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000",
  imageHost: process.env.NEXT_PUBLIC_IMAGE_HOSTNAME,
})

module.exports = { buildCheckoutCsp, checkoutCsp }
