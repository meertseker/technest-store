/**
 * Baseline headers for every route (next.config.js). /checkout adds an
 * enforced, per-request CSP in src/middleware.ts (E2).
 *
 * Not here on purpose: Strict-Transport-Security. Caddy fronts the storefront,
 * the API and the admin and sets one HSTS value for all of them (Caddyfile);
 * a second value from Next would only make it unclear which one applies.
 */

function origin(url) {
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

/**
 * A report-only CSP for the whole site: nothing is blocked, violations show
 * in the browser console (and in Sentry once a report endpoint is wired), so
 * the policy can be enforced later with evidence. It mirrors the checkout
 * policy without the nonce; Next's own inline scripts need 'unsafe-inline'
 * outside the nonce-aware /checkout route.
 */
function buildReportOnlyCsp({ backendUrl, imageHost } = {}) {
  const directives = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", "https://js.stripe.com", "https://*.js.stripe.com"],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", imageHost ? `https://${imageHost}` : null, "https://*.stripe.com"],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", backendUrl ? origin(backendUrl) : null, "https://api.stripe.com"],
    "frame-src": ["https://js.stripe.com", "https://*.js.stripe.com", "https://hooks.stripe.com"],
    "frame-ancestors": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
  }
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.filter(Boolean).join(" ")}`)
    .join("; ")
}

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value:
      'camera=(), microphone=(), geolocation=(), payment=(self "https://js.stripe.com")',
  },
  {
    key: "Content-Security-Policy-Report-Only",
    value: buildReportOnlyCsp({
      backendUrl: process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL,
      imageHost: process.env.NEXT_PUBLIC_IMAGE_HOSTNAME,
    }),
  },
]

module.exports = { securityHeaders, buildReportOnlyCsp }
