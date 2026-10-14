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
    updateCart.mockRejectedValue(Object.assign(new Error("Unauthorized."), { status: 401 }))
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
    updateCart.mockRejectedValue(Object.assign(new Error("Column x."), { status: 500 }))
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

// Two backend calls save the delivery step, and Medusa has no call to take a
// method off a basket. Whatever fails, the basket must never end up with the
// new method against the old address (say the shop's Click & Collect address
// on a home delivery).
describe("saveDelivery: method and address change together or not at all", () => {
  const cart = { id: "cart_1", email: "sam@example.com", items: [{ id: "li_1" }] }
  const withMethod = (optionId: string) => ({ ...cart, shipping_methods: [{ id: "sm_1", shipping_option_id: optionId }] })
  const collect = () =>
    form({ option_id: "so_collect", first_name: "Sam", last_name: "Lee", phone: "", address_1: "", address_2: "", city: "", postal_code: "" })
  const boom = () => Object.assign(new Error("Boom."), { status: 500 })
  const SERVICE = [{ field: "option", message: "Something went wrong saving your details. Please try again." }]

  beforeEach(() => {
    retrieveCart.mockResolvedValue(cart)
    getBasketView.mockResolvedValue({
      addon_only: false,
      choices: [{ id: "so_collect", kind: "collect", available: true }],
    })
    postcodeExists.mockResolvedValue(true)
    updateCart.mockResolvedValue({ ...cart, shipping_address: { first_name: "Sam" } })
    setShippingMethod.mockResolvedValue(undefined)
  })

  describe("a basket that already has a method", () => {
    beforeEach(() => retrieveCart.mockResolvedValue(withMethod("so_standard")))

    it("the method goes first; refused, the address is left as it was", async () => {
      setShippingMethod.mockRejectedValue(Object.assign(new Error("Not allowed."), { status: 400 }))
      const state = await saveDelivery(EMPTY, collect())
      expect(setShippingMethod).toHaveBeenCalledWith({ cartId: "cart_1", shippingMethodId: "so_collect" })
      expect(updateCart).not.toHaveBeenCalled()
      expect(state.errors).toEqual(SERVICE)
      expect(redirect).not.toHaveBeenCalled()
    })

    it("when both succeed, the method call came first", async () => {
      await expect(saveDelivery(EMPTY, collect())).rejects.toMatchObject({ to: "/checkout?step=payment" })
      expect(setShippingMethod.mock.invocationCallOrder[0]).toBeLessThan(updateCart.mock.invocationCallOrder[0])
    })

    it("when the address save then fails, the previous method is put back", async () => {
      updateCart.mockRejectedValue(boom())
      const state = await saveDelivery(EMPTY, collect())
      expect(setShippingMethod.mock.calls.map(([a]) => a.shippingMethodId)).toEqual(["so_collect", "so_standard"])
      expect(state.errors).toEqual(SERVICE)
      expect(redirect).not.toHaveBeenCalled()
    })

    it("the same method again needs nothing put back", async () => {
      retrieveCart.mockResolvedValue(withMethod("so_collect"))
      updateCart.mockRejectedValue(boom())
      await saveDelivery(EMPTY, collect())
      expect(setShippingMethod).toHaveBeenCalledTimes(1)
    })

    it("if putting the method back fails too, the shopper still gets the error and can retry", async () => {
      updateCart.mockRejectedValue(boom())
      setShippingMethod.mockResolvedValueOnce(undefined).mockRejectedValueOnce(boom())
      const state = await saveDelivery(EMPTY, collect())
      expect(setShippingMethod).toHaveBeenCalledTimes(2)
      expect(state.errors).toEqual(SERVICE)
    })
  })

  describe("a basket without a method yet", () => {
    it("the address goes first, so a failure leaves no method behind", async () => {
      updateCart.mockRejectedValue(boom())
      const state = await saveDelivery(EMPTY, collect())
      expect(setShippingMethod).not.toHaveBeenCalled()
      expect(state.errors).toEqual(SERVICE)
      expect(redirect).not.toHaveBeenCalled()
    })

    it("a refused method after the address leaves the step unfinished (address, no method)", async () => {
      setShippingMethod.mockRejectedValue(Object.assign(new Error("Not allowed."), { status: 400 }))
      const state = await saveDelivery(EMPTY, collect())
      expect(updateCart.mock.invocationCallOrder[0]).toBeLessThan(setShippingMethod.mock.invocationCallOrder[0])
      expect(state.errors).toEqual(SERVICE)
      expect(redirect).not.toHaveBeenCalled()
    })

    it("when both succeed, the shopper moves on to payment", async () => {
      await expect(saveDelivery(EMPTY, collect())).rejects.toMatchObject({ to: "/checkout?step=payment" })
    })
  })
})
