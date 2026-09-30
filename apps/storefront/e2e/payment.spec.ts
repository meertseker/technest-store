import { expect, test, type Page } from "@playwright/test"
import { BACKEND, KEY, seedCart, storeHeaders as h } from "./cart-helpers"
import { expectNoAxeViolations } from "./helpers"

/**
 * Payment step (owner: E2). Two paths:
 *
 * 1. Manual/test provider (dev/CI): runs when NEXT_PUBLIC_STRIPE_KEY is empty and
 *    the backend offers `pp_system_default`. Places a Click & Collect and a
 *    delivery order end to end, checks the error summary, axe at 375/1280.
 * 2. Stripe test mode: skipped unless E2E_STRIPE=1, a pk_test_ key and a backend
 *    with `pp_stripe_stripe`. How to run it: e2e/README-payment.md.
 *
 * Screenshots: $E2E_SCREENS_DIR/payment-{state}-{375|1280}.png
 */

const SCREENS = process.env.E2E_SCREENS_DIR || "test-results/screens"
const STRIPE_KEY = process.env.NEXT_PUBLIC_STRIPE_KEY || ""

async function shot(page: Page, state: string, fullPage = true) {
  const width = page.viewportSize()!.width
  if (fullPage) await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: `${SCREENS}/payment-${state}-${width}.png`, fullPage })
}

type Variant = { id: string; manage_inventory?: boolean; allow_backorder?: boolean; inventory_quantity?: number }
type Product = { id: string; handle: string; metadata: Record<string, unknown> | null; variants: Variant[] }

/** A non-add-on variant with stock to spare (the dev backend is shared and these tests place real orders) */
async function regularVariant(page: Page, skip = 0): Promise<string> {
  const res = await page.request.get(
    `${BACKEND}/store/products?limit=100&fields=id,handle,metadata,*variants,+variants.inventory_quantity,+variants.manage_inventory,+variants.allow_backorder`,
    { headers: h }
  )
  const products: Product[] = (await res.json()).products
  const inStock = (v: Variant) => v.manage_inventory === false || v.allow_backorder || (v.inventory_quantity ?? 0) > 5
  const ok = products
    .filter((p) => p.metadata?.is_addon_item !== true)
    .flatMap((p) => p.variants.filter(inStock))
    .sort((a, b) => (b.inventory_quantity ?? 1e9) - (a.inventory_quantity ?? 1e9))
  expect(ok.length, "no in-stock product in the backend").toBeGreaterThan(0)
  return ok[skip % ok.length].id
}

async function providers(page: Page): Promise<string[]> {
  const { regions } = await (await page.request.get(`${BACKEND}/store/regions`, { headers: h })).json()
  const { payment_providers } = await (
    await page.request.get(`${BACKEND}/store/payment-providers?region_id=${regions[0].id}`, { headers: h })
  ).json()
  return payment_providers.map((p: { id: string }) => p.id)
}

async function contact(page: Page, tag: string) {
  await page.goto("/checkout")
  await page.getByLabel("Email address").fill(`pay-${tag}-${Date.now()}@example.com`)
  await page.getByTestId("contact-continue").click()
  await page.waitForURL(/step=delivery/)
}

async function collect(page: Page) {
  await page.getByTestId("delivery-option-collect").click()
  await page.getByLabel("First name").fill("Sam")
  await page.getByLabel("Last name").fill("Collector")
  await page.getByTestId("delivery-continue").click()
  await page.waitForURL(/step=payment/)
}

async function deliver(page: Page) {
  const form = page.getByTestId("delivery-form")
  await form.getByTestId("delivery-option-standard").click()
  await form.getByLabel("First name").fill("Sam")
  await form.getByLabel("Last name").fill("Tester")
  await form.getByLabel("Address line 1").fill("1 Test Road")
  await form.getByLabel("Town or city").fill("London")
  await form.getByLabel("Postcode").fill("SE16 3TU")
  await page.getByTestId("delivery-continue").click()
  await page.waitForURL(/step=payment/)
}

test.describe("payment step: manual/test provider", () => {
  test.skip(!KEY, "needs NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY (load apps/storefront/.env.local)")
  test.skip(!!STRIPE_KEY, "NEXT_PUBLIC_STRIPE_KEY is set: the Stripe spec covers this storefront")
  test.setTimeout(240_000)

  test.beforeEach(async ({ page }) => {
    test.skip(!(await providers(page)).includes("pp_system_default"), "backend has no manual provider")
  })

  test("Click & Collect order end to end", async ({ page }) => {
    await seedCart(page, [await regularVariant(page)])
    await contact(page, "collect")
    await collect(page)

    const step = page.getByTestId("checkout-section-payment")
    await expect(step.getByRole("heading", { name: "Payment" })).toBeVisible()
    await expect(step.getByTestId("payment-dev-notice")).toContainText("Development only")
    await expect(step.getByTestId("collect-payment-note")).toContainText("only take it when you collect")
    const place = step.getByTestId("place-order")
    await expect(place).toHaveText(/Place order and pay £\d+\.\d{2}/)
    const box = (await place.boundingBox())!
    expect(box.height).toBeGreaterThanOrEqual(44)
    // the Stripe Payment Element is not mounted in this mode
    await expect(step.locator("iframe")).toHaveCount(0)
    await expectNoAxeViolations(page)
    await shot(page, "manual-collect")

    // an off-site failure (3DS/Klarna) comes back through /api/payment-return
    await page.goto("/checkout?step=payment&payment_error=declined")
    const summary = page.getByTestId("error-summary")
    await expect(summary).toBeFocused()
    await expect(summary).toContainText("There is a problem")
    await expect(summary).toContainText("You haven't been charged")
    await expect(summary.getByRole("link")).toHaveAttribute("href", "#payment-element")
    await expectNoAxeViolations(page)
    await shot(page, "error")

    await page.getByTestId("place-order").click()
    await expect(page.getByTestId("payment-status")).toHaveText("Placing your order…")
    await page.waitForURL(/\/order\/.+\/confirmed/, { timeout: 60_000 })
    await expect(page.getByRole("heading", { level: 1, name: "Thanks, your order is placed" })).toBeVisible()
    await expect(page.getByTestId("collect-details")).toContainText("SE16 3TU")
    await expect(page.getByTestId("basket-status")).toHaveText("0 items in your basket")
    await shot(page, "confirmed-collect")
  })

  test("delivery order end to end; the session follows the delivery choice", async ({ page }) => {
    await seedCart(page, [await regularVariant(page, 1)])
    await contact(page, "delivery")
    await collect(page)
    const collectLabel = await page.getByTestId("place-order").textContent()

    // change to delivery: the total (and so the payment session) follows the new choice
    await page.getByTestId("edit-delivery").click()
    await page.waitForURL(/step=delivery/)
    await deliver(page)
    await expect(page.getByTestId("summary-delivery")).toContainText("Standard delivery")
    const place = page.getByTestId("place-order")
    await expect(place).not.toHaveText(collectLabel ?? "")
    await expect(page.getByTestId("collect-payment-note")).toHaveCount(0)
    await expectNoAxeViolations(page)
    await shot(page, "manual-delivery")

    await place.click()
    await page.waitForURL(/\/order\/.+\/confirmed/, { timeout: 60_000 })
    await expect(page.getByRole("heading", { level: 1, name: "Thanks, your order is placed" })).toBeVisible()
    await expect(page.getByTestId("order-number")).toHaveText(/^#\d+$/)
    await shot(page, "confirmed-delivery")
  })

  test("basket shows the Klarna hint from the settings minimum", async ({ page }) => {
    const settings = await (await page.request.get(`${BACKEND}/store/technest-settings`, { headers: h })).json()
    const min: number = settings.settings.klarna_min_basket_pence
    const cartId = await seedCart(page, [await regularVariant(page)])
    const { cart } = await (await page.request.get(`${BACKEND}/store/carts/${cartId}?fields=total`, { headers: h })).json()
    const totalPence = Math.round(cart.total * 100)

    await page.goto("/basket")
    const hint = page.getByTestId("klarna-basket-hint")
    const pounds = min % 100 === 0 ? `£${min / 100}` : `£${(min / 100).toFixed(2)}`
    await expect(hint).toHaveText(
      totalPence >= min ? "Pay in 3 with Klarna available at checkout" : `Klarna is available on orders over ${pounds}`
    )
    await expectNoAxeViolations(page)
    await shot(page, "basket-hint")
  })
})

/**
 * Stripe test mode, against a backend with STRIPE_API_KEY=sk_test_... and
 * `stripe listen --forward-to localhost:9001/hooks/payment/stripe_stripe`.
 * See e2e/README-payment.md. Test cards: https://docs.stripe.com/testing
 */
test.describe("payment step: Stripe test mode", () => {
  test.skip(
    process.env.E2E_STRIPE !== "1" || !STRIPE_KEY.startsWith("pk_test_"),
    "set E2E_STRIPE=1 and NEXT_PUBLIC_STRIPE_KEY=pk_test_... (see e2e/README-payment.md)"
  )
  test.setTimeout(300_000)

  test.beforeEach(async ({ page }) => {
    test.skip(!(await providers(page)).includes("pp_stripe_stripe"), "backend has no Stripe provider")
  })

  const cardFrame = (page: Page) => page.frameLocator('iframe[title="Secure payment input frame"]').first()

  async function fillCard(page: Page, number: string) {
    const frame = cardFrame(page)
    const cardRadio = frame.getByRole("radio", { name: /Card/ })
    if (await cardRadio.count()) await cardRadio.first().check()
    await frame.locator('[name="number"]').fill(number)
    await frame.locator('[name="expiry"]').fill("12 / 34")
    await frame.locator('[name="cvc"]').fill("123")
    const postcode = frame.locator('[name="postalCode"]')
    if (await postcode.count()) await postcode.fill("SE16 3TU")
  }

  async function toPayment(page: Page, tag: string, delivery: boolean) {
    await seedCart(page, [await regularVariant(page)])
    await contact(page, tag)
    if (delivery) await deliver(page)
    else await collect(page)
    await expect(page.getByTestId("stripe-payment-element").locator("iframe").first()).toBeVisible({ timeout: 30_000 })
  }

  test("card 4242: authorised, order placed, Klarna gated by the session flag", async ({ page }) => {
    await toPayment(page, "stripe-ok", true)
    // the flag comes from the session; this basket may be either side of the minimum
    await expect(page.getByTestId("klarna-available").or(page.getByTestId("klarna-below-minimum"))).toBeVisible()
    await expectNoAxeViolations(page, '[data-testid="payment-step"]')
    await shot(page, "stripe")
    await fillCard(page, "4242424242424242")
    await page.getByTestId("place-order").click()
    await expect(page.getByTestId("payment-status")).toHaveText(/Payment authorised, placing your order|Confirming/)
    await page.waitForURL(/\/order\/.+\/confirmed/, { timeout: 90_000 })
  })

  test("declined card: error summary, no order", async ({ page }) => {
    await toPayment(page, "stripe-decline", false)
    await fillCard(page, "4000000000000002")
    await page.getByTestId("place-order").click()
    const summary = page.getByTestId("error-summary")
    await expect(summary).toBeFocused({ timeout: 30_000 })
    await expect(summary).toContainText(/declined/i)
    await expect(page).toHaveURL(/\/checkout/)
    await shot(page, "declined")
  })

  test("3DS card: challenge completed in Stripe's frame, order placed", async ({ page }) => {
    await toPayment(page, "stripe-3ds", true)
    await fillCard(page, "4000002500003155")
    await page.getByTestId("place-order").click()
    // Stripe's test challenge: nested frames inside the 3DS modal
    const challenge = page
      .frameLocator('iframe[name^="__privateStripeFrame"][src*="three-ds"], iframe[src*="authorize"]')
      .first()
      .frameLocator("#challengeFrame")
      .frameLocator('iframe[name="acsFrame"]')
    await challenge.getByRole("button", { name: /Complete/ }).click({ timeout: 60_000 })
    await page.waitForURL(/\/order\/.+\/confirmed/, { timeout: 90_000 })
  })
})
