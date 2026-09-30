import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const fetchCart = vi.fn()
const placeOrder = vi.fn()
const setCartId = vi.fn()

vi.mock("@lib/config", () => ({ sdk: { client: { fetch: (...a: unknown[]) => fetchCart(...a) } } }))
vi.mock("@lib/data/cart", () => ({ placeOrder: (...a: unknown[]) => placeOrder(...a) }))
vi.mock("@lib/data/cookies", () => ({ getAuthHeaders: async () => ({}), setCartId: (...a: unknown[]) => setCartId(...a) }))

import { GET } from "./route"

const url = (q: Record<string, string>) =>
  new NextRequest(`http://localhost:8017/api/payment-return?${new URLSearchParams(q)}`)

const good = { cart_id: "cart_1", payment_intent: "pi_1", payment_intent_client_secret: "pi_1_secret_x" }

beforeEach(() => {
  fetchCart.mockReset()
  placeOrder.mockReset()
  setCartId.mockReset()
  fetchCart.mockResolvedValue({
    cart: { payment_collection: { payment_sessions: [{ data: { id: "pi_1", client_secret: "pi_1_secret_x" } }] } },
  })
})

describe("GET /api/payment-return (Stripe redirect back)", () => {
  it("rejects a request that doesn't match the cart's own session", async () => {
    const res = await GET(url({ ...good, payment_intent_client_secret: "other" }))
    expect(res.headers.get("location")).toBe("http://localhost:8017/checkout?step=payment&payment_error=payment_failed")
    expect(placeOrder).not.toHaveBeenCalled()
    expect((await GET(url({ cart_id: "cart_1" }))).headers.get("location")).toContain("payment_error=payment_failed")
  })

  it("a failed off-site step goes back to the payment step without the client secret", async () => {
    const res = await GET(url({ ...good, redirect_status: "failed" }))
    const loc = res.headers.get("location")!
    expect(loc).toBe("http://localhost:8017/checkout?step=payment&payment_error=declined")
    expect(loc).not.toContain("secret")
    expect(placeOrder).not.toHaveBeenCalled()
  })

  it("completes the cart server-side on success", async () => {
    placeOrder.mockResolvedValue({ id: "cart_1" }) // returned = not converted
    const res = await GET(url({ ...good, redirect_status: "succeeded" }))
    expect(placeOrder).toHaveBeenCalledWith("cart_1")
    expect(setCartId).toHaveBeenCalledWith("cart_1")
    expect(res.headers.get("location")).toContain("payment_error=order_failed")
  })

  it("an error while completing goes back with order_failed", async () => {
    placeOrder.mockRejectedValue(new Error("Payment authorization failed."))
    const res = await GET(url({ ...good, redirect_status: "succeeded" }))
    expect(res.headers.get("location")).toContain("payment_error=order_failed")
  })
})
