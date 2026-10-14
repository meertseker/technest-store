/**
 * Third-party hosts for the storefront's Content-Security-Policies, in one place
 * so the two policies cannot drift apart:
 * - security-headers.js (loaded by next.config.js, so this file is CommonJS):
 *   the report-only policy on every page;
 * - src/lib/checkout-csp.ts: the enforced, per-request policy on /checkout.
 *
 * Stripe: https://docs.stripe.com/security/guide#content-security-policy
 * (Stripe.js + Payment Element, 3D Secure on hooks.stripe.com, Link on link.com).
 * Turnstile: https://developers.cloudflare.com/turnstile/reference/content-security-policy/
 */

const STRIPE_JS = ["https://js.stripe.com", "https://*.js.stripe.com"]
const STRIPE_API = ["https://api.stripe.com"]
const STRIPE_FRAMES = [...STRIPE_JS, "https://hooks.stripe.com"]
const STRIPE_IMAGES = ["https://*.stripe.com"]
const LINK = ["https://link.com", "https://*.link.com"]
const LINK_IMAGES = ["https://*.link.com"]
/** Cloudflare Turnstile (the repair booking and trade forms). Never on /checkout. */
const TURNSTILE = ["https://challenges.cloudflare.com"]

/** "https://api.example.com/x" -> "https://api.example.com"; null when it is not a URL */
function origin(url) {
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

/**
 * Where the browser SDK sends errors: the DSN's own host
 * ("https://key@o1.ingest.sentry.io/2" -> "https://o1.ingest.sentry.io"),
 * without the key. Only an https DSN counts.
 */
function sentryIngestOrigin(dsn) {
  if (!dsn) return null
  try {
    const url = new URL(dsn)
    return url.protocol === "https:" ? url.origin : null
  } catch {
    return null
  }
}

module.exports = {
  STRIPE_JS,
  STRIPE_API,
  STRIPE_FRAMES,
  STRIPE_IMAGES,
  LINK,
  LINK_IMAGES,
  TURNSTILE,
  origin,
  sentryIngestOrigin,
}
