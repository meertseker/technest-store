import { NextRequest } from "next/server"
import { describe, expect, it } from "vitest"
import { middleware } from "./middleware"

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

  it("sets the cache id cookie once", async () => {
    const res = await middleware(req("/"))
    expect(res.cookies.get("_medusa_cache_id")?.value).toBeTruthy()
    const again = await middleware(req("/", "_medusa_cache_id=abc"))
    expect(again.cookies.get("_medusa_cache_id")).toBeUndefined()
  })
})
