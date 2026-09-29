import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

const WCAG = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]

test.describe("site shell", () => {
  test("header has logo, search, device chip and basket", async ({ page }) => {
    await page.goto("/")
    const header = page.getByRole("banner")
    await expect(header.getByRole("link", { name: "Tech Nest home" })).toBeVisible()
    await expect(
      header.getByRole("link", { name: /choose your device/i }).first()
    ).toBeVisible()
    await expect(
      header.getByRole("button", { name: /search/i }).filter({ visible: true }).first()
    ).toBeVisible()
    await expect(
      header.getByRole("link", { name: /basket/i }).filter({ visible: true }).first()
    ).toBeVisible()
    const status = header.getByRole("status")
    await expect(status).toHaveCount(1)
    await expect(status).toHaveText(/\d+ items? in your basket/)
  })

  test("skip link is the first focusable element", async ({ page }) => {
    await page.goto("/")
    await page.keyboard.press("Tab")
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused()
  })

  test("header tap targets are at least 44px tall", async ({ page }) => {
    await page.goto("/")
    // wait for the streamed basket to replace its Suspense fallback
    await expect(page.getByRole("banner").getByRole("status")).toHaveCount(1)
    const boxes = await page
      .getByRole("banner")
      .locator("a:visible, button:visible")
      .evaluateAll((els) =>
        els.map((e) => ({
          h: e.getBoundingClientRect().height,
          t: (e.textContent || e.getAttribute("aria-label") || "").trim(),
        }))
      )
    expect(boxes.length).toBeGreaterThan(2)
    for (const b of boxes) expect(b.h, `height of "${b.t}"`).toBeGreaterThanOrEqual(44)
  })

  test("no horizontal scrolling", async ({ page }) => {
    await page.goto("/")
    const { scroll, client } = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }))
    expect(scroll).toBeLessThanOrEqual(client)
  })

  test("legacy country URL redirects to the unprefixed path", async ({ page }) => {
    const res = await page.goto("/gb")
    expect(new URL(page.url()).pathname).toBe("/")
    expect(res?.ok()).toBe(true)
  })

  test("header has no axe violations", async ({ page }) => {
    await page.goto("/")
    const results = await new AxeBuilder({ page }).withTags(WCAG).include("header").analyze()
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([])
  })
})
