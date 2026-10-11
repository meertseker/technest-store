import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const fetchCart = vi.fn()
const placeOrder = vi.fn()
const setCartId = vi.fn()
let cookieCartId: string | undefined

vi.mock("@lib/config", () => ({ sdk: { client: { fetch: (...a: unknown[]) => fetchCart(...a) } } }))
vi.mock("@lib/data/cart", () => ({ placeOrder: (...a: unknown[]) => placeOrder(...a) }))
vi.mock("@lib/data/cookies", () => ({
  getAuthHeaders: async () => ({}),
  getCartId: async () => cookieCartId,
  setCartId: (...a: unknown[]) => setCartId(...a),
}))

import { GET } from "./route"

// In the Docker image the request URL carries the container's own address
// (HOSTNAME=0.0.0.0), not the public host, so every redirect must be relative.
const url = (q: Record<string, string>) =>
  new NextRequest(`http://0.0.0.0:8000/api/payment-return?${new URLSearchParams(q)}`)

const good = { cart_id: "cart_1", payment_intent: "pi_1", payment_intent_client_secret: "pi_1_secret_x" }

beforeEach(() => {
  fetchCart.mockReset()
  placeOrder.mockReset()
  setCartId.mockReset()
  cookieCartId = "cart_1"
  fetchCart.mockResolvedValue({
    cart: { payment_collection: { payment_sessions: [{ data: { id: "pi_1", client_secret: "pi_1_secret_x" } }] } },
  })
})

describe("GET /api/payment-return (Stripe redirect back)", () => {
  it("rejects a request that doesn't match the cart's own session", async () => {
    const res = await GET(url({ ...good, payment_intent_client_secret: "other" }))
    expect(res.headers.get("location")).toBe("/checkout?step=payment&payment_error=payment_failed")
    expect(placeOrder).not.toHaveBeenCalled()
    expect((await GET(url({ cart_id: "cart_1" }))).headers.get("location")).toContain("payment_error=payment_failed")
  })

  it("a failed off-site step goes back to the payment step without the client secret", async () => {
    const res = await GET(url({ ...good, redirect_status: "failed" }))
    const loc = res.headers.get("location")!
    expect(loc).toBe("/checkout?step=payment&payment_error=declined")
    expect(loc).not.toContain("secret")
    expect(placeOrder).not.toHaveBeenCalled()
  })

  it("completes the cart server-side on success", async () => {
    placeOrder.mockResolvedValue({ id: "cart_1" }) // returned = not converted
    const res = await GET(url({ ...good, redirect_status: "succeeded" }))
    expect(placeOrder).toHaveBeenCalledWith("cart_1")
    expect(setCartId).toHaveBeenCalledWith("cart_1")
    expect(res.headers.get("location")).toBe("/checkout?step=payment&payment_error=order_failed")
  })

  it("an error while completing goes back with order_failed", async () => {
    placeOrder.mockRejectedValue(new Error("Payment authorization failed."))
    const res = await GET(url({ ...good, redirect_status: "succeeded" }))
    expect(res.headers.get("location")).toBe("/checkout?step=payment&payment_error=order_failed")
  })

  it("says the payment could not be confirmed when the intent was never authorised", async () => {
    placeOrder.mockRejectedValue(Object.assign(new Error("Payment authorization failed"), { payment_not_authorised: true }))
    const res = await GET(url({ ...good, redirect_status: "succeeded" }))
    expect(res.headers.get("location")).toBe("/checkout?step=payment&payment_error=payment_failed")
  })

  it("a payment the bank is still processing is not completed here, and the shopper is told to wait", async () => {
    const res = await GET(url({ ...good, redirect_status: "processing" }))
    expect(placeOrder).not.toHaveBeenCalled()
    expect(res.headers.get("location")).toBe("/checkout?step=payment&payment_error=processing")
  })

  it("says the hold was released when the backend released it", async () => {
    placeOrder.mockRejectedValue(Object.assign(new Error("Out of stock."), { payment_released: true }))
    const res = await GET(url({ ...good, redirect_status: "succeeded" }))
    expect(res.headers.get("location")).toBe("/checkout?step=payment&payment_error=hold_released")
  })

  // A link someone else prepared must never replace the basket the visitor already has.
  describe("when the visitor already has a different basket", () => {
    beforeEach(() => {
      cookieCartId = "cart_mine"
    })

    it("a failed return leaves their basket cookie alone and does not show them the other basket", async () => {
      const res = await GET(url({ ...good, redirect_status: "failed" }))
      expect(setCartId).not.toHaveBeenCalled()
      expect(res.headers.get("location")).toBe("/basket?error=payment_failed")
    })

    it("a successful return still completes the paid basket, without touching their cookie", async () => {
      placeOrder.mockResolvedValue({ id: "cart_1" })
      const res = await GET(url({ ...good, redirect_status: "succeeded" }))
      expect(placeOrder).toHaveBeenCalledWith("cart_1")
      expect(setCartId).not.toHaveBeenCalled()
      expect(res.headers.get("location")).toBe("/basket?error=order_failed")
    })

    it("an error while completing does not send them to a payment step for their own basket", async () => {
      placeOrder.mockRejectedValue(new Error("Payment authorization failed."))
      const res = await GET(url({ ...good, redirect_status: "succeeded" }))
      expect(setCartId).not.toHaveBeenCalled()
      expect(res.headers.get("location")).toBe("/basket?error=order_failed")
    })
  })

  it("a visitor without a basket cookie gets the returning basket back (cookie lost on the way)", async () => {
    cookieCartId = undefined
    const res = await GET(url({ ...good, redirect_status: "failed" }))
    expect(setCartId).toHaveBeenCalledWith("cart_1")
    expect(res.headers.get("location")).toBe("/checkout?step=payment&payment_error=declined")
  })
})
