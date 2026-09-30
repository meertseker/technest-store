import { SlidingWindowRateLimiter } from "../rate-limit"

describe("SlidingWindowRateLimiter", () => {
  it("allows `limit` hits per window per key, then reports retry-after", () => {
    let now = 0
    const limiter = new SlidingWindowRateLimiter({ limit: 5, windowMs: 600_000, now: () => now })
    for (let i = 0; i < 5; i++) {
      expect(limiter.hit("a").allowed).toBe(true)
      now += 1000
    }
    expect(limiter.hit("a")).toEqual({ allowed: false, retryAfterSeconds: 595 })
    expect(limiter.hit("b").allowed).toBe(true)

    now = 600_001 // the first hit has left the window
    expect(limiter.hit("a").allowed).toBe(true)
    expect(limiter.hit("a").allowed).toBe(false)
  })

  it("prunes idle keys once over maxKeys", () => {
    let now = 0
    const limiter = new SlidingWindowRateLimiter({ limit: 1, windowMs: 10, now: () => now, maxKeys: 2 })
    limiter.hit("a")
    limiter.hit("b")
    now = 100
    limiter.hit("c")
    expect((limiter as unknown as { hits: Map<string, number[]> }).hits.size).toBe(1)
  })
})
