import { beforeEach, describe, expect, it, vi } from "vitest"

const authRegister = vi.fn()
const authLogin = vi.fn()
const customerRetrieve = vi.fn()
const customerCreate = vi.fn()
const clientFetch = vi.fn()
const jar: Record<string, string> = {}

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }))
vi.mock("next/navigation", () => ({ redirect: vi.fn() }))
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar[name] ? { value: jar[name] } : undefined),
    set: (name: string, value: string) => {
      jar[name] = value
    },
  }),
}))
vi.mock("@lib/config", () => ({
  sdk: {
    client: { fetch: (...a: unknown[]) => clientFetch(...a) },
    auth: {
      register: (...a: unknown[]) => authRegister(...a),
      login: (...a: unknown[]) => authLogin(...a),
      verification: { request: vi.fn() },
    },
    store: {
      customer: {
        retrieve: (...a: unknown[]) => customerRetrieve(...a),
        create: (...a: unknown[]) => customerCreate(...a),
      },
      cart: { transferCart: vi.fn() },
    },
  },
}))

import { login, retrieveCustomer, signup } from "./customer"

const unauthorized = () => Object.assign(new Error("Invalid email or password"), { status: 401, statusText: "Unauthorized" })

beforeEach(() => {
  vi.clearAllMocks()
  for (const k of Object.keys(jar)) delete jar[k]
  authRegister.mockResolvedValue("register-token")
  authLogin.mockResolvedValue("login-token")
  customerRetrieve.mockResolvedValue({ customer: { id: "cus_1" } })
  customerCreate.mockResolvedValue({ customer: { id: "cus_1" } })
})

describe("email addresses are one spelling everywhere", () => {
  it("registering as Sam@Example.COM creates the lower-case account the reset email looks for", async () => {
    customerRetrieve.mockRejectedValueOnce(unauthorized()) // no customer record yet
    const result = await signup({
      email: "  Sam@Example.COM ",
      password: "Secret-Pass1",
      first_name: "Sam",
      last_name: "Lee",
      phone: "",
    })
    expect(result).toEqual({ state: "success" })
    expect(authRegister).toHaveBeenCalledWith("customer", "emailpass", {
      email: "sam@example.com",
      password: "Secret-Pass1",
    })
    expect(customerCreate.mock.calls[0][0]).toMatchObject({ email: "sam@example.com" })
    for (const call of authLogin.mock.calls) expect(call[2]).toMatchObject({ email: "sam@example.com" })
  })

  it("signing in as Sam@Example.COM finds that account, with the password untouched", async () => {
    await expect(login("Sam@Example.COM", "Secret-Pass1")).resolves.toEqual({ state: "success" })
    expect(authLogin).toHaveBeenCalledTimes(1)
    expect(authLogin).toHaveBeenCalledWith("customer", "emailpass", {
      email: "sam@example.com",
      password: "Secret-Pass1",
    })
  })

  it("an older account stored with capitals can still sign in", async () => {
    authLogin.mockRejectedValueOnce(unauthorized()).mockResolvedValueOnce("login-token")
    await expect(login("Sam@Example.com", "Secret-Pass1")).resolves.toEqual({ state: "success" })
    expect(authLogin.mock.calls.map((c) => c[2].email)).toEqual(["sam@example.com", "Sam@Example.com"])
  })

  it("a wrong password for a lower-case email is tried once, not twice", async () => {
    authLogin.mockRejectedValue(unauthorized())
    const result = await login("sam@example.com", "wrong")
    expect(result?.state).toBe("error")
    expect(authLogin).toHaveBeenCalledTimes(1)
  })
})

describe("retrieveCustomer", () => {
  it("asks the backend nothing for a guest", async () => {
    await expect(retrieveCustomer()).resolves.toBeNull()
    expect(clientFetch).not.toHaveBeenCalled()
  })

  it("is null when the backend no longer accepts the sign-in", async () => {
    jar._medusa_jwt = "token"
    clientFetch.mockRejectedValue(unauthorized())
    await expect(retrieveCustomer()).resolves.toBeNull()
  })

  it("returns the customer", async () => {
    jar._medusa_jwt = "token"
    clientFetch.mockResolvedValue({ customer: { id: "cus_1" } })
    await expect(retrieveCustomer()).resolves.toEqual({ id: "cus_1" })
  })
})
