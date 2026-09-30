import { expect, test } from "@playwright/test"
import { deviceChip, expectNoAxeViolations } from "./helpers"

// Same port as playwright.config.ts
const BASE = `http://localhost:${Number(process.env.E2E_PORT) || 8003}`

test.describe("device picker", () => {
  test("search, choose, and the header shows the device", async ({ page, context }) => {
    await context.clearCookies()
    await page.goto("/devices")
    await expect(page.getByRole("heading", { level: 1, name: "Choose your device" })).toBeVisible()
    await expectNoAxeViolations(page)

    await page.getByLabel("Search for your phone or console").fill("s24 ultra")
    await expect(page.getByRole("status").filter({ hasText: /found/ })).toHaveText(/1 device found/)
    await page.getByRole("button", { name: /Galaxy S24 Ultra/ }).first().click()

    await expect(page).toHaveURL(/\/$/)
    await expect(deviceChip(page)).toHaveText(/Shopping for: Galaxy S24 Ultra/)
    const cookies = await context.cookies()
    const c = cookies.find((x) => x.name === "tn_device")
    expect(c?.value).toBe("galaxy-s24-ultra")
    expect(c?.httpOnly).toBe(true)
  })

  test("works without JavaScript: search results are server-rendered", async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false })
    const page = await ctx.newPage()
    await page.goto("/devices?q=15+pro")
    await expect(page.getByRole("heading", { name: /devices? match/ })).toBeVisible()
    await page.getByRole("button", { name: /^Apple iPhone 15 Pro$/ }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(deviceChip(page)).toHaveText(/iPhone 15 Pro/)
    await ctx.close()
  })

  test("browse brand -> series -> model, then return to where I was", async ({ page, context }) => {
    await context.clearCookies()
    await page.goto("/cart")
    await deviceChip(page).click()
    await expect(page).toHaveURL(/\/devices\?returnTo=%2Fcart/)
    await page.getByRole("link", { name: "Apple", exact: true }).click()
    await page.getByRole("link", { name: "iPhone 15", exact: true }).click()
    await expectNoAxeViolations(page)
    await page.getByRole("button", { name: "iPhone 15 Pro", exact: true }).click()
    await expect(page).toHaveURL(/\/cart$/)
    await expect(deviceChip(page)).toHaveText(/iPhone 15 Pro/)
  })

  test("the chosen device is marked and can be cleared", async ({ page, context }) => {
    await context.addCookies([{ name: "tn_device", value: "iphone-15-pro", url: BASE }])
    await page.goto("/devices?brand=apple&series=iPhone+15")
    await expect(page.getByRole("button", { name: /iPhone 15 Pro\s*Selected/ })).toHaveAttribute("aria-current", "true")
    await page.getByRole("button", { name: "Show all devices instead" }).click()
    await expect(deviceChip(page)).toHaveText(/Choose your device/)
  })

  test("returnTo cannot send the shopper off-site", async ({ page, context }) => {
    await context.clearCookies()
    await page.goto("/devices?q=ps5&returnTo=//evil.example")
    await page.getByRole("button", { name: /PlayStation 5/ }).first().click()
    await expect(page).toHaveURL(`${BASE}/`)
  })

  test("a submitted search shows one results list, replaced (not duplicated) when typing", async ({ page, context }) => {
    await context.clearCookies()
    await page.goto("/devices?q=15+pro")
    const lists = page.getByTestId("device-results")
    await expect(lists).toHaveCount(1)
    await expect(lists).toContainText("match “15 pro”")
    await page.getByLabel("Search for your phone or console").fill("s24 ultra")
    await expect(page.getByRole("status").filter({ hasText: /found/ })).toHaveText(/1 device found/)
    await expect(lists).toHaveCount(1)
    await expect(lists).toContainText("1 device matches “s24 ultra”")
    await expect(page.getByRole("button", { name: /iPhone 15 Pro/ })).toHaveCount(0)
  })

  test("the chip keeps the query string and returns to the exact page", async ({ page, context }) => {
    await context.clearCookies()
    // (not /store: its search UI rewrites its own query string after hydration)
    await page.goto("/cart?ref=e2e&x=1")
    await expect(deviceChip(page)).toHaveAttribute("href", "/devices?returnTo=%2Fcart%3Fref%3De2e%26x%3D1")
    await deviceChip(page).click()
    await page.getByLabel("Search for your phone or console").fill("ps5")
    await page.getByRole("button", { name: /PlayStation 5/ }).first().click()
    await expect(page).toHaveURL(`${BASE}/cart?ref=e2e&x=1`)
  })

  test("returnTo is the exact page, never a trailing-slash /devices/", async ({ page, context }) => {
    await context.clearCookies()
    await page.goto("/devices/help")
    await expect(deviceChip(page)).toHaveAttribute("href", "/devices?returnTo=%2Fdevices%2Fhelp")
    await deviceChip(page).click()
    await page.getByLabel("Search for your phone or console").fill("ps5")
    await page.getByRole("button", { name: /PlayStation 5/ }).first().click()
    await expect(page).toHaveURL(`${BASE}/devices/help`)

    // the picker itself (with or without a trailing slash) is never a destination
    await page.goto("/devices?q=ps5&returnTo=%2Fdevices%2F")
    await page.getByRole("button", { name: /PlayStation 5/ }).first().click()
    await expect(page).toHaveURL(`${BASE}/`)
  })

  test("help page has no axe violations", async ({ page }) => {
    await page.goto("/devices/help")
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("How do I find my model?")
    await expectNoAxeViolations(page)
  })
})
