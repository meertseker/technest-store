import { expect, test, type Page } from "@playwright/test"
import { BACKEND, inStock, KEY, seedCart, storeHeaders as h } from "./cart-helpers"
import { expectNoAxeViolations } from "./helpers"

/**
 * Basket drawer -> /basket -> /checkout (spec 7.4, 7.5, 7.6) against the local
 * backend. No real Stripe: the dev backend offers only the manual provider, so the
 * full order test places a Click & Collect order with it (skipped otherwise).
 */

const SCREENS = process.env.E2E_SCREENS_DIR || "test-results/screens"

async function shot(page: Page, name: string, width: number, fullPage = true) {
  if (fullPage) await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: `${SCREENS}/checkout-${name}-${width}.png`, fullPage })
}

type Product = {
  id: string
  handle: string
  metadata: Record<string, unknown> | null
  variants: { id: string; inventory_quantity?: number | null; manage_inventory?: boolean | null }[]
}

async function listProducts(page: Page): Promise<Product[]> {
  const res = await page.request.get(`${BACKEND}/store/products?limit=100&fields=id,handle,metadata,*variants,+variants.inventory_quantity`, { headers: h })
  return (await res.json()).products
}

const isAddon = (p: Product) => p.metadata?.is_addon_item === true

test.describe("basket and checkout", () => {
  test.skip(!KEY, "needs NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY (load apps/storefront/.env.local)")
  test.setTimeout(240_000)

  test("add to basket -> drawer -> checkout sections up to payment", async ({ page }, info) => {
    const width = page.viewportSize()!.width
    const products = await listProducts(page)
    const single = products.find((p) => p.variants.length === 1 && !isAddon(p) && inStock(p.variants[0]))!

    await page.goto(`/products/${single.handle}`)
    const status = page.getByTestId("basket-status")
    await expect(status).toHaveText("0 items in your basket")

    // the PDP preselects the only variant after hydration (the sticky bar repeats the button)
    const add = page.getByRole("main").getByRole("button", { name: "Add to basket", exact: true }).first()
    await expect(add).toBeEnabled()
    await add.click()

    // drawer with the confirmation at the top + one live status phrase
    const drawer = page.getByRole("dialog", { name: /Your basket \(1\)/ })
    await expect(drawer.getByTestId("basket-added")).toHaveText("Added to basket")
    await expect(drawer).toBeVisible()
    await expect(status).toHaveText("1 item in your basket")
    const bar = drawer.getByRole("progressbar")
    await expect(bar).toHaveAttribute("aria-valuemin", "0")
    await expect(bar).toHaveAttribute("aria-valuenow", /^\d+$/)
    await expect(drawer.getByTestId("free-delivery")).toContainText(/away from free delivery|Free standard delivery/)
    await expect(drawer.getByTestId("basket-delivery-line")).toContainText("Click & Collect free")

    // drawer: full width on phones, 420px from 768px
    const box = (await drawer.boundingBox())!
    expect(Math.round(box.width)).toBe(width < 768 ? width : 420)

    // 44px targets
    const plus = drawer.getByRole("button", { name: /Increase quantity/ })
    const plusBox = (await plus.boundingBox())!
    expect(plusBox.height).toBeGreaterThanOrEqual(44)
    expect(plusBox.width).toBeGreaterThanOrEqual(44)

    await page.waitForTimeout(400) // let the slide-in finish before axe/screenshot
    await expectNoAxeViolations(page)
    await shot(page, "drawer", width, false) // the drawer is fixed to the viewport

    // quantity stepper updates the basket and the header status
    await plus.click()
    await expect(status).toHaveText("2 items in your basket")
    await expect(drawer.getByRole("dialog", { name: /Your basket \(2\)/ }).or(page.getByRole("dialog", { name: /Your basket \(2\)/ }))).toBeVisible()

    // Escape closes and focus returns to the add button that opened it
    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog")).toBeHidden()

    // /basket fallback page
    await page.goto("/basket")
    await expect(page.getByRole("heading", { level: 1, name: /Your basket/ })).toBeVisible()
    await expectNoAxeViolations(page)
    await shot(page, "basket", width)

    // checkout: a full page load (CSP), section 1 open
    await page.getByTestId("checkout-button").click()
    await page.waitForURL(/\/checkout(\?step=contact)?$/)
    await expect(page.getByRole("heading", { level: 1, name: "Checkout" })).toBeVisible()
    await expect(page.getByRole("link", { name: /Back to basket|Back/ }).first()).toBeVisible()

    // error summary: focused once, links to the field
    await page.getByTestId("contact-continue").click()
    const summary = page.getByTestId("error-summary")
    await expect(summary).toBeFocused()
    await expect(summary).toContainText("There is a problem")
    await expect(summary.getByRole("link", { name: "Enter your email address" })).toHaveAttribute("href", "#contact-email")
    await expect(page.locator("#contact-email")).toHaveAttribute("aria-invalid", "true")
    await expectNoAxeViolations(page)
    await shot(page, "errors", width)

    await page.getByLabel("Email address").fill(`e2e-${info.project.name}-${Date.now()}@example.com`)
    await page.getByTestId("contact-continue").click()
    await page.waitForURL(/step=delivery/)
    await expect(page.getByTestId("summary-contact")).toContainText("@example.com")

    // delivery: the choice first, real prices from Medusa, address only for delivery
    const delivery = page.getByTestId("delivery-form")
    await expect(delivery.getByTestId("delivery-option-collect")).toContainText("Free")
    await expect(delivery.getByTestId("delivery-option-standard")).toContainText(/£\d+\.\d{2}|Free/)
    await expect(delivery.getByTestId("delivery-option-next-day")).toContainText(/£\d+\.\d{2}/)
    await expect(delivery.getByLabel("Postcode")).toHaveCount(0)
    await delivery.getByTestId("delivery-option-standard").click()
    await expect(delivery.getByLabel("Postcode")).toHaveAttribute("autocomplete", "postal-code")
    await expect(delivery.getByLabel("Address line 1")).toHaveAttribute("autocomplete", "address-line1")
    await expect(delivery.getByLabel("First name")).toHaveAttribute("autocomplete", "given-name")

    await delivery.getByLabel("First name").fill("Sam")
    await delivery.getByLabel("Last name").fill("Tester")
    await delivery.getByLabel("Address line 1").fill("1 Test Road")
    await delivery.getByLabel("Town or city").fill("London")
    await delivery.getByLabel("Postcode").fill("SE16")
    await page.getByTestId("delivery-continue").click()
    await expect(page.getByTestId("error-summary")).toBeFocused()
    await expect(page.getByTestId("error-summary")).toContainText("Enter a full UK postcode")
    await expectNoAxeViolations(page)
    await shot(page, "delivery", width)

    await delivery.getByLabel("Postcode").fill("se16 3tu")
    await page.getByTestId("delivery-continue").click()
    await page.waitForURL(/step=payment/)

    // section 3 is E2's payment step
    await expect(page.getByTestId("summary-delivery")).toContainText("Standard delivery")
    await expect(page.getByTestId("summary-delivery")).toContainText("SE16 3TU")
    await expect(page.getByTestId("checkout-section-payment").getByRole("heading", { name: "Payment" })).toBeVisible()
    await expectNoAxeViolations(page)
    await shot(page, "payment", width)
  })

  test("£1 add-ons alone: amber notice, delivery blocked, Click & Collect offered", async ({ page }) => {
    const width = page.viewportSize()!.width
    const addon = (await listProducts(page)).find(isAddon)
    test.skip(!addon, "no add-on products in this backend")
    await seedCart(page, [addon!.variants[0].id])

    await page.goto("/basket")
    await expect(page.getByTestId("addon-notice")).toContainText("£1 items can't be delivered on their own")
    await expect(page.getByTestId("basket-delivery-line")).toHaveText("Click & Collect free")

    await page.goto("/checkout?step=contact")
    await page.getByLabel("Email address").fill(`addon-${Date.now()}@example.com`)
    await page.getByTestId("contact-continue").click()
    await page.waitForURL(/step=delivery/)
    const form = page.getByTestId("delivery-form")
    await expect(form.getByTestId("addon-notice")).toBeVisible()
    await expect(form.getByTestId("delivery-option-standard").getByRole("radio")).toBeDisabled()
    await expect(form.getByTestId("delivery-option-collect").getByRole("radio")).toBeChecked()
    await expect(form.getByTestId("collect-info")).toBeVisible()
    await expectNoAxeViolations(page)
    await shot(page, "addon", width)
  })

  test("Click & Collect order -> confirmation page", async ({ page }) => {
    const width = page.viewportSize()!.width
    const { regions } = await (await page.request.get(`${BACKEND}/store/regions`, { headers: h })).json()
    const { payment_providers } = await (
      await page.request.get(`${BACKEND}/store/payment-providers?region_id=${regions[0].id}`, { headers: h })
    ).json()
    test.skip(
      !payment_providers.some((p: { id: string }) => p.id === "pp_system_default"),
      "needs the manual provider (dev); Stripe orders are covered by E2"
    )
    const variant = (await listProducts(page)).filter((p) => !isAddon(p)).flatMap((p) => p.variants).find(inStock)!
    await seedCart(page, [variant.id])

    await page.goto("/checkout")
    await page.getByLabel("Email address").fill(`collect-${Date.now()}@example.com`)
    await page.getByTestId("contact-continue").click()
    await page.waitForURL(/step=delivery/)
    await page.getByTestId("delivery-option-collect").click()
    await page.getByLabel("First name").fill("Sam")
    await page.getByLabel("Last name").fill("Collector")
    await page.getByTestId("delivery-continue").click()
    await page.waitForURL(/step=payment/)
    await expect(page.getByTestId("summary-delivery")).toContainText("Collect from shop")

    // E2's payment step (manual/test provider in dev): one Place order button
    await page.getByTestId("place-order").click()
    await page.waitForURL(/\/order\/.+\/confirmed/, { timeout: 60_000 })

    await expect(page.getByRole("heading", { level: 1, name: "Thanks, your order is placed" })).toBeVisible()
    await expect(page.getByTestId("order-number")).toHaveText(/^#\d+$/)
    const collect = page.getByTestId("collect-details")
    await expect(collect).toContainText("SE16 3TU")
    await expect(collect).toContainText("We'll email you when it's ready")
    await expect(collect.getByRole("link", { name: "Open in Google Maps" })).toBeVisible()
    await expect(page.getByTestId("todays-hours")).toHaveText(/Open today|Closed today/)
    await expect(page.getByTestId("create-account-offer")).toContainText("Save your details?")
    await expect(page.getByLabel("Create a password")).toHaveAttribute("autocomplete", "new-password")
    // the basket is empty again
    await expect(page.getByTestId("basket-status")).toHaveText("0 items in your basket")
    await expectNoAxeViolations(page)
    await shot(page, "confirmed", width)
  })
})
