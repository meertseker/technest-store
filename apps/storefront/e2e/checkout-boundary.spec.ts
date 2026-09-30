import { expect, test, type Page } from "@playwright/test"
import { KEY, seedCart } from "./cart-helpers"

/**
 * CSP only applies to a document the server sends, so every way into and out
 * of /checkout must be a full page load (agreed with E2, TEAM_CHAT 2026-09-30).
 */

const documentLoad = (page: Page, path: string) =>
  page.waitForResponse(
    (r) => r.request().resourceType() === "document" && new URL(r.url()).pathname === path,
    { timeout: 20_000 }
  )

test.describe("checkout boundary", () => {
  test.skip(!KEY, "needs NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY (load apps/storefront/.env.local)")

  test("basket -> checkout is a full load that carries the checkout CSP", async ({ page }) => {
    await seedCart(page)
    await page.goto("/basket")
    const doc = documentLoad(page, "/checkout")
    await page.getByTestId("checkout-button").click()
    const res = await doc
    expect(res.headers()["content-security-policy"]).toContain("js.stripe.com")
  })

  test("checkout -> basket is a full load (no strict CSP carried back)", async ({ page }) => {
    await seedCart(page)
    await page.goto("/checkout?step=contact")
    const doc = documentLoad(page, "/basket")
    await page.getByTestId("back-to-cart-link").click()
    const res = await doc
    expect(res.headers()["content-security-policy"]).toBeUndefined()
  })
})
