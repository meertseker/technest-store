import { expect, test } from "@playwright/test"
import { expectNoAxeViolations, expectNoHorizontalScroll, expectTapTargets } from "./content-helpers"

const PAGES: [string, string][] = [
  ["/about", "About Tech Nest"],
  ["/contact", "Contact us"],
]

test.describe("about and contact", () => {
  for (const [path, h1] of PAGES) {
    test(`${path} renders, has one h1 and no axe violations`, async ({ page }) => {
      const res = await page.goto(path)
      expect(res?.status()).toBe(200)
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(h1)
      await expect(page.locator("h1")).toHaveCount(1)
      await expectNoAxeViolations(page)
      await expectTapTargets(page)
      await expectNoHorizontalScroll(page)
    })
  }

  test("contact page uses the real phone, address and map link and no email", async ({ page }) => {
    await page.goto("/contact")
    const main = page.locator("main")
    await expect(main.getByRole("link", { name: "Call 07775 669000" })).toHaveAttribute(
      "href",
      "tel:+447775669000"
    )
    await expect(main).toContainText("Unit 2A, Southwark Park Rd")
    await expect(main).toContainText("SE16 3TU")
    await expect(main).toContainText("Sunday")
    await expect(main.getByRole("link", { name: /directions on google maps/i })).toHaveAttribute(
      "href",
      /google\.com\/maps/
    )
    await expect(main.locator('a[href^="mailto:"]')).toHaveCount(0)
  })

  test("about page shows the real Google rating with a link to the reviews", async ({ page }) => {
    await page.goto("/about")
    await expect(page.locator("main")).toContainText("5.0 out of 5 on Google, from 30 reviews")
    await expect(page.getByRole("link", { name: /read our reviews on google/i })).toHaveAttribute(
      "href",
      /google\.com\/maps/
    )
  })
})
