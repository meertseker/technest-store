import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const retrieveOrder = vi.fn()
const retrieveCustomer = vi.fn()
let recentOrderId: string | undefined

vi.mock("server-only", () => ({}))
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND")
  },
}))
vi.mock("@lib/data/orders", () => ({ retrieveOrder: (...a: unknown[]) => retrieveOrder(...a) }))
vi.mock("@lib/data/customer", () => ({ retrieveCustomer: (...a: unknown[]) => retrieveCustomer(...a) }))
vi.mock("@lib/data/cookies", () => ({ getRecentOrderId: async () => recentOrderId }))

import OrderConfirmedPage from "../(main)/order/[id]/confirmed/page"

const order = {
  id: "order_1",
  display_id: 1042,
  email: "sam@example.com",
  customer_id: "cus_owner",
  created_at: "2026-10-10T10:00:00.000Z",
  currency_code: "gbp",
  items: [],
  total: 12.99,
  shipping_methods: [{ name: "Standard delivery" }],
  shipping_address: {
    first_name: "Sam",
    last_name: "Jones",
    address_1: "12 Example Street",
    city: "London",
    postal_code: "SE16 3TU",
    phone: "07700900982",
  },
}

const render = async () =>
  renderToStaticMarkup(await OrderConfirmedPage({ params: Promise.resolve({ id: "order_1" }) }))

beforeEach(() => {
  retrieveOrder.mockReset()
  retrieveCustomer.mockReset()
  retrieveOrder.mockResolvedValue(order)
  retrieveCustomer.mockResolvedValue(null)
  recentOrderId = undefined
})

describe("/order/[id]/confirmed", () => {
  it("shows the shopper who just ordered everything, including the account offer", async () => {
    recentOrderId = "order_1"
    const html = await render()
    expect(html).toContain('data-testid="order-number"')
    expect(html).toContain("#1042")
    expect(html).toContain("sam@example.com")
    expect(html).toContain("12 Example Street")
    expect(html).toContain('data-testid="create-account-offer"')
  })

  it("shows someone who only has the link the order number, and nothing personal", async () => {
    const html = await render()
    expect(html).toContain('data-testid="order-number"')
    expect(html).toContain("#1042")
    expect(html).toContain("emailed")
    expect(html).toContain('href="/account/login?next=%2Faccount%2Forders"')
    expect(html).not.toContain("sam@example.com")
    expect(html).not.toContain("12 Example Street")
    expect(html).not.toContain("Sam")
    expect(html).not.toContain("SE16 3TU")
    expect(html).not.toContain("create-account-offer")
    expect(html).not.toContain("<form")
  })

  it("the link for another order does not unlock this one", async () => {
    recentOrderId = "order_2"
    const html = await render()
    expect(html).not.toContain("sam@example.com")
    expect(html).not.toContain("12 Example Street")
  })

  it("the signed-in owner sees the full order from the emailed link, without the account offer", async () => {
    retrieveCustomer.mockResolvedValue({ id: "cus_owner" })
    const html = await render()
    expect(html).toContain("sam@example.com")
    expect(html).toContain("12 Example Street")
    expect(html).not.toContain("create-account-offer")
    expect(html).toContain('href="/account/orders/order_1"')
  })

  it("another signed-in customer gets the reduced view", async () => {
    retrieveCustomer.mockResolvedValue({ id: "cus_other" })
    const html = await render()
    expect(html).not.toContain("sam@example.com")
    expect(html).not.toContain("12 Example Street")
    expect(html).toContain("#1042")
  })

  it("an unknown order is a 404", async () => {
    retrieveOrder.mockRejectedValue(Object.assign(new Error("Not found"), { status: 404 }))
    await expect(render()).rejects.toThrow("NEXT_NOT_FOUND")
  })
})
