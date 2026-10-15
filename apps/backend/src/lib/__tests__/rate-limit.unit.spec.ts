import { EventEmitter } from "events"
import { rateLimit, SlidingWindowRateLimiter } from "../rate-limit"

class FakeRes extends EventEmitter {
  statusCode = 200
  headers: Record<string, string> = {}
  setHeader(name: string, value: string) {
    this.headers[name] = value
  }
  status(code: number) {
    this.statusCode = code
    return this
  }
  json() {
    return this
  }
}

const requestFrom = (ip: string): any => ({
  headers: { "cf-connecting-ip": ip },
  socket: { remoteAddress: "172.18.0.5" },
})

describe("rateLimit middleware keys", () => {
  const hits = (ips: string[]) => {
    const limiter = new SlidingWindowRateLimiter({ limit: 2, windowMs: 60_000 })
    const middleware = rateLimit(limiter, "test", "slow down")
    return ips.map((ip) => {
      const res = new FakeRes()
      const next = jest.fn()
      middleware(requestFrom(ip), res as any, next)
      return next.mock.calls.length ? "allowed" : res.statusCode
    })
  }

  it("counts an IPv6 client by its /64, so rotating inside it does not reset the limit", () => {
    expect(
      hits(["2001:db8:abcd:12::1", "2001:db8:abcd:12:ffff::2", "2001:0db8:abcd:0012:1:2:3:4"])
    ).toEqual(["allowed", "allowed", 429])
  })

  it("keeps different /64s and IPv4 addresses apart", () => {
    expect(hits(["2001:db8:abcd:12::1", "2001:db8:abcd:13::1", "203.0.113.9", "203.0.113.10"])).toEqual([
      "allowed",
      "allowed",
      "allowed",
      "allowed",
    ])
    expect(hits(["203.0.113.9", "203.0.113.9", "203.0.113.9"])).toEqual(["allowed", "allowed", 429])
  })

  it("counts an IPv4 client seen as an IPv4-mapped IPv6 address by its IPv4 address", () => {
    // Different clients must not share one bucket...
    expect(hits(["::ffff:203.0.113.9", "::ffff:203.0.113.10", "::FFFF:198.51.100.7"])).toEqual([
      "allowed",
      "allowed",
      "allowed",
    ])
    // ...and the mapped and plain forms of one client are the same client.
    expect(hits(["::ffff:203.0.113.9", "203.0.113.9", "::ffff:203.0.113.9"])).toEqual(["allowed", "allowed", 429])
    // Without a forwarded header the socket address is used, mapped or not.
    const limiter = new SlidingWindowRateLimiter({ limit: 1, windowMs: 60_000 })
    const middleware = rateLimit(limiter, "test", "slow down")
    const viaSocket = (address: string) => {
      const res = new FakeRes()
      const next = jest.fn()
      middleware({ headers: {}, socket: { remoteAddress: address } } as any, res as any, next)
      return next.mock.calls.length ? "allowed" : res.statusCode
    }
    expect([viaSocket("::ffff:192.0.2.1"), viaSocket("::ffff:192.0.2.2"), viaSocket("192.0.2.1")]).toEqual([
      "allowed",
      "allowed",
      429,
    ])
  })
})

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
