import { beforeEach, describe, expect, it, vi } from "vitest"

const updateCart = vi.fn()
const retrieveCart = vi.fn()
const setShippingMethod = vi.fn()
const getBasketView = vi.fn()
const postcodeExists = vi.fn()
const redirect = vi.fn((to: string) => {
  throw Object.assign(new Error("NEXT_REDIRECT"), { to })
})

vi.mock("server-only", () => ({}))
vi.mock("next/navigation", () => ({ redirect: (to: string) => redirect(to) }))
vi.mock("./cart", () => ({
  updateCart: (...a: unknown[]) => updateCart(...a),
  retrieveCart: (...a: unknown[]) => retrieveCart(...a),
  setShippingMethod: (...a: unknown[]) => setShippingMethod(...a),
}))
vi.mock("./basket", () => ({
  CHECKOUT_CART_FIELDS: "*items",
  getBasketView: (...a: unknown[]) => getBasketView(...a),
}))
vi.mock("@lib/checkout/postcode", async (original) => ({
  ...(await original<typeof import("@lib/checkout/postcode")>()),
  postcodeExists: (...a: unknown[]) => postcodeExists(...a),
}))

import { saveContact, saveDelivery, type CheckoutFormState } from "./checkout-actions"

const EMPTY: CheckoutFormState = { errors: [], values: {}, submission: 0 }

const form = (fields: Record<string, string>) => {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("saveContact", () => {
  it("moves on to the next step when the email is saved", async () => {
    updateCart.mockResolvedValue({ id: "cart_1", email: "sam@example.com" })
    await expect(saveContact(EMPTY, form({ email: "sam@example.com" }))).rejects.toMatchObject({
      to: "/checkout?step=delivery",
    })
  })

  it("tells a shopper who typed a trade account's email to sign in", async () => {
    // what lib/data/cart.ts throws for the backend's 401
    updateCart.mockRejectedValue(Object.assign(new Error("Error setting up the request: Unauthorized"), { status: 401 }))
    const state = await saveContact(EMPTY, form({ email: "trade@example.com" }))
    expect(state.errors).toEqual([
      {
        field: "email",
        message: "This email belongs to a trade account. Sign in to use this email, or enter a different one.",
      },
    ])
    expect(state.values).toEqual({ email: "trade@example.com" })
  })

  it("any other failure is the generic message, never the backend's text", async () => {
    updateCart.mockRejectedValue(Object.assign(new Error("Error setting up the request: column x"), { status: 500 }))
    const state = await saveContact(EMPTY, form({ email: "sam@example.com" }))
    expect(state.errors).toEqual([
      { field: "email", message: "Something went wrong saving your details. Please try again." },
    ])
  })
})

describe("saveDelivery: a postcode the lookup does not know", () => {
  const cart = { id: "cart_1", email: "sam@example.com", items: [{ id: "li_1" }] }
  const delivery = (extra: Record<string, string> = {}) =>
    form({
      option_id: "so_standard",
      first_name: "Sam",
      last_name: "Lee",
      phone: "",
      address_1: "1 New Build Road",
      address_2: "",
      city: "London",
      postal_code: "se16 9zz",
      ...extra,
    })

  beforeEach(() => {
    retrieveCart.mockResolvedValue(cart)
    getBasketView.mockResolvedValue({
      addon_only: false,
      choices: [{ id: "so_standard", kind: "standard", available: true }],
    })
    updateCart.mockResolvedValue({ ...cart, shipping_address: { postal_code: "SE16 9ZZ" } })
    setShippingMethod.mockResolvedValue(undefined)
  })

  it("the first time, asks the shopper to check it and saves nothing", async () => {
    postcodeExists.mockResolvedValue(false)
    const state = await saveDelivery(EMPTY, delivery())
    expect(state.errors).toHaveLength(1)
    expect(state.errors[0].field).toBe("postal_code")
    expect(state.errors[0].message).toMatch(/can't find that postcode/i)
    expect(state.errors[0].message).toMatch(/Continue to payment/)
    // remembered, so the same postcode sent again is accepted
    expect(state.values.postcode_confirmed).toBe("SE16 9ZZ")
    expect(updateCart).not.toHaveBeenCalled()
  })

  it("the second time with the same postcode, accepts it as typed", async () => {
    postcodeExists.mockResolvedValue(false)
    await expect(saveDelivery(EMPTY, delivery({ postcode_confirmed: "SE16 9ZZ" }))).rejects.toMatchObject({
      to: expect.stringContaining("/checkout?step="),
    })
    expect(updateCart).toHaveBeenCalledWith(
      expect.objectContaining({ shipping_address: expect.objectContaining({ postal_code: "SE16 9ZZ" }) })
    )
    expect(setShippingMethod).toHaveBeenCalled()
  })

  it("a different postcode is looked up again", async () => {
    postcodeExists.mockResolvedValue(false)
    const state = await saveDelivery(EMPTY, delivery({ postal_code: "SE16 8ZZ", postcode_confirmed: "SE16 9ZZ" }))
    expect(state.errors[0]?.field).toBe("postal_code")
    expect(state.values.postcode_confirmed).toBe("SE16 8ZZ")
    expect(updateCart).not.toHaveBeenCalled()
  })

  it("a postcode in the wrong format can never be confirmed", async () => {
    postcodeExists.mockResolvedValue(false)
    const state = await saveDelivery(EMPTY, delivery({ postal_code: "12345", postcode_confirmed: "12345" }))
    expect(state.errors[0]).toMatchObject({ field: "postal_code", message: "Enter a full UK postcode, like SE16 3TU" })
    expect(updateCart).not.toHaveBeenCalled()
  })

  it("a known postcode goes straight through", async () => {
    postcodeExists.mockResolvedValue(true)
    await expect(saveDelivery(EMPTY, delivery({ postal_code: "SE16 3TU" }))).rejects.toMatchObject({
      to: expect.stringContaining("/checkout?step="),
    })
    expect(updateCart).toHaveBeenCalled()
  })
})
