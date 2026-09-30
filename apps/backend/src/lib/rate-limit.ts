import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

type Options = {
  limit: number
  windowMs: number
  now?: () => number
  /** Prune expired keys once the map grows past this many entries. */
  maxKeys?: number
}

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number }

/**
 * In-memory sliding-window limiter. State is per process: fine for the single
 * API server we run; a multi-server setup would need a shared (Redis) store.
 */
export class SlidingWindowRateLimiter {
  private readonly hits = new Map<string, number[]>()
  private readonly limit: number
  private readonly windowMs: number
  private readonly now: () => number
  private readonly maxKeys: number

  constructor({ limit, windowMs, now = Date.now, maxKeys = 10_000 }: Options) {
    this.limit = limit
    this.windowMs = windowMs
    this.now = now
    this.maxKeys = maxKeys
  }

  hit(key: string): RateLimitResult {
    const now = this.now()
    const since = now - this.windowMs
    const recent = (this.hits.get(key) ?? []).filter((t) => t > since)
    if (recent.length >= this.limit) {
      this.hits.set(key, recent)
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((recent[0] + this.windowMs - now) / 1000)),
      }
    }
    recent.push(now)
    this.hits.set(key, recent)
    if (this.hits.size > this.maxKeys) {
      this.prune(since)
    }
    return { allowed: true, retryAfterSeconds: 0 }
  }

  reset() {
    this.hits.clear()
  }

  private prune(since: number) {
    for (const [key, times] of this.hits) {
      if (!times.some((t) => t > since)) {
        this.hits.delete(key)
      }
    }
  }
}

/**
 * The client IP. Behind Cloudflare the real address is in CF-Connecting-IP
 * (Caddy overwrites it with its trusted {client_ip} on the api. site, so it cannot be spoofed).
 */
export function clientIp(req: MedusaRequest): string {
  const cf = req.headers["cf-connecting-ip"]
  const value = Array.isArray(cf) ? cf[0] : cf
  return value?.trim() || req.ip || req.socket?.remoteAddress || "unknown"
}

/** Express-style middleware that answers 429 once `limiter` refuses the client IP. */
export function rateLimit(limiter: SlidingWindowRateLimiter, prefix: string, message: string) {
  return (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
    const { allowed, retryAfterSeconds } = limiter.hit(`${prefix}:${clientIp(req)}`)
    if (!allowed) {
      res.setHeader("Retry-After", String(retryAfterSeconds))
      res.status(429).json({ type: "too_many_requests", message })
      return
    }
    next()
  }
}
