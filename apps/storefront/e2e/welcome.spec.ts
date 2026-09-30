import { expect, test } from "@playwright/test"
import { expectNoAxeViolations, expectNoHorizontalScroll, expectTapTargets } from "./content-helpers"

test.describe("/welcome till poster", () => {
  test("renders a QR code for the shop, is noindex and has no axe violations", async ({ page }) => {
    const res = await page.goto("/welcome")
    expect(res?.status()).toBe(200)
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Shop online, collect here")
    await expect(page.getByRole("img", { name: /QR code linking to/ })).toBeVisible()
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/)
    await expectNoAxeViolations(page)
    await expectTapTargets(page)
    await expectNoHorizontalScroll(page)
  })

  test("print view hides the screen-only controls", async ({ page }) => {
    await page.goto("/welcome")
    await page.emulateMedia({ media: "print" })
    await expect(page.getByRole("button", { name: "Print poster" })).toBeHidden()
    await expect(page.getByRole("img", { name: /QR code linking to/ })).toBeVisible()
  })
})
