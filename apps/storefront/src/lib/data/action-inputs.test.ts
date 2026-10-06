import { beforeEach, describe, expect, it, vi } from "vitest"

const addToCart = vi.fn()
const acceptTransferRequest = vi.fn()
const declineTransferRequest = vi.fn()
const signup = vi.fn()
const confirmEmailVerification = vi.fn()

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }))
vi.mock("next/navigation", () => ({ redirect: vi.fn() }))
vi.mock("@lib/config", () => ({ sdk: {} }))
vi.mock("./cookies", () => ({ getAuthHeaders: async () => ({}), getCacheTag: async () => "" }))
vi.mock("./cart", () => ({
  addToCart: (...a: unknown[]) => addToCart(...a),
  deleteLineItem: vi.fn(),
  updateLineItem: vi.fn(),
}))
vi.mock("./orders", () => ({
  acceptTransferRequest: (...a: unknown[]) => acceptTransferRequest(...a),
  declineTransferRequest: (...a: unknown[]) => declineTransferRequest(...a),
}))
vi.mock("./customer", () => ({
  signup: (...a: unknown[]) => signup(...a),
  login: vi.fn(),
  signout: vi.fn(),
  transferCart: vi.fn(),
  confirmEmailVerification: (...a: unknown[]) => confirmEmailVerification(...a),
}))

import { confirmEmailVerificationAction, createAccountAfterOrderAction } from "./account-actions"
import { addToBasket } from "./basket-actions"
import { acceptTransferAction, declineTransferAction } from "./order-actions"

beforeEach(() => {
  vi.clearAllMocks()
})

// Server actions are public endpoints: each checks its own arguments.
describe("addToBasket", () => {
  it("adds a valid variant and quantity", async () => {
    addToCart.mockResolvedValue(undefined)
    await expect(addToBasket({ variantId: "variant_01ABC", quantity: 2 })).resolves.toEqual({ ok: true })
    expect(addToCart).toHaveBeenCalledWith({ variantId: "variant_01ABC", quantity: 2, countryCode: "gb" })
  })

  it.each([
    { variantId: "", quantity: 1 },
    { variantId: "variant_1/../../carts", quantity: 1 },
    { variantId: { $ne: "" }, quantity: 1 },
    { variantId: "variant_1", quantity: 0 },
    { variantId: "variant_1", quantity: 1.5 },
    { variantId: "variant_1", quantity: 100 },
    { variantId: "variant_1", quantity: "many" },
  ])("refuses %j without calling the backend", async (input) => {
    await expect(addToBasket(input)).resolves.toEqual({ ok: false, reason: "invalid" })
    expect(addToCart).not.toHaveBeenCalled()
  })

  it("reports not-enough-stock as a value, so a production build can show it", async () => {
    addToCart.mockRejectedValue(new Error("Some variant does not have the required inventory."))
    await expect(addToBasket({ variantId: "variant_1", quantity: 5 })).resolves.toEqual({ ok: false, reason: "stock" })
  })

  it("reports any other failure as a generic error", async () => {
    addToCart.mockRejectedValue(new Error("fetch failed"))
    await expect(addToBasket({ variantId: "variant_1", quantity: 1 })).resolves.toEqual({ ok: false, reason: "error" })
  })
})

describe("order transfer actions", () => {
  it("pass a well-formed id and token on and return only the outcome", async () => {
    acceptTransferRequest.mockResolvedValue({ success: true, error: null, order: { id: "order_1", email: "a@b.co" } })
    await expect(acceptTransferAction("order_1", "tok")).resolves.toEqual({ success: true })
    declineTransferRequest.mockResolvedValue({ success: false, error: "Invalid token: jwt malformed", order: null })
    await expect(declineTransferAction("order_1", "tok")).resolves.toEqual({ success: false })
  })

  it.each([
    ["order_1/../../customers/me", "tok"],
    [{ id: "order_1" }, "tok"],
    ["order_1", ""],
    ["order_1", { token: "tok" }],
    ["order_1", "x".repeat(2001)],
  ])("refuse %j / %j without calling the backend", async (id, token) => {
    await expect(acceptTransferAction(id, token)).resolves.toEqual({ success: false })
    await expect(declineTransferAction(id, token)).resolves.toEqual({ success: false })
    expect(acceptTransferRequest).not.toHaveBeenCalled()
    expect(declineTransferRequest).not.toHaveBeenCalled()
  })
})

describe("confirmEmailVerificationAction", () => {
  it("refuses anything that is not a token string", async () => {
    await expect(confirmEmailVerificationAction({ code: "x" })).resolves.toEqual({ success: false })
    await expect(confirmEmailVerificationAction("")).resolves.toEqual({ success: false })
    expect(confirmEmailVerification).not.toHaveBeenCalled()
  })

  it("returns only whether it worked", async () => {
    confirmEmailVerification.mockResolvedValue({ success: false, error: "Error: token for a@b.co expired" })
    await expect(confirmEmailVerificationAction("tok")).resolves.toEqual({ success: false })
  })
})

describe("createAccountAfterOrderAction", () => {
  const form = (fields: Record<string, string>) => {
    const fd = new FormData()
    for (const [k, v] of Object.entries(fields)) fd.set(k, v)
    return fd
  }
  const good = { email: "sam@example.com", first_name: "Sam", last_name: "Lee", phone: "", password: "long enough" }

  it("creates the account from valid fields", async () => {
    signup.mockResolvedValue({ state: "success" })
    await expect(createAccountAfterOrderAction(null, form(good))).resolves.toEqual({ state: "success" })
    expect(signup).toHaveBeenCalledWith(expect.objectContaining({ email: "sam@example.com", password: "long enough" }))
  })

  it.each([
    { ...good, email: "not-an-email" },
    { ...good, password: "short" },
    { ...good, password: "x".repeat(201) },
    { ...good, first_name: "x".repeat(101) },
  ])("refuses invalid fields without calling the backend", async (fields) => {
    await expect(createAccountAfterOrderAction(null, form(fields))).resolves.toEqual({ state: "error", error: "invalid" })
    expect(signup).not.toHaveBeenCalled()
  })

  it("never sends the backend's own error text to the browser", async () => {
    signup.mockResolvedValue({ state: "error", error: "Error: Identity with email sam@example.com already exists" })
    const result = await createAccountAfterOrderAction(null, form(good))
    expect(result).toEqual({ state: "error", error: "failed" })
  })
})
