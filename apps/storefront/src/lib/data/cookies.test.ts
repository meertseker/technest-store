import { beforeEach, describe, expect, it, vi } from "vitest"

const jar: Record<string, string> = {}
const setCookie = vi.fn()

vi.mock("server-only", () => ({}))
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar[name] ? { value: jar[name] } : undefined),
    set: (name: string, value: string, options?: Record<string, unknown>) => setCookie(name, value, options),
  }),
}))

import { getAuthHeaders, getRecentOrderId, setAuthToken, setRecentOrderId } from "./cookies"

const b64url = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url")
const jwt = (payload: Record<string, unknown>) => `${b64url({ alg: "HS256" })}.${b64url(payload)}.sig`
const inSeconds = (s: number) => Math.floor(Date.now() / 1000) + s

beforeEach(() => {
  setCookie.mockReset()
  for (const k of Object.keys(jar)) delete jar[k]
})

describe("the sign-in cookie", () => {
  it("expires with the backend's token instead of outliving it", async () => {
    await setAuthToken(jwt({ actor_id: "cus_1", exp: inSeconds(86_400) }))
    const [name, , options] = setCookie.mock.calls[0]
    expect(name).toBe("_medusa_jwt")
    expect(options.maxAge).toBeGreaterThan(86_400 - 120)
    expect(options.maxAge).toBeLessThanOrEqual(86_400 - 60)
    expect(options).toMatchObject({ httpOnly: true, sameSite: "lax" })
  })
})

describe("getAuthHeaders", () => {
  it("sends the token while it is valid", async () => {
    const token = jwt({ actor_id: "cus_1", exp: inSeconds(600) })
    jar._medusa_jwt = token
    await expect(getAuthHeaders()).resolves.toEqual({ authorization: `Bearer ${token}` })
  })

  it("treats a visitor whose token has expired as signed out", async () => {
    jar._medusa_jwt = jwt({ actor_id: "cus_1", exp: inSeconds(-5) })
    await expect(getAuthHeaders()).resolves.toEqual({})
  })

  it("is empty for a guest", async () => {
    await expect(getAuthHeaders()).resolves.toEqual({})
  })
})

// The confirmation page shows a guest their order only while this cookie
// names it: a link opened later, by someone else, gets the reduced view.
describe("the recent-order cookie", () => {
  it("names the order for a day, hidden from scripts, and survives the return from a bank page", async () => {
    await setRecentOrderId("order_1")
    const [name, value, options] = setCookie.mock.calls[0]
    expect(name).toBe("_technest_order")
    expect(value).toBe("order_1")
    expect(options).toMatchObject({ maxAge: 60 * 60 * 24, httpOnly: true, sameSite: "lax" })
  })

  it("is read back, and is undefined for a visitor who has not just ordered", async () => {
    await expect(getRecentOrderId()).resolves.toBeUndefined()
    jar._technest_order = "order_1"
    await expect(getRecentOrderId()).resolves.toBe("order_1")
  })
})
