import AxeBuilder from "@axe-core/playwright"
import { expect, type Page } from "@playwright/test"

export const WCAG = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]

/** Zero axe violations (WCAG 2.2 AA tags) on the current page */
export async function expectNoAxeViolations(page: Page, include?: string) {
  let builder = new AxeBuilder({ page }).withTags(WCAG)
  if (include) builder = builder.include(include)
  const { violations } = await builder.analyze()
  expect(
    violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)
  ).toEqual([])
}

/** The header chip, whichever copy (mobile row or desktop) is visible */
export const deviceChip = (page: Page) =>
  page.getByRole("banner").getByRole("link", { name: /shopping for|choose your device/i }).filter({ visible: true }).first()
