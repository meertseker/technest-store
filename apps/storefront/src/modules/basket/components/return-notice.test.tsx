import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { PAYMENT_PROCESSING } from "@modules/checkout/payment/helpers"
import ReturnNotice from "./return-notice"

// The basket page shows the outcome of a payment return for a basket that is not the visitor's own.
describe("basket page notice after a payment return", () => {
  it("a payment the bank is still processing is a status, not an error, and says not to pay again", () => {
    const html = renderToStaticMarkup(<ReturnNotice code="processing" />)
    expect(html).toContain(PAYMENT_PROCESSING.replace(/'/g, "&#x27;"))
    expect(html).toContain('role="status"')
    expect(html).not.toContain('role="alert"')
    expect(html).not.toContain("destructive")
  })

  it("a failed payment or order stays an alert", () => {
    for (const code of ["payment_failed", "order_failed"]) {
      const html = renderToStaticMarkup(<ReturnNotice code={code} />)
      expect(html, code).toContain('role="alert"')
      expect(html, code).toContain("haven&#x27;t been charged")
    }
  })

  it("shows nothing for an unknown or missing code", () => {
    expect(renderToStaticMarkup(<ReturnNotice code="<script>" />)).toBe("")
    expect(renderToStaticMarkup(<ReturnNotice code={undefined} />)).toBe("")
  })
})
