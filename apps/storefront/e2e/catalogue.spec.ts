import { mkdirSync } from "node:fs"
import { expect, test, type Page, type TestInfo } from "@playwright/test"
import { expectNoAxeViolations, expectNoHorizontalScroll, expectTapTargets } from "./content-helpers"

/**
 * Catalogue pages (docs/specs/design.md 7.2, 7.3, device and search pages)
 * against a seeded backend: categories "phone-accessories" > "cases", the
 * device "iphone-16" and products such as "silicone-case-magsafe".
 * SCREENS_DIR (optional) saves full-page screenshots for review.
 */

const SCREENS = process.env.SCREENS_DIR
const width = (info: TestInfo) => (info.project.name.startsWith("mobile") ? 375 : 1280)
const isMobile = (info: TestInfo) => width(info) === 375

async function screenshot(page: Page, info: TestInfo, name: string) {
  if (!SCREENS) return
  mkdirSync(SCREENS, { recursive: true })
  await page.screenshot({ path: `${SCREENS}/catalogue-${name}-${width(info)}.png`, fullPage: true })
}

async function chooseDevice(page: Page, baseURL: string | undefined, slug = "iphone-16") {
  await page.context().addCookies([{ name: "tn_device", value: slug, url: baseURL! }])
}

async function quality(page: Page) {
  await expect(page.locator("h1")).toHaveCount(1)
  await expectNoAxeViolations(page)
  await expectTapTargets(page)
  await expectNoHorizontalScroll(page)
}

test.describe("category listing /c/[...slug]", () => {
  test("renders breadcrumbs, H1 + count, filters and sort; passes axe", async ({ page }, info) => {
    const res = await page.goto("/c/phone-accessories/cases")
    expect(res?.status()).toBe(200)
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cases")
    await expect(page.locator("main")).toContainText(/\d+ items?/)
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toBeVisible()
    await expect(page.getByLabel("Sort by")).toBeVisible()
    await quality(page)
    await screenshot(page, info, "category")
  })

  test("a filter goes into the URL, shows a chip, and Clear all removes it", async ({ page }, info) => {
    await page.goto("/c/phone-accessories/cases")
    if (isMobile(info)) {
      await page.getByRole("button", { name: /^Filters/ }).click()
      const sheet = page.getByRole("dialog", { name: "Filters" })
      await sheet.getByRole("checkbox", { name: /Black/ }).check()
      await expect(sheet.getByRole("button", { name: /^Show \d+ results?$/ })).toBeVisible()
      await screenshot(page, info, "category-filters")
      await sheet.getByRole("button", { name: /^Show \d+ results?$/ }).click()
    } else {
      await page.getByRole("complementary", { name: "Filters" }).getByRole("checkbox", { name: /Black/ }).check()
    }
    await expect(page).toHaveURL(/colour=black/)
    const chip = page.getByRole("link", { name: /Colour: Black/ })
    await expect(chip).toBeVisible()
    await page.getByRole("link", { name: "Clear all", exact: true }).click()
    await expect(page).not.toHaveURL(/colour=/)
  })

  test("sort changes the URL and keeps working after reload", async ({ page }) => {
    await page.goto("/c/phone-accessories/cases")
    await page.getByLabel("Sort by").selectOption("price-asc")
    await expect(page).toHaveURL(/sort=price-asc/)
    await page.reload()
    await expect(page.getByLabel("Sort by")).toHaveValue("price-asc")
  })

  test("with a device chosen, shows only items that fit and offers Show all", async ({ page, baseURL }) => {
    await chooseDevice(page, baseURL)
    await page.goto("/c/phone-accessories")
    await expect(page.locator("main")).toContainText("Showing items that fit your iPhone 16")
    const fitting = await page.locator("main ul li h3").count()
    await page.getByRole("link", { name: "Show all" }).click()
    await expect(page).toHaveURL(/fit=all/)
    await expect.poll(() => page.locator("main ul li h3").count()).toBeGreaterThan(fitting)
    await expectNoAxeViolations(page)
  })

  test("unknown categories are 404", async ({ page }) => {
    const res = await page.goto("/c/no-such-category")
    expect(res?.status()).toBe(404)
  })
})

test.describe("product page /p/[handle]", () => {
  test("shows price inc. VAT, fit box, stock, variants, delivery and JSON-LD; passes axe", async ({ page, baseURL }, info) => {
    await chooseDevice(page, baseURL)
    const res = await page.goto("/p/silicone-case-magsafe")
    expect(res?.status()).toBe(200)
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Silicone Case with MagSafe")
    const main = page.locator("main")
    await expect(main).toContainText(/£\d+\.\d{2}\s*inc\. VAT/)
    await expect(main).toContainText("Fits your iPhone 16")
    await expect(main).toContainText(/In stock|Low stock/)
    await expect(main).toContainText("Click & Collect: free")
    await expect(main).toContainText(/free on orders of £\d+/)
    await expect(page.getByRole("group", { name: /Colour/ })).toBeVisible()

    const ld = await page.locator('script[type="application/ld+json"]').allTextContents()
    const types = ld.map((t) => JSON.parse(t)["@type"])
    expect(types).toEqual(expect.arrayContaining(["Product", "BreadcrumbList"]))
    const product = JSON.parse(ld.find((t) => t.includes('"Product"'))!)
    expect(product.offers.priceCurrency).toBe("GBP")
    expect(ld.join("")).not.toContain("AggregateRating")

    await quality(page)
    await screenshot(page, info, "product")
  })

  test("variant buttons are at least 44px and Add to basket stays on the page", async ({ page }) => {
    await page.goto("/p/usb-c-to-lightning-cable")
    const buttons = page.getByRole("group", { name: /Length/ }).getByRole("button")
    for (const box of await buttons.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))) {
      expect(box).toBeGreaterThanOrEqual(44)
    }
    // Colour has one value (White), so only Length is a choice
    await expect(page.getByRole("group", { name: /Colour/ })).toHaveCount(0)
    await buttons.first().click()
    await page.getByRole("button", { name: "Add to basket" }).first().click()
    await expect(page.getByRole("status").filter({ hasText: "to your basket" })).toBeVisible()
    await expect(page).toHaveURL(/\/p\/usb-c-to-lightning-cable/)
  })

  test("sticky add bar appears on mobile once the main button scrolls away", async ({ page }, info) => {
    test.skip(!isMobile(info), "mobile only")
    await page.goto("/p/usb-c-to-lightning-cable")
    const bar = page.getByTestId("sticky-add-bar")
    await expect(bar).toHaveAttribute("aria-hidden", "true")
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await expect(bar).not.toHaveAttribute("aria-hidden", "true")
  })

  test("old starter URLs redirect with 308", async ({ request }) => {
    for (const [from, to] of [
      ["/products/silicone-case-magsafe", "/p/silicone-case-magsafe"],
      ["/categories/cases", "/c/cases"],
      ["/store", "/search"],
    ]) {
      const res = await request.get(from, { maxRedirects: 0 })
      expect(res.status()).toBe(308)
      expect(new URL(res.headers()["location"], "http://x").pathname).toBe(to)
    }
  })
})

test.describe("device page /devices/[brand]/[model]", () => {
  test("lists products that fit, grouped by category; passes axe", async ({ page }, info) => {
    const res = await page.goto("/devices/apple/iphone-16")
    expect(res?.status()).toBe(200)
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Accessories for iPhone 16")
    await expect(page.getByRole("heading", { level: 2, name: "Cases" })).toBeVisible()
    await quality(page)
    await screenshot(page, info, "device")
  })

  test("a wrong brand segment redirects to the canonical URL", async ({ request }) => {
    const res = await request.get("/devices/samsung/iphone-16", { maxRedirects: 0 })
    expect(res.status()).toBe(308)
    expect(res.headers()["location"]).toContain("/devices/apple/iphone-16")
  })
})

test.describe("search", () => {
  test("/search?q= shows results with the query and passes axe", async ({ page }, info) => {
    await page.goto("/search?q=case")
    await expect(page.getByRole("heading", { level: 1 })).toContainText("case")
    await expect(page.locator("main ul li h3").first()).toBeVisible()
    await quality(page)
    await screenshot(page, info, "search")
  })

  test("no results offers a way on", async ({ page }) => {
    await page.goto("/search?q=zzzzqqq")
    await expect(page.locator("main")).toContainText("No results for")
  })

  test("header autocomplete suggests products and opens one with the keyboard", async ({ page }, info) => {
    await page.goto("/")
    if (isMobile(info)) {
      await page.getByRole("button", { name: "Search products" }).click()
      await expect(page.getByRole("heading", { name: "Search" })).toBeVisible()
    }
    const box = page.getByRole("combobox", { name: "Search products" }).filter({ visible: true })
    await box.fill("cable")
    const option = page.getByRole("option").filter({ hasText: /cable/i }).first()
    await expect(option).toBeVisible()
    await expect(page.getByRole("option", { name: /See all results/ })).toBeVisible()
    await expectNoAxeViolations(page)
    await screenshot(page, info, "search-autocomplete")
    await box.press("ArrowDown")
    await expect(box).toHaveAttribute("aria-activedescendant", /opt-\d+$/)
    await box.press("Enter")
    await expect(page).toHaveURL(/\/p\//)
  })
})
