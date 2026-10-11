import { existsSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@lib/data/orders", () => ({
  acceptTransferRequest: vi.fn(),
  declineTransferRequest: vi.fn(),
}))

import TransferPage from "../(main)/order/[id]/transfer/[token]/page"

const params = Promise.resolve({ id: "order_01ABC", token: "tok" })
const TRANSFER_DIR = join(__dirname, "..", "(main)", "order", "[id]", "transfer", "[token]")

describe("order transfer page", () => {
  it("asks plainly, with both choices, and never shows the internal order id", async () => {
    const html = renderToStaticMarkup(await TransferPage({ params }))
    expect(html).toMatch(/<h1[^>]*>Move this order to another account\?<\/h1>/)
    expect(html).toContain("Yes, move the order")
    expect(html).toContain("No, keep it")
    expect(html).not.toContain("order_01ABC")
  })

  it("nothing moves an order on a plain GET: the choices are buttons, there are no accept/decline pages", () => {
    // A link scanner, a mail client's preview or a prefetch must not be able to
    // accept or decline a transfer just by opening a URL.
    expect(existsSync(join(TRANSFER_DIR, "accept"))).toBe(false)
    expect(existsSync(join(TRANSFER_DIR, "decline"))).toBe(false)
    expect(readdirSync(TRANSFER_DIR).sort()).toEqual(["page.tsx"])
  })
})
