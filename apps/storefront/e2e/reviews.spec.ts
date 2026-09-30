import { expect, test } from "@playwright/test"
import { expectNoAxeViolations } from "./helpers"

test.describe("home: Google reviews", () => {
  test("three reviews, attributed to Google, linking to Maps", async ({ page }) => {
    await page.goto("/")
    const section = page.getByRole("region", { name: /on Google · \d+ reviews/ })
    await expect(section).toBeVisible()
    await expect(section.getByText("Reviews from Google")).toBeVisible()
    await expect(section.locator("blockquote")).toHaveCount(3)
    await expect(section.getByRole("link", { name: /Read all reviews on Google/ })).toHaveAttribute(
      "href",
      /^https:\/\/www\.google\.com\/maps\//
    )
    await expectNoAxeViolations(page, "section[aria-labelledby='reviews-heading']")
  })
})
