import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("@lib/data/basket-actions", () => ({ changeLineQuantity: vi.fn(), removeLine: vi.fn() }))

import type { DeliveryChoice } from "@lib/basket/shipping-options"
import AddonNotice from "./addon-notice"
import BasketSummary, { deliveryLine } from "./basket-summary"
import FreeDeliveryBar from "./free-delivery-bar"
import LineControls from "./line-controls"

const choice = (kind: DeliveryChoice["kind"], amount: number): DeliveryChoice => ({
  kind,
  id: `so_${kind}`,
  name: kind,
  description: null,
  amount,
  amount_pence: Math.round(amount * 100),
  available: true,
})
const choices = [choice("collect", 0), choice("standard", 3.49), choice("next-day", 5.99)]

describe("<FreeDeliveryBar>", () => {
  it("is an accessible progressbar with the pence maths", () => {
    const html = renderToStaticMarkup(createElement(FreeDeliveryBar, { subtotal_pence: 1650, threshold_pence: 2000 }))
    expect(html).toContain('role="progressbar"')
    expect(html).toContain('aria-valuenow="82"')
    expect(html).toContain('aria-valuemin="0"')
    expect(html).toContain('aria-valuemax="100"')
    expect(html).toContain('aria-valuetext="£16.50 of £20.00"')
    expect(html).toContain("£3.50")
    expect(html).toContain("away from free delivery")
    expect(html).toContain("width:82%")
  })

  it("says so once the threshold is reached", () => {
    const html = renderToStaticMarkup(createElement(FreeDeliveryBar, { subtotal_pence: 2500, threshold_pence: 2000 }))
    expect(html).toContain("Free standard delivery")
    expect(html).toContain('aria-valuenow="100"')
  })
})

describe("<AddonNotice>", () => {
  it("explains the rule in words (not colour alone)", () => {
    const html = renderToStaticMarkup(createElement(AddonNotice))
    expect(html).toContain("£1 items can&#x27;t be delivered on their own")
    expect(html).toContain("Click &amp; Collect")
    expect(html).toContain("bg-warning-subtle")
  })
})

describe("deliveryLine", () => {
  it("shows the cheapest delivery and free collection before checkout", () => {
    expect(deliveryLine({ choices, addon_only: false })).toBe("Delivery from £3.49 / Click & Collect free")
  })
  it("free standard delivery over the threshold", () => {
    expect(deliveryLine({ choices: [choice("collect", 0), choice("standard", 0)], addon_only: false })).toBe(
      "Free standard delivery / Click & Collect free"
    )
  })
  it("add-on only baskets are collection only", () => {
    expect(deliveryLine({ choices, addon_only: true })).toBe("Click & Collect free")
  })
  it("no options loaded", () => {
    expect(deliveryLine({ choices: [], addon_only: false })).toBe("Delivery options at checkout")
  })
})

describe("<BasketSummary>", () => {
  it("links to /checkout with a plain anchor (full load for the checkout CSP)", () => {
    const html = renderToStaticMarkup(
      createElement(BasketSummary, {
        cart: { item_total: 19.98 } as never,
        view: { choices, addon_only: false, threshold_pence: 2000, threshold_from_settings: false, addon_rule_source: "storefront" },
      })
    )
    expect(html).toMatch(/<a href="\/checkout"[^>]*data-testid="checkout-button"/)
    expect(html).toContain("Checkout securely")
    expect(html).toContain("£19.98")
  })
})

describe("<LineControls>", () => {
  it("renders labelled 44px stepper buttons and a named Remove", () => {
    const html = renderToStaticMarkup(
      createElement(LineControls, { lineId: "li_1", title: "USB-C cable", quantity: 1 })
    )
    expect(html).toContain('aria-label="Decrease quantity of USB-C cable"')
    expect(html).toContain('aria-label="Increase quantity of USB-C cable"')
    expect(html.match(/size-11/g)?.length).toBe(2)
    // can't go below 1 with the stepper; Remove does that
    expect(html).toMatch(/value="0" aria-label="Decrease quantity of USB-C cable" disabled=""/)
    expect(html).toMatch(/value="2" aria-label="Increase quantity of USB-C cable"/)
    expect(html).toMatch(/Remove<span class="sr-only"> (<!-- -->)?USB-C cable<\/span>/)
  })
})
