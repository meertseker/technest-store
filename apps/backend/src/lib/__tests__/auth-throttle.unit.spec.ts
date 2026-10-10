import { EventEmitter } from "events"
import { authThrottleMiddlewares, throttle, visitorIp } from "../auth-throttle"
import { MemoryThrottleStore, type ThrottleStore } from "../throttle-store"

type FakeReq = {
  method: string
  path: string
  headers: Record<string, string>
  body?: unknown
  params: Record<string, string>
  socket: { remoteAddress: string }
}

const request = (over: Partial<FakeReq> = {}): any => ({
  method: "POST",
  path: "/auth/customer/emailpass",
  headers: {},
  params: { actor_type: "customer", auth_provider: "emailpass" },
  socket: { remoteAddress: "172.18.0.5" },
  ...over,
})

class FakeRes extends EventEmitter {
  statusCode = 200
  headers: Record<string, string> = {}
  payload: unknown
  setHeader(name: string, value: string) {
    this.headers[name] = value
  }
  status(code: number) {
    this.statusCode = code
    return this
  }
  json(payload: unknown) {
    this.payload = payload
    return this
  }
}

async function run(middleware: ReturnType<typeof throttle>, req: any) {
  const res = new FakeRes()
  let passed = false
  await middleware(req, res as any, () => {
    passed = true
  })
  return { res, passed }
}

describe("visitorIp", () => {
  it("is the CF-Connecting-IP header when it is an IP address", () => {
    expect(visitorIp(request({ headers: { "cf-connecting-ip": "203.0.113.9" } }))).toBe("203.0.113.9")
  })

  it("ignores a header that is not an IP address", () => {
    expect(visitorIp(request({ headers: { "cf-connecting-ip": "x'; drop" } }))).toBeNull()
  })

  it("is null for an internal caller without the header (storefront container, tests)", () => {
    for (const peer of ["172.18.0.5", "10.0.0.3", "192.168.1.4", "127.0.0.1", "::1", "::ffff:127.0.0.1", "fd00::5"]) {
      expect(visitorIp(request({ socket: { remoteAddress: peer } }))).toBeNull()
    }
  })

  it("falls back to a public peer address", () => {
    expect(visitorIp(request({ socket: { remoteAddress: "::ffff:198.51.100.7" } }))).toBe("198.51.100.7")
  })

  it("groups IPv6 by /64", () => {
    const a = visitorIp(request({ headers: { "cf-connecting-ip": "2001:db8:1:2:aaaa:bbbb:cccc:dddd" } }))
    const b = visitorIp(request({ headers: { "cf-connecting-ip": "2001:0db8:0001:0002::1" } }))
    const other = visitorIp(request({ headers: { "cf-connecting-ip": "2001:db8:1:3::1" } }))
    expect(a).toBe("2001:db8:1:2::/64")
    expect(b).toBe(a)
    expect(other).not.toBe(a)
    expect(visitorIp(request({ headers: { "cf-connecting-ip": "2001:db8::1" } }))).toBe("2001:db8:0:0::/64")
  })
})

describe("throttle", () => {
  const rule = {
    name: () => "login:customer",
    limits: () => ({ ip: { limit: 3, windowMs: 60_000 }, email: { limit: 2, windowMs: 60_000 } }),
    email: (req: any) => req.body?.email,
    clearEmailOnSuccess: true,
  }
  const from = (ip: string, email?: string) =>
    request({ headers: { "cf-connecting-ip": ip }, body: email ? { email, password: "x" } : {} })

  it("answers 429 with Retry-After once one IP is over its limit", async () => {
    const store = new MemoryThrottleStore()
    const middleware = throttle(rule, () => store)
    for (let i = 0; i < 3; i++) {
      expect((await run(middleware, from("203.0.113.1", `user${i}@example.com`))).passed).toBe(true)
    }
    const { res, passed } = await run(middleware, from("203.0.113.1", "user9@example.com"))
    expect(passed).toBe(false)
    expect(res.statusCode).toBe(429)
    expect(res.payload).toEqual({ type: "too_many_requests", message: expect.stringContaining("Too many attempts") })
    expect(Number(res.headers["Retry-After"])).toBeGreaterThan(0)
    expect(Number(res.headers["Retry-After"])).toBeLessThanOrEqual(60)

    // Another address is not affected.
    expect((await run(middleware, from("203.0.113.2", "user9@example.com"))).passed).toBe(true)
  })

  it("counts one email across many IPs, whatever its letter case", async () => {
    const store = new MemoryThrottleStore()
    const middleware = throttle(rule, () => store)
    expect((await run(middleware, from("203.0.113.1", "Sam@Example.com"))).passed).toBe(true)
    expect((await run(middleware, from("203.0.113.2", " sam@example.com "))).passed).toBe(true)
    expect((await run(middleware, from("203.0.113.3", "SAM@EXAMPLE.COM"))).res.statusCode).toBe(429)
    expect((await run(middleware, from("203.0.113.4", "alex@example.com"))).passed).toBe(true)
  })

  it("a successful answer clears the email's counter; a failed one does not", async () => {
    const store = new MemoryThrottleStore()
    const middleware = throttle(rule, () => store)

    const failed = await run(middleware, from("203.0.113.1", "sam@example.com"))
    failed.res.statusCode = 401
    failed.res.emit("finish")
    const ok = await run(middleware, from("203.0.113.2", "sam@example.com"))
    ok.res.statusCode = 200
    ok.res.emit("finish")
    await new Promise((resolve) => setImmediate(resolve))

    // Two attempts were made, but the success wiped them: two more fit.
    expect((await run(middleware, from("203.0.113.3", "sam@example.com"))).passed).toBe(true)
    expect((await run(middleware, from("203.0.113.4", "sam@example.com"))).passed).toBe(true)
    expect((await run(middleware, from("203.0.113.5", "sam@example.com"))).res.statusCode).toBe(429)
  })

  it("does not store the email address in the counter key", async () => {
    const keys: string[] = []
    const store: ThrottleStore = {
      hit: async (key) => {
        keys.push(key)
        return { count: 1, resetMs: 1000 }
      },
      clear: async () => {},
    }
    await run(throttle(rule, () => store), from("203.0.113.1", "sam@example.com"))
    expect(keys).toHaveLength(2)
    expect(keys.join(" ")).not.toContain("sam")
    expect(keys.join(" ")).not.toContain("example.com")
  })

  it("an internal caller without a visitor IP is counted per email only", async () => {
    const store = new MemoryThrottleStore()
    const middleware = throttle(rule, () => store)
    for (let i = 0; i < 10; i++) {
      expect((await run(middleware, request({ body: { email: `user${i}@example.com` } }))).passed).toBe(true)
    }
    expect((await run(middleware, request({ body: { email: "sam@example.com" } }))).passed).toBe(true)
    expect((await run(middleware, request({ body: { email: "sam@example.com" } }))).passed).toBe(true)
    expect((await run(middleware, request({ body: { email: "sam@example.com" } }))).res.statusCode).toBe(429)
  })

  it("lets the request through when the store fails", async () => {
    const store: ThrottleStore = {
      hit: async () => {
        throw new Error("boom")
      },
      clear: async () => {},
    }
    const { passed, res } = await run(throttle(rule, () => store), from("203.0.113.1", "sam@example.com"))
    expect(passed).toBe(true)
    expect(res.statusCode).toBe(200)
  })
})

describe("authThrottleMiddlewares", () => {
  it("covers sign-in, registration, reset requests, customer creation and trade applications", () => {
    expect(authThrottleMiddlewares.map((r) => `${r.method} ${r.matcher}`)).toEqual([
      "POST /auth/:actor_type/:auth_provider",
      "POST /auth/:actor_type/:auth_provider/register",
      "POST /auth/:actor_type/:auth_provider/reset-password",
      "POST /store/customers",
      "POST /store/trade-applications",
    ])
  })

  it("has no rule that could match the payment webhook", () => {
    for (const route of authThrottleMiddlewares) {
      expect(String(route.matcher)).not.toMatch(/hooks/)
      expect(String(route.matcher).startsWith("/auth/") || String(route.matcher).startsWith("/store/")).toBe(true)
    }
  })
})
