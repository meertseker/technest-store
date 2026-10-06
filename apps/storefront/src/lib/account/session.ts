/**
 * How long the sign-in cookie may live. It follows the expiry the backend put
 * in the token, so the browser stops sending the cookie when the token stops
 * working (a cookie that outlives its token looks signed in and then fails on
 * every save). The token is only read here, never trusted: the backend checks
 * its signature on every request.
 */

/** Upper limit, whatever the backend's setting */
export const MAX_SESSION_SECONDS = 60 * 60 * 24 * 7
/** Used when the token's expiry cannot be read: the backend's default token lifetime */
export const UNKNOWN_EXPIRY_SECONDS = 60 * 60 * 24
/** The cookie goes a little before the token, so a request is never sent with a token about to lapse */
const MARGIN_SECONDS = 60

type Expiry = { readable: false } | { readable: true; exp: number | null }

function readExpiry(token: string): Expiry {
  const payload = token.split(".")[1]
  if (!payload) return { readable: false }
  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/")
    const claims = JSON.parse(Buffer.from(base64, "base64").toString("utf8")) as { exp?: unknown } | null
    if (!claims || typeof claims !== "object") return { readable: false }
    return { readable: true, exp: typeof claims.exp === "number" && Number.isFinite(claims.exp) ? claims.exp : null }
  } catch {
    return { readable: false }
  }
}

/** `maxAge` (seconds) for the cookie that holds `token` */
export function authCookieMaxAge(token: string, now = Date.now()): number {
  const expiry = readExpiry(token)
  if (!expiry.readable) return UNKNOWN_EXPIRY_SECONDS
  if (expiry.exp === null) return MAX_SESSION_SECONDS
  const left = Math.floor(expiry.exp - now / 1000) - MARGIN_SECONDS
  return Math.max(0, Math.min(MAX_SESSION_SECONDS, left))
}

/** True only when the token itself says it has expired; an unreadable token is left for the backend to judge */
export function isTokenExpired(token: string, now = Date.now()): boolean {
  const expiry = readExpiry(token)
  return expiry.readable && expiry.exp !== null && expiry.exp <= now / 1000
}
