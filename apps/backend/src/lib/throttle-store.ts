import Redis from "ioredis"

/**
 * Attempt counters for the sign-in throttle (lib/auth-throttle.ts).
 *
 * A counter is a fixed window that opens at the first attempt: `hit` adds one
 * and says how many attempts the window holds and when it closes.
 *
 * Production keeps the counters in Redis, so they survive a deploy and are
 * shared if a second API server is ever added. Dev and tests keep them in
 * memory. If Redis cannot answer, the counters fall back to memory for that
 * request: a Redis fault never refuses a sign-in.
 */
export type ThrottleHit = { count: number; resetMs: number }

export interface ThrottleStore {
  hit(key: string, windowMs: number): Promise<ThrottleHit>
  clear(key: string): Promise<void>
}

export class MemoryThrottleStore implements ThrottleStore {
  private readonly windows = new Map<string, { count: number; expiresAt: number }>()

  constructor(
    private readonly now: () => number = Date.now,
    /** Expired windows are dropped once the map grows past this many keys. */
    private readonly maxKeys = 50_000
  ) {}

  async hit(key: string, windowMs: number): Promise<ThrottleHit> {
    const now = this.now()
    let window = this.windows.get(key)
    if (!window || window.expiresAt <= now) {
      window = { count: 0, expiresAt: now + windowMs }
      this.windows.set(key, window)
      if (this.windows.size > this.maxKeys) {
        this.prune(now)
      }
    }
    window.count += 1
    return { count: window.count, resetMs: window.expiresAt - now }
  }

  async clear(key: string): Promise<void> {
    this.windows.delete(key)
  }

  reset() {
    this.windows.clear()
  }

  private prune(now: number) {
    for (const [key, window] of this.windows) {
      if (window.expiresAt <= now) {
        this.windows.delete(key)
      }
    }
    // Still over the cap with live windows only: drop the oldest entries.
    // Forgetting a counter is better than growing without bound.
    for (const key of this.windows.keys()) {
      if (this.windows.size <= this.maxKeys) {
        break
      }
      this.windows.delete(key)
    }
  }
}

/** The part of ioredis the store uses (lets a test pass a stand-in). */
export type RedisLike = {
  eval(script: string, numKeys: number, ...args: (string | number)[]): Promise<unknown>
  del(key: string): Promise<unknown>
}

// INCR and the expiry in one step: a counter must never be left without a TTL.
const HIT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
local ttl = redis.call('PTTL', KEYS[1])
if count == 1 or ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return {count, ttl}
`

export class RedisThrottleStore implements ThrottleStore {
  constructor(
    private readonly redis: RedisLike,
    private readonly prefix = "technest:throttle:"
  ) {}

  async hit(key: string, windowMs: number): Promise<ThrottleHit> {
    const reply = (await this.redis.eval(HIT_SCRIPT, 1, this.prefix + key, windowMs)) as [
      number,
      number,
    ]
    return { count: Number(reply[0]), resetMs: Number(reply[1]) }
  }

  async clear(key: string): Promise<void> {
    await this.redis.del(this.prefix + key)
  }
}

/**
 * Uses `primary`; when it throws, answers from `fallback` instead and reports
 * the fault (at most once a minute, so a Redis outage doesn't flood the log).
 */
export class FailOpenThrottleStore implements ThrottleStore {
  private lastReport = -Infinity

  constructor(
    private readonly primary: ThrottleStore,
    private readonly fallback: ThrottleStore,
    private readonly report: (message: string) => void = () => {},
    private readonly now: () => number = Date.now
  ) {}

  async hit(key: string, windowMs: number): Promise<ThrottleHit> {
    try {
      return await this.primary.hit(key, windowMs)
    } catch (error) {
      this.reportOnce(error)
      return this.fallback.hit(key, windowMs)
    }
  }

  async clear(key: string): Promise<void> {
    await this.fallback.clear(key)
    try {
      await this.primary.clear(key)
    } catch (error) {
      this.reportOnce(error)
    }
  }

  private reportOnce(error: unknown) {
    const now = this.now()
    if (now - this.lastReport < 60_000) {
      return
    }
    this.lastReport = now
    const reason = error instanceof Error ? error.message : String(error)
    this.report(`Sign-in throttle: Redis did not answer (${reason}); counting in memory instead`)
  }
}

/**
 * A Redis connection that fails fast instead of queueing: a command either
 * answers within 300 ms or throws, and the caller falls back to memory.
 */
export function connectThrottleRedis(url: string, onError: (error: Error) => void = () => {}) {
  const redis = new Redis(url, {
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    commandTimeout: 300,
    connectTimeout: 2000,
    retryStrategy: (attempt) => Math.min(attempt * 500, 5000),
  })
  // Without a listener ioredis prints every reconnect error itself.
  redis.on("error", onError)
  return redis
}

let shared: ThrottleStore | undefined

/** One store per process: Redis in production (when REDIS_URL is set), memory otherwise. */
export function throttleStore(report?: (message: string) => void): ThrottleStore {
  if (shared) {
    return shared
  }
  const memory = new MemoryThrottleStore()
  const url = process.env.REDIS_URL
  shared =
    process.env.NODE_ENV === "production" && url
      ? new FailOpenThrottleStore(new RedisThrottleStore(connectThrottleRedis(url)), memory, report)
      : memory
  return shared
}

/** Tests only: replace (or forget) the process-wide store. */
export function setThrottleStore(store: ThrottleStore | undefined) {
  shared = store
}
