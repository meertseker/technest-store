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

import { getAuthHeaders, setAuthToken } from "./cookies"

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
