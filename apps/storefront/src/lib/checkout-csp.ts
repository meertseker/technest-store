/**
 * Content-Security-Policy for /checkout (owner: E2), set per request with a
 * fresh nonce by src/middleware.ts. Rule: the only third-party script on
 * /checkout is Stripe's.
 *
 * Hosts come from src/lib/csp-hosts.js, shared with the site-wide report-only
 * policy (security-headers.js) so the two cannot drift. Apple Pay / Google Pay
 * run inside Stripe's frames, so no extra hosts.
 *
 * Scripts: 'nonce-…' + 'strict-dynamic'. Next.js adds the nonce to its own
 * scripts when it sees this CSP on the request; scripts those load (e.g.
 * Stripe.js via loadStripe) are trusted through 'strict-dynamic'. The Stripe
 * hosts stay listed for browsers without strict-dynamic support.
 */

import { LINK, LINK_IMAGES, STRIPE_API, STRIPE_FRAMES, STRIPE_IMAGES, STRIPE_JS, origin } from "./csp-hosts"

export type CheckoutCspOptions = {
  isDev: boolean
  nonce: string
  backendUrl?: string
  imageHost?: string
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
      ...STRIPE_IMAGES,
      ...LINK_IMAGES,
      imageHost ? `https://${imageHost}` : null,
    ],
    "font-src": ["'self'", "data:"],
    "connect-src": [
      "'self'",
      ...STRIPE_API,
      ...LINK,
      backendUrl ? origin(backendUrl) : null,
      ...(isDev ? ["ws:"] : []),
    ],
    "frame-src": [...STRIPE_FRAMES, ...LINK],
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
