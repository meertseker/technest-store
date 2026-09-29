/**
 * Content-Security-Policy for /checkout (owner: E2), set per request with a
 * fresh nonce by src/middleware.ts. Rule: the only third-party script on
 * /checkout is Stripe's.
 *
 * Stripe hosts: https://docs.stripe.com/security/guide#content-security-policy
 * (Stripe.js + Payment Element, 3DS via hooks.stripe.com, Link on link.com).
 * Apple Pay / Google Pay run inside Stripe's frames, so no extra hosts.
 *
 * Scripts: 'nonce-…' + 'strict-dynamic'. Next.js adds the nonce to its own
 * scripts when it sees this CSP on the request; scripts those load (e.g.
 * Stripe.js via loadStripe) are trusted through 'strict-dynamic'. The Stripe
 * hosts stay listed for browsers without strict-dynamic support.
 */

const STRIPE_JS = ["https://js.stripe.com", "https://*.js.stripe.com"]
const LINK = ["https://link.com", "https://*.link.com"]

export type CheckoutCspOptions = {
  isDev: boolean
  nonce: string
  backendUrl?: string
  imageHost?: string
}

function origin(url: string): string | null {
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

export function buildCheckoutCsp({ isDev, nonce, backendUrl, imageHost }: CheckoutCspOptions): string {
  const directives: Record<string, (string | null)[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ...(isDev ? ["'unsafe-eval'"] : []),
      ...STRIPE_JS,
    ],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": [
      "'self'",
      "data:",
      "blob:",
      "https://*.stripe.com",
      "https://*.link.com",
      imageHost ? `https://${imageHost}` : null,
    ],
    "font-src": ["'self'", "data:"],
    "connect-src": [
      "'self'",
      "https://api.stripe.com",
      ...LINK,
      backendUrl ? origin(backendUrl) : null,
      ...(isDev ? ["ws:"] : []),
    ],
    "frame-src": [...STRIPE_JS, "https://hooks.stripe.com", ...LINK],
    "frame-ancestors": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
  }

  const parts = Object.entries(directives).map(
    ([name, values]) => `${name} ${Array.from(new Set(values.filter(Boolean))).join(" ")}`
  )
  if (!isDev) {
    parts.push("upgrade-insecure-requests")
  }
  return parts.join("; ")
}

export function isCheckoutPath(pathname: string): boolean {
  return pathname === "/checkout" || pathname.startsWith("/checkout/")
}

/** 128 bits of randomness, base64 (Edge runtime has Web Crypto, no Buffer). */
export function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""))
}
