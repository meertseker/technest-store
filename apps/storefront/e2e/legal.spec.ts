import { expect, test } from "@playwright/test"
import { KEY, seedCart } from "./cart-helpers"
import { expectNoAxeViolations, expectNoHorizontalScroll, expectTapTargets } from "./content-helpers"

const LEGAL = [
  ["terms", "Terms and conditions"],
  ["delivery", "Delivery and Click & Collect"],
  ["returns", "Returns and cancellations"],
  ["privacy", "Privacy notice"],
  ["cookies", "Cookie policy"],
  ["accessibility", "Accessibility statement"],
  ["weee", "Recycling old electricals (WEEE)"],
  ["repair-terms", "Repair terms"],
] as const

const PAGES: [string, string][] = [
  ...LEGAL.map(([slug, h1]) => [`/legal/${slug}`, h1] as [string, string]),
]

test.describe("legal pages", () => {
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

  test("unknown legal slug is a 404", async ({ page }) => {
    const res = await page.goto("/legal/not-a-page")
    expect(res?.status()).toBe(404)
  })

  test("legal drafts are marked and noindex", async ({ page }) => {
    await page.goto("/legal/terms")
    await expect(page.getByRole("note")).toContainText("Draft for review")
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/)
    await expect(page.getByText("[legal business name: to be confirmed]").first()).toBeVisible()
  })

  test("returns page has the model cancellation form", async ({ page }) => {
    await page.goto("/legal/returns")
    await expect(page.getByRole("heading", { name: "Model cancellation form" }).first()).toBeVisible()
    await expect(page.getByText(/hereby give notice that I\/We \[\*\] cancel/)).toBeVisible()
  })
})


test.describe("cookie banner", () => {
  test("Reject is as easy as Accept, and the choice is stored in a cookie", async ({ page, context }) => {
    await context.clearCookies()
    await page.goto("/legal/terms")
    const banner = page.getByRole("region", { name: "Cookies on Tech Nest" })
    await expect(banner).toBeVisible()

    const reject = banner.getByRole("button", { name: "Reject" })
    const accept = banner.getByRole("button", { name: "Accept" })
    const [r, a] = [await reject.boundingBox(), await accept.boundingBox()]
    expect(r!.height).toBeGreaterThanOrEqual(44)
    expect(Math.abs(r!.height - a!.height)).toBeLessThan(1)
    expect(Math.abs(r!.width - a!.width)).toBeLessThan(1)
    expect(await reject.getAttribute("class")).toBe(await accept.getAttribute("class"))

    await reject.click()
    await expect(banner).toBeHidden()
    const consent = (await context.cookies()).find((c) => c.name === "tn_consent")
    expect(consent?.value).toBe("rejected")

    await page.reload()
    await expect(page.getByRole("region", { name: "Cookies on Tech Nest" })).toHaveCount(0)
  })

  test("the choice can be changed on the cookie policy page", async ({ page, context }) => {
    await context.clearCookies()
    await page.goto("/legal/cookies")
    await page.locator("main").getByRole("button", { name: "Accept" }).click()
    await expect(page.locator("main")).toContainText("You accepted analytics cookies.")
    expect((await context.cookies()).find((c) => c.name === "tn_consent")?.value).toBe("accepted")
  })

  test("no third-party scripts load before a choice", async ({ page, context }) => {
    await context.clearCookies()
    const external: string[] = []
    page.on("request", (req) => {
      const url = new URL(req.url())
      if (req.resourceType() === "script" && url.hostname !== "localhost") external.push(req.url())
    })
    await page.goto("/legal/terms")
    await page.waitForLoadState("networkidle")
    expect(external).toEqual([])
  })

  test("the banner is not shown on checkout", async ({ page, context }) => {
    test.skip(!KEY, "needs NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY: an empty basket redirects /checkout to /basket")
    await context.clearCookies()
    await seedCart(page)
    await page.goto("/checkout")
    await expect(page).toHaveURL(/\/checkout/)
    await expect(page.getByRole("region", { name: "Cookies on Tech Nest" })).toHaveCount(0)
  })
})

