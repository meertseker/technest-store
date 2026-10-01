import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
const acceptTransferRequest = vi.fn()
const declineTransferRequest = vi.fn()
vi.mock("@lib/data/orders", () => ({
  acceptTransferRequest: (...a: unknown[]) => acceptTransferRequest(...a),
  declineTransferRequest: (...a: unknown[]) => declineTransferRequest(...a),
}))

import TransferPage from "../(main)/order/[id]/transfer/[token]/page"
import AcceptPage from "../(main)/order/[id]/transfer/[token]/accept/page"
import DeclinePage from "../(main)/order/[id]/transfer/[token]/decline/page"

const params = Promise.resolve({ id: "order_01ABC", token: "tok" })

beforeEach(() => {
  acceptTransferRequest.mockReset()
  declineTransferRequest.mockReset()
})

describe("order transfer pages", () => {
  it("asks plainly, with both choices, and never shows the internal order id", async () => {
    const html = renderToStaticMarkup(await TransferPage({ params }))
    expect(html).toMatch(/<h1[^>]*>Move this order to another account\?<\/h1>/)
    expect(html).toContain("Yes, move the order")
    expect(html).toContain("No, keep it")
    expect(html).not.toContain("order_01ABC")
  })

  it("accept: says it is done", async () => {
    acceptTransferRequest.mockResolvedValue({ success: true, error: null })
    const html = renderToStaticMarkup(await AcceptPage({ params }))
    expect(acceptTransferRequest).toHaveBeenCalledWith("order_01ABC", "tok")
    expect(html).toMatch(/<h1[^>]*>The order has been moved<\/h1>/)
  })

  it("accept: a failure is an alert with a way forward, without the server's raw message", async () => {
    acceptTransferRequest.mockResolvedValue({ success: false, error: "Invalid token: jwt malformed" })
    const html = renderToStaticMarkup(await AcceptPage({ params }))
    expect(html).toContain('role="alert"')
    expect(html).toContain("This link is no longer valid")
    expect(html).not.toContain("jwt malformed")
    expect(html).toContain('href="/contact"')
  })

  it("decline: says the order stays where it is", async () => {
    declineTransferRequest.mockResolvedValue({ success: true, error: null })
    const html = renderToStaticMarkup(await DeclinePage({ params }))
    expect(html).toMatch(/<h1[^>]*>The order stays with you<\/h1>/)
  })
})
