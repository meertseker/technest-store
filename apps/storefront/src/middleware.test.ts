import { NextRequest } from "next/server"
import { describe, expect, it } from "vitest"
import { config, middleware } from "./middleware"

const req = (path: string, cookie?: string) =>
  new NextRequest(new URL(path, "http://localhost:8003"), {
    headers: cookie ? { cookie } : {},
  })

describe("middleware", () => {
  it("redirects legacy country-prefixed paths with 308", async () => {
    const res = await middleware(req("/dk/products/usb-c-cable?x=1"))
    expect(res.status).toBe(308)
    expect(res.headers.get("location")).toBe(
      "http://localhost:8003/products/usb-c-cable?x=1"
    )
  })

  it("redirects a bare country root to /", async () => {
    const res = await middleware(req("/gb"))
    expect(res.headers.get("location")).toBe("http://localhost:8003/")
  })

  it("does not treat two-letter real routes as countries", async () => {
    const res = await middleware(req("/c/cases"))
    expect(res.headers.get("location")).toBeNull()
  })

  it("sets the cache id cookie httpOnly and sameSite=lax", async () => {
    const res = await middleware(req("/"))
    const setCookie = res.headers.get("set-cookie") ?? ""
    expect(setCookie).toMatch(/_medusa_cache_id=/)
    expect(setCookie.toLowerCase()).toContain("httponly")
    expect(setCookie.toLowerCase()).toContain("samesite=lax")
  })

  it("sets the cache id cookie once", async () => {
    const res = await middleware(req("/"))
    expect(res.cookies.get("_medusa_cache_id")?.value).toBeTruthy()
    const again = await middleware(req("/", "_medusa_cache_id=abc"))
    expect(again.cookies.get("_medusa_cache_id")).toBeUndefined()
  })
})

describe("middleware matcher", () => {
  // Next anchors the matcher source like this when compiling it
  const runsOn = (path: string) => new RegExp(`^${config.matcher[0]}$`).test(path)

  it.each([
    "/gb/products/silicone-case",
    "/dk/categories/gifts",
    "/products/notification-light",
    "/",
  ])("runs on page path %s", (path) => {
    expect(runsOn(path)).toBe(true)
  })

  it.each(["/api/health", "/images/shop/shopfront.jpg", "/robots.txt", "/_next/static/x.js"])(
    "skips %s",
    (path) => {
      expect(runsOn(path)).toBe(false)
    }
  )
})

describe("middleware: /checkout Content-Security-Policy", () => {
  const cspOf = (res: Response) => res.headers.get("content-security-policy") ?? ""
  const nonceOf = (csp: string) => /'nonce-([^']+)'/.exec(csp)?.[1]

  it("sends a nonce-based CSP on /checkout and forwards it to Next for its own scripts", async () => {
    const res = await middleware(req("/checkout?step=payment"))
    const csp = cspOf(res)
    expect(csp).toContain("script-src")
    expect(csp).toContain("https://js.stripe.com")
    expect(nonceOf(csp)).toBeTruthy()
    expect(res.headers.get("x-middleware-request-content-security-policy")).toBe(csp)
    expect(res.headers.get("x-middleware-request-x-nonce")).toBe(nonceOf(csp))
  })

  it("uses a fresh nonce for every request", async () => {
    const a = nonceOf(cspOf(await middleware(req("/checkout"))))
    const b = nonceOf(cspOf(await middleware(req("/checkout"))))
    expect(a).toBeTruthy()
    expect(a).not.toBe(b)
  })

  it("covers checkout sub-paths but not look-alikes or other pages", async () => {
    expect(cspOf(await middleware(req("/checkout/review")))).toContain("script-src")
    expect(cspOf(await middleware(req("/checkouts")))).toBe("")
    expect(cspOf(await middleware(req("/cart")))).toBe("")
  })

  it("still sets the cache cookie on /checkout", async () => {
    const res = await middleware(req("/checkout"))
    expect(res.cookies.get("_medusa_cache_id")?.value).toBeTruthy()
  })
})

describe("middleware matcher", () => {
  // Guards the /checkout CSP: if the matcher ever stops covering checkout, fail here.
  const matches = (path: string) =>
    config.matcher.some((m: string) => new RegExp(`^${m}$`).test(path))

  it("runs on /checkout and its sub-paths", () => {
    expect(matches("/checkout")).toBe(true)
    expect(matches("/checkout/review")).toBe(true)
  })
})

