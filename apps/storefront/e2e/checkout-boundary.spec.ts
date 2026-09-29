import { expect, test, type Page } from "@playwright/test"

/**
 * CSP only applies to a document the server sends, so every way into and out
 * of /checkout must be a full page load (agreed with E2, TEAM_CHAT 2026-09-30).
 */

const BACKEND = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9003"
const KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""

async function seedCart(page: Page) {
  const h = { "x-publishable-api-key": KEY, "content-type": "application/json" }
  const api = page.request
  const { regions } = await (await api.get(`${BACKEND}/store/regions`, { headers: h })).json()
  const { products } = await (
    await api.get(`${BACKEND}/store/products?limit=1&fields=id,*variants`, { headers: h })
  ).json()
  const { cart } = await (
    await api.post(`${BACKEND}/store/carts`, { headers: h, data: { region_id: regions[0].id } })
  ).json()
  await api.post(`${BACKEND}/store/carts/${cart.id}/line-items`, {
    headers: h,
    data: { variant_id: products[0].variants[0].id, quantity: 1 },
  })
  await page.context().addCookies([
    { name: "_medusa_cart_id", value: cart.id, url: "http://localhost:8003" },
  ])
}

const documentLoad = (page: Page, path: string) =>
  page.waitForResponse(
    (r) => r.request().resourceType() === "document" && new URL(r.url()).pathname === path,
    { timeout: 20_000 }
  )

test.describe("checkout boundary", () => {
  test.skip(!KEY, "needs NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY (load apps/storefront/.env.local)")

  test("cart -> checkout is a full load that carries the checkout CSP", async ({ page }) => {
    await seedCart(page)
    await page.goto("/cart")
    const doc = documentLoad(page, "/checkout")
    await page.getByTestId("checkout-button").click()
    const res = await doc
    expect(res.headers()["content-security-policy"]).toContain("js.stripe.com")
  })

  test("checkout -> basket is a full load (no strict CSP carried back)", async ({ page }) => {
    await seedCart(page)
    await page.goto("/checkout?step=address")
    const doc = documentLoad(page, "/cart")
    await page.getByTestId("back-to-cart-link").click()
    const res = await doc
    expect(res.headers()["content-security-policy"]).toBeUndefined()
  })
})
