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
const captureException = vi.fn()
vi.mock("@sentry/nextjs", () => ({ captureException: (...a: unknown[]) => captureException(...a) }))
/** What reaches monitoring: [error, where it was handled] */
const reported = () => captureException.mock.calls.map(([error, hint]) => [error, hint?.tags?.handled_in])

import { completeOrder, preparePaymentSession } from "./actions"
import { ORDER_FAILED, PAYMENT_NOT_AUTHORISED, SESSION_FAILED } from "./helpers"

const backendDown = Object.assign(new Error("Service Unavailable"), { status: 503 })
const cart = { id: "cart_1", region_id: "reg_1", total: 10, items: [{ id: "li_1" }] }

beforeEach(() => {
  retrieveCart.mockReset()
  placeOrder.mockReset()
  initiatePaymentSession.mockReset()
  getPaymentMode.mockReset()
  captureException.mockReset()
  vi.stubEnv("SENTRY_DSN", "https://key@example.invalid/1")
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

describe("an order that could not be placed reaches monitoring", () => {
  it("a backend failure after the card step is reported", async () => {
    const error = Object.assign(new Error("Error setting up the request: boom"), { status: 500 })
    retrieveCart.mockResolvedValue(cart)
    placeOrder.mockRejectedValue(error)
    await expect(completeOrder()).resolves.toEqual({ ok: false, message: ORDER_FAILED })
    expect(reported()).toEqual([[error, "checkout.place-order"]])
  })

  it("a refusal that released the hold is an ordinary outcome, not an alert", async () => {
    retrieveCart.mockResolvedValue(cart)
    placeOrder.mockRejectedValue(Object.assign(new Error("Out of stock."), { payment_released: true }))
    await completeOrder()
    expect(reported()).toEqual([])
  })
})

describe("an order the backend refused because the payment was not authorised", () => {
  it("is worded as a payment problem, not as an authorised payment without an order", async () => {
    retrieveCart.mockResolvedValue(cart)
    placeOrder.mockRejectedValue(Object.assign(new Error("Payment authorization failed"), { payment_not_authorised: true }))
    await expect(completeOrder()).resolves.toEqual({ ok: false, message: PAYMENT_NOT_AUTHORISED })
    expect(PAYMENT_NOT_AUTHORISED).not.toContain("authorised but")
    expect(reported()).toEqual([])
  })
})
