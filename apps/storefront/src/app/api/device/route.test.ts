import { NextRequest } from "next/server"
import { describe, expect, it, vi } from "vitest"
import { MOCK_DEVICE_TREE } from "@/lib/devices/mock"
import { POST as clear } from "./clear/route"
import { POST as choose } from "./route"

vi.mock("@lib/data/devices", () => ({ listDevices: async () => MOCK_DEVICE_TREE }))

const post = (path: string, fields: Record<string, string>, headers: Record<string, string> = {}) => {
  const body = new FormData()
  for (const [k, v] of Object.entries(fields)) body.set(k, v)
  return new NextRequest(`http://localhost:8003${path}`, {
    method: "POST",
    body,
    headers: { origin: "http://localhost:8003", host: "localhost:8003", ...headers },
  })
}
const setCookie = (res: Response) => res.headers.get("set-cookie") ?? ""

describe("POST /api/device (choose)", () => {
  it("sets an httpOnly lax tn_device cookie and 303s home", async () => {
    const res = await choose(post("/api/device", { slug: "iphone-15-pro" }))
    expect(res.status).toBe(303)
    expect(res.headers.get("location")).toBe("/")
    const c = setCookie(res)
    expect(c).toMatch(/^tn_device=iphone-15-pro;/)
    expect(c).toMatch(/HttpOnly/i)
    expect(c).toMatch(/SameSite=lax/i)
    expect(c).toMatch(/Path=\//)
    expect(c).toMatch(/Max-Age=31536000/)
  })

  it("returns to the exact returnTo, query string included, no trailing slash", async () => {
    const res = await choose(post("/api/device", { slug: "ps5", returnTo: "/cart?ref=x&y=1" }))
    expect(res.headers.get("location")).toBe("/cart?ref=x&y=1")
    const help = await choose(post("/api/device", { slug: "ps5", returnTo: "/devices/help" }))
    expect(help.headers.get("location")).toBe("/devices/help")
  })

  it("never redirects off-site or back to the picker", async () => {
    for (const returnTo of ["//evil.example", "https://evil.example", "/\\evil.example", "/devices/", "/devices"]) {
      const res = await choose(post("/api/device", { slug: "ps5", returnTo }))
      expect(res.headers.get("location"), returnTo).toBe("/")
    }
  })

  it("rejects unknown or malformed slugs without setting the cookie", async () => {
    for (const slug of ["iphone-99", "Not A Slug", ""]) {
      const res = await choose(post("/api/device", { slug, returnTo: "/cart" }))
      expect(res.status).toBe(303)
      expect(res.headers.get("location")).toBe("/devices?returnTo=%2Fcart")
      expect(setCookie(res)).toBe("")
    }
  })

  it("refuses cross-site posts (CSRF)", async () => {
    const res = await choose(
      post("/api/device", { slug: "ps5" }, { origin: "https://evil.example", "sec-fetch-site": "cross-site" })
    )
    expect(res.status).toBe(403)
    expect(setCookie(res)).toBe("")
  })
})

describe("POST /api/device/clear", () => {
  it("deletes the cookie and 303s to the picker", async () => {
    const res = await clear(post("/api/device/clear", {}))
    expect(res.status).toBe(303)
    expect(res.headers.get("location")).toBe("/devices")
    expect(setCookie(res)).toMatch(/^tn_device=;/)
    expect(setCookie(res)).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0/)
  })

  it("returns to a valid returnTo only", async () => {
    const ok = await clear(post("/api/device/clear", { returnTo: "/cart?a=1" }))
    expect(ok.headers.get("location")).toBe("/cart?a=1")
    const bad = await clear(post("/api/device/clear", { returnTo: "//evil.example" }))
    expect(bad.headers.get("location")).toBe("/devices")
  })

  it("refuses cross-site posts (CSRF)", async () => {
    const res = await clear(post("/api/device/clear", {}, { origin: "https://evil.example" }))
    expect(res.status).toBe(403)
  })
})
