/**
 * Baseline headers for every route (next.config.js). /checkout adds an
 * enforced, per-request CSP in src/middleware.ts (E2).
 *
 * Strict-Transport-Security is not set here. Caddy fronts the storefront, the
 * API and the admin and sends one value for all of them (Caddyfile):
 * "max-age=31536000; includeSubDomains", one year, without "preload". Preload
 * is left out on purpose: once the domain is on the browsers' preload list it
 * is hard and slow to undo. Keep HSTS in Caddy only, so there is one value.
 */

const {
  STRIPE_JS,
  STRIPE_API,
  STRIPE_FRAMES,
  STRIPE_IMAGES,
  LINK,
  LINK_IMAGES,
  TURNSTILE,
  origin,
  sentryIngestOrigin,
} = require("./src/lib/csp-hosts")

/**
 * A report-only CSP for the whole site: nothing is blocked, violations show
 * in the browser console (and in Sentry once a report endpoint is wired), so
 * the policy can be enforced later with evidence. It allows every off-site
 * host the checkout policy allows (same list, src/lib/csp-hosts.js), plus
 * Turnstile and the Sentry ingest host, which checkout never loads. Next's own
 * inline scripts need 'unsafe-inline' outside the nonce-aware /checkout route.
 */
function buildReportOnlyCsp({ backendUrl, imageHost, sentryDsn } = {}) {
  const directives = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...STRIPE_JS, ...TURNSTILE],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", imageHost ? `https://${imageHost}` : null, ...STRIPE_IMAGES, ...LINK_IMAGES],
    "font-src": ["'self'", "data:"],
    "connect-src": [
      "'self'",
      backendUrl ? origin(backendUrl) : null,
      ...STRIPE_API,
      ...LINK,
      sentryIngestOrigin(sentryDsn),
    ],
    "frame-src": [...STRIPE_FRAMES, ...LINK, ...TURNSTILE],
    "frame-ancestors": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
  }
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${Array.from(new Set(values.filter(Boolean))).join(" ")}`)
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
      // the browser SDK's DSN (src/instrumentation-client.ts)
      sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    }),
  },
]

module.exports = { securityHeaders, buildReportOnlyCsp }
