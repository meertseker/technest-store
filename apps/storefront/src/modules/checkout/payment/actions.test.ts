import { beforeEach, describe, expect, it, vi } from "vitest"

const retrieveCart = vi.fn()
const placeOrder = vi.fn()
const initiatePaymentSession = vi.fn()
const getPaymentMode = vi.fn()

vi.mock("server-only", () => ({}))
vi.mock("next/navigation", () => ({ unstable_rethrow: vi.fn() }))
vi.mock("@lib/data/basket", () => ({ CHECKOUT_CART_FIELDS: "*items" }))
vi.mock("@lib/data/cart", () => ({
  retrieveCart: (...a: unknown[]) => retrieveCart(...a),
  placeOrder: (...a: unknown[]) => placeOrder(...a),
  initiatePaymentSession: (...a: unknown[]) => initiatePaymentSession(...a),
}))
vi.mock("./mode", () => ({ getPaymentMode: (...a: unknown[]) => getPaymentMode(...a) }))

import { completeOrder, preparePaymentSession } from "./actions"
import { ORDER_FAILED, SESSION_FAILED } from "./helpers"

const backendDown = Object.assign(new Error("Service Unavailable"), { status: 503 })
const cart = { id: "cart_1", region_id: "reg_1", total: 10, items: [{ id: "li_1" }] }

beforeEach(() => {
  retrieveCart.mockReset()
  placeOrder.mockReset()
  initiatePaymentSession.mockReset()
  getPaymentMode.mockReset()
  getPaymentMode.mockResolvedValue("stripe")
})

describe("payment step actions when the basket cannot be read", () => {
  it("preparing the payment form reports a loading problem, not a changed basket", async () => {
    retrieveCart.mockRejectedValue(backendDown)
    await expect(preparePaymentSession()).resolves.toEqual({ ok: false, message: SESSION_FAILED })
  })

  it("placing the order reports that the order could not be placed", async () => {
    retrieveCart.mockRejectedValue(backendDown)
    await expect(completeOrder()).resolves.toEqual({ ok: false, message: ORDER_FAILED })
    expect(placeOrder).not.toHaveBeenCalled()
  })
})

describe("placing an order for a basket the payment webhook already completed", () => {
  it("still asks the backend to complete it, which answers with the existing order", async () => {
    // retrieveCart hides completed baskets unless asked for them
    retrieveCart.mockImplementation(async (_id, _fields, options?: { includeCompleted?: boolean }) =>
      options?.includeCompleted ? { ...cart, completed_at: "2026-10-06T10:00:00Z" } : null
    )
    placeOrder.mockResolvedValue(undefined)
    await completeOrder()
    expect(placeOrder).toHaveBeenCalledWith("cart_1")
    expect(initiatePaymentSession).not.toHaveBeenCalled()
  })

  it("does not create a manual payment session on a completed basket", async () => {
    getPaymentMode.mockResolvedValue("manual")
    retrieveCart.mockResolvedValue({ ...cart, completed_at: "2026-10-06T10:00:00Z" })
    placeOrder.mockResolvedValue(undefined)
    await completeOrder()
    expect(initiatePaymentSession).not.toHaveBeenCalled()
    expect(placeOrder).toHaveBeenCalledWith("cart_1")
  })

  it("an open basket is completed as before", async () => {
    retrieveCart.mockResolvedValue(cart)
    placeOrder.mockResolvedValue(undefined)
    await expect(completeOrder()).resolves.toEqual({ ok: false, message: ORDER_FAILED })
    expect(placeOrder).toHaveBeenCalledWith("cart_1")
  })
})
