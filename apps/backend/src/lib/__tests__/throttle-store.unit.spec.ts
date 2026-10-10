import Redis from "ioredis"
import {
  connectThrottleRedis,
  FailOpenThrottleStore,
  MemoryThrottleStore,
  RedisThrottleStore,
  type ThrottleStore,
} from "../throttle-store"

describe("MemoryThrottleStore", () => {
  it("counts attempts in a window that opens at the first one", async () => {
    let now = 1_000_000
    const store = new MemoryThrottleStore(() => now)

    expect(await store.hit("k", 60_000)).toEqual({ count: 1, resetMs: 60_000 })
    now += 20_000
    expect(await store.hit("k", 60_000)).toEqual({ count: 2, resetMs: 40_000 })
    expect(await store.hit("other", 60_000)).toEqual({ count: 1, resetMs: 60_000 })

    now += 40_000 // the window has closed
    expect(await store.hit("k", 60_000)).toEqual({ count: 1, resetMs: 60_000 })
  })

  it("clear forgets one key", async () => {
    const store = new MemoryThrottleStore()
    await store.hit("a", 60_000)
    await store.hit("b", 60_000)
    await store.clear("a")
    expect((await store.hit("a", 60_000)).count).toBe(1)
    expect((await store.hit("b", 60_000)).count).toBe(2)
  })

  it("stays bounded: expired windows go first, then the oldest", async () => {
    let now = 0
    const store = new MemoryThrottleStore(() => now, 3)
    await store.hit("old-1", 10)
    await store.hit("old-2", 10)
    now = 100
    await store.hit("live-1", 1000)
    await store.hit("live-2", 1000) // 4 keys: the two expired ones are dropped
    expect((await store.hit("live-1", 1000)).count).toBe(2)
    await store.hit("live-3", 1000)
    await store.hit("live-4", 1000) // 4 live keys: the oldest (live-1) is dropped
    expect((await store.hit("live-1", 1000)).count).toBe(1)
  })
})

describe("FailOpenThrottleStore", () => {
  const broken: ThrottleStore = {
    hit: async () => {
      throw new Error("Connection is closed.")
    },
    clear: async () => {
      throw new Error("Connection is closed.")
    },
  }

  it("counts in memory when Redis throws, and says so once a minute", async () => {
    let now = 0
    const reports: string[] = []
    const store = new FailOpenThrottleStore(broken, new MemoryThrottleStore(), (m) => reports.push(m), () => now)

    expect((await store.hit("k", 60_000)).count).toBe(1)
    expect((await store.hit("k", 60_000)).count).toBe(2)
    await expect(store.clear("k")).resolves.toBeUndefined()
    expect(reports).toHaveLength(1)
    expect(reports[0]).toContain("Redis did not answer")

    now = 61_000
    await store.hit("k", 60_000)
    expect(reports).toHaveLength(2)
  })

  it("uses Redis while it answers", async () => {
    const primary = new MemoryThrottleStore()
    const fallback = new MemoryThrottleStore()
    const store = new FailOpenThrottleStore(primary, fallback)
    await store.hit("k", 60_000)
    await store.hit("k", 60_000)
    expect((await primary.hit("k", 60_000)).count).toBe(3)
    expect((await fallback.hit("k", 60_000)).count).toBe(1)
  })
})

describe("RedisThrottleStore (stand-in client)", () => {
  it("sends one script per attempt and reads count and time left", async () => {
    const calls: unknown[][] = []
    const store = new RedisThrottleStore(
      {
        eval: async (...args) => {
          calls.push(args)
          return [4, 1234]
        },
        del: async (key) => {
          calls.push(["del", key])
          return 1
        },
      },
      "t:"
    )
    expect(await store.hit("login:ip:1.2.3.4", 900_000)).toEqual({ count: 4, resetMs: 1234 })
    expect(calls[0].slice(1)).toEqual([1, "t:login:ip:1.2.3.4", 900_000])
    await store.clear("login:ip:1.2.3.4")
    expect(calls[1]).toEqual(["del", "t:login:ip:1.2.3.4"])
  })
})

// Against a real Redis (the dev container, or the CI service). Keys carry a
// random prefix and expire by themselves.
describe("RedisThrottleStore (real Redis)", () => {
  const url = process.env.THROTTLE_TEST_REDIS_URL || process.env.REDIS_URL || "redis://localhost:6379"
  const prefix = `technest:throttle-test:${Date.now()}-${Math.random().toString(36).slice(2)}:`
  let redis: Redis
  let available = false

  beforeAll(async () => {
    redis = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 0, connectTimeout: 1500, retryStrategy: () => null })
    redis.on("error", () => {})
    try {
      await redis.connect()
      await redis.ping()
      available = true
    } catch {
      available = false
    }
    if (!available && process.env.CI) {
      throw new Error(`No Redis at ${url}: CI must run this test`)
    }
  })

  afterAll(async () => {
    redis.disconnect()
  })

  const needsRedis = (name: string, fn: () => Promise<void>) =>
    it(name, async () => {
      if (!available) {
        console.warn(`SKIPPED (no Redis at ${url}): ${name}`)
        return
      }
      await fn()
    })

  needsRedis("counts, sets an expiry on the first attempt, and clears", async () => {
    const store = new RedisThrottleStore(redis, prefix)
    const first = await store.hit("k", 5000)
    expect(first.count).toBe(1)
    expect(first.resetMs).toBeGreaterThan(4000)
    expect(first.resetMs).toBeLessThanOrEqual(5000)

    const second = await store.hit("k", 5000)
    expect(second.count).toBe(2)
    expect(second.resetMs).toBeLessThanOrEqual(first.resetMs)
    expect(await redis.pttl(prefix + "k")).toBeGreaterThan(0)

    await store.clear("k")
    expect((await store.hit("k", 5000)).count).toBe(1)
  })

  needsRedis("a counter left without an expiry gets one", async () => {
    await redis.set(prefix + "stuck", "7")
    const store = new RedisThrottleStore(redis, prefix)
    const hit = await store.hit("stuck", 5000)
    expect(hit.count).toBe(8)
    expect(await redis.pttl(prefix + "stuck")).toBeGreaterThan(0)
  })

  needsRedis("parallel attempts are all counted", async () => {
    const store = new RedisThrottleStore(redis, prefix)
    const hits = await Promise.all(Array.from({ length: 25 }, () => store.hit("burst", 5000)))
    expect(hits.map((h) => h.count).sort((a, b) => a - b)).toEqual(Array.from({ length: 25 }, (_, i) => i + 1))
  })
})

describe("connectThrottleRedis", () => {
  it("fails fast when Redis is not there, so the caller can fall back", async () => {
    // Port 1 on localhost: nothing listens there.
    const redis = connectThrottleRedis("redis://127.0.0.1:1")
    const store = new FailOpenThrottleStore(new RedisThrottleStore(redis), new MemoryThrottleStore())
    const started = Date.now()
    expect((await store.hit("k", 60_000)).count).toBe(1)
    expect((await store.hit("k", 60_000)).count).toBe(2)
    expect(Date.now() - started).toBeLessThan(2000)
    redis.disconnect()
  })
})
