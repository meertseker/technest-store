import AxeBuilder from "@axe-core/playwright"
import { expect, type Page } from "@playwright/test"

export const WCAG = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]

export async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze()
  expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([])
}

/** Every visible link and button in main is at least 44px tall */
export async function expectTapTargets(page: Page) {
  const small = await page
    .locator("main")
    .locator("a:visible, button:visible")
    .evaluateAll((els) =>
      els
        .filter((e) => {
          // links inside running text are exempt (WCAG 2.5.8 inline exception)
          const inline = e.tagName === "A" && e.closest("p, li:not(nav li), td, address") && !e.className.includes("min-h")
          return !inline && e.getBoundingClientRect().height < 44
        })
        .map((e) => (e.textContent || "").trim())
    )
  expect(small).toEqual([])
}

/** No horizontal scrolling at the current viewport */
export async function expectNoHorizontalScroll(page: Page) {
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }))
  expect(scroll).toBeLessThanOrEqual(client)
}
