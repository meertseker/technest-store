import { createHash } from "crypto"
import { isIP } from "net"
import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
  MiddlewareRoute,
} from "@medusajs/framework/http"
import { throttleStore, type ThrottleStore } from "./throttle-store"

/**
 * Throttle for signing in, registering, password resets and trade applications,
 * for customers and for admin users.
 *
 * Each route counts attempts per client IP and, where the request names an
 * account, per email address. Over the limit the answer is 429 with
 * Retry-After. Stripe's webhook route is not in the list and is never counted.
 *
 * Whose IP: Medusa sets `trust proxy` to one hop, so behind Cloudflare and
 * Caddy `req.ip` is the Cloudflare edge address, the same for thousands of
 * visitors. The visitor's address is the CF-Connecting-IP header, which Caddy
 * overwrites on every site with the address it resolved itself, and which the
 * storefront passes on when it calls the API for a visitor. A request that
 * reaches the API from the internal network without that header (a storefront
 * call that did not pass it on, a test) has no visitor address: it is counted
 * per email only.
 */

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE

export const AUTH_LIMITS = {
  // A successful sign-in clears the email's counter, so only failures add up.
  customerLogin: { ip: { limit: 30, windowMs: 15 * MINUTE }, email: { limit: 10, windowMs: 15 * MINUTE } },
  adminLogin: { ip: { limit: 10, windowMs: 15 * MINUTE }, email: { limit: 5, windowMs: 15 * MINUTE } },
  // Registering sends a welcome email to an address nobody has confirmed.
  register: { ip: { limit: 10, windowMs: HOUR } },
  createCustomer: { ip: { limit: 10, windowMs: HOUR } },
  // Asking for a reset link sends an email to the address in the request.
  resetRequest: { ip: { limit: 5, windowMs: HOUR }, email: { limit: 3, windowMs: HOUR } },
  // Each application emails the contact address in the form and the shop.
  tradeApplication: { ip: { limit: 5, windowMs: HOUR } },
} as const

type Limit = { limit: number; windowMs: number }
type Counter = { key: string; limit: Limit }

const TOO_MANY = "Too many attempts. Please wait a few minutes and try again."

function header(req: MedusaRequest, name: string): string | undefined {
  const value = req.headers[name]
  return (Array.isArray(value) ? value[0] : value)?.trim() || undefined
}

function isInternal(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number)
    return (
      a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254)
    )
  }
  const lower = address.toLowerCase()
  return lower === "::1" || /^f[cd]/.test(lower) || /^fe[89ab]/.test(lower)
}

/** IPv4 as is; IPv6 by its /64 (one subscriber owns the whole /64). */
function ipKey(address: string): string {
  if (isIP(address) !== 6) {
    return address
  }
  const [head, tail = ""] = address.toLowerCase().split("::")
  const left = head ? head.split(":") : []
  const right = tail ? tail.split(":") : []
  const groups = address.includes("::")
    ? [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right]
    : left
  return groups
    .slice(0, 4)
    .map((group) => group.replace(/^0+(?=.)/, ""))
    .join(":") + "::/64"
}

/**
 * The visitor's address for counting, or null when the request carries none
 * (see the note at the top of this file).
 */
export function visitorIp(req: MedusaRequest): string | null {
  const forwarded = header(req, "cf-connecting-ip")
  if (forwarded && isIP(forwarded)) {
    return ipKey(forwarded)
  }
  const peer = (req.socket?.remoteAddress ?? "").replace(/^::ffff:/i, "")
  if (isIP(peer) && !isInternal(peer)) {
    return ipKey(peer)
  }
  return null
}

/** Emails are personal data: the counter key holds a hash, not the address. */
function emailKey(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }
  const email = value.trim().toLowerCase()
  if (!email || email.length > 320) {
    return null
  }
  return createHash("sha256").update(email).digest("hex").slice(0, 32)
}

type Rule = {
  /** Counter name, e.g. "login:customer". */
  name: (req: MedusaRequest) => string
  limits: (req: MedusaRequest) => { ip?: Limit; email?: Limit }
  /** The email (or reset identifier) the request names, if the route has one. */
  email?: (req: MedusaRequest) => unknown
  /** Forget the email's counter after a 2xx answer (a correct password). */
  clearEmailOnSuccess?: boolean
}

let warnedNoIp = false

export function throttle(rule: Rule, getStore: () => ThrottleStore = () => throttleStore()) {
  return async (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
    const name = rule.name(req)
    const limits = rule.limits(req)
    const counters: Counter[] = []

    const ip = visitorIp(req)
    if (limits.ip && ip) {
      counters.push({ key: `${name}:ip:${ip}`, limit: limits.ip })
    } else if (limits.ip && process.env.NODE_ENV === "production" && !warnedNoIp) {
      warnedNoIp = true
      logger(req)?.warn(
        `Sign-in throttle: ${req.method} ${req.path} arrived without a visitor IP (no CF-Connecting-IP); the per-IP limit was not applied. Check that Caddy and the storefront set the header.`
      )
    }

    const email = limits.email && rule.email ? emailKey(rule.email(req)) : null
    const emailCounter = email && limits.email ? { key: `${name}:email:${email}`, limit: limits.email } : null
    if (emailCounter) {
      counters.push(emailCounter)
    }

    const store = getStore()
    let retryAfterMs = 0
    try {
      const hits = await Promise.all(counters.map((c) => store.hit(c.key, c.limit.windowMs)))
      hits.forEach((hit, i) => {
        if (hit.count > counters[i].limit.limit) {
          retryAfterMs = Math.max(retryAfterMs, hit.resetMs)
        }
      })
    } catch (error) {
      // The store itself failed (it already falls back from Redis to memory):
      // let the request through rather than lock everybody out.
      logger(req)?.warn(`Sign-in throttle: counting failed (${(error as Error)?.message}); request allowed`)
      return next()
    }

    if (retryAfterMs > 0) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil(retryAfterMs / 1000))))
      res.status(429).json({ type: "too_many_requests", message: TOO_MANY })
      return
    }

    if (rule.clearEmailOnSuccess && emailCounter) {
      res.on("finish", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          store.clear(emailCounter.key).catch(() => {})
        }
      })
    }
    next()
  }
}

function logger(req: MedusaRequest): { warn: (message: string) => void } | undefined {
  try {
    return req.scope?.resolve("logger")
  } catch {
    return undefined
  }
}

const actor = (req: MedusaRequest) => String(req.params?.actor_type ?? "")
const isAdmin = (req: MedusaRequest) => actor(req) === "user"
const body = (req: MedusaRequest) => (req.body ?? {}) as Record<string, unknown>

/**
 * Routes are Medusa's own auth routes plus our two store routes. The auth
 * matchers take any actor type and provider, so an actor added later is
 * covered without touching this list.
 *
 * Medusa's own middleware for a route runs before ours, so a request it
 * refuses (no token, unknown provider) is not counted. Setting a new password
 * (/auth/.../update) is not in the list: it needs the signed token from the
 * reset email and sends nothing.
 */
export const authThrottleMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/auth/:actor_type/:auth_provider",
    middlewares: [
      throttle({
        name: (req) => `login:${actor(req)}`,
        limits: (req) => (isAdmin(req) ? AUTH_LIMITS.adminLogin : AUTH_LIMITS.customerLogin),
        email: (req) => body(req).email,
        clearEmailOnSuccess: true,
      }),
    ],
  },
  {
    method: ["POST"],
    matcher: "/auth/:actor_type/:auth_provider/register",
    middlewares: [
      throttle({ name: (req) => `register:${actor(req)}`, limits: () => AUTH_LIMITS.register }),
    ],
  },
  {
    method: ["POST"],
    matcher: "/auth/:actor_type/:auth_provider/reset-password",
    middlewares: [
      throttle({
        name: (req) => `reset-request:${actor(req)}`,
        limits: () => AUTH_LIMITS.resetRequest,
        email: (req) => body(req).identifier,
      }),
    ],
  },
  {
    method: ["POST"],
    matcher: "/store/customers",
    middlewares: [throttle({ name: () => "create-customer", limits: () => AUTH_LIMITS.createCustomer })],
  },
  {
    method: ["POST"],
    matcher: "/store/trade-applications",
    middlewares: [
      throttle({ name: () => "trade-application", limits: () => AUTH_LIMITS.tradeApplication }),
    ],
  },
]
