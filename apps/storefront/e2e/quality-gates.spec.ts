import AxeBuilder from "@axe-core/playwright"
import { expect, test, type APIRequestContext, type Page } from "@playwright/test"
import { BACKEND, BASE, KEY, storeHeaders as h } from "./cart-helpers"
import { WCAG } from "./helpers"

/**
 * Quality gates (docs/specs/design.md 8) on every page, at 375 and 1280 (the two
 * Playwright projects): 0 axe violations (WCAG 2.2 AA), primary controls >= 44px,
 * body text >= 16px, no horizontal scroll. Runs against the local backend in
 * .env.local; best against a production build:
 *   pnpm run build && PORT=8018 pnpm start
 *   E2E_PORT=8018 pnpm exec playwright test e2e/quality-gates.spec.ts
 */

type Issue = string

/** Captions, badges and legal footnotes (spec 3 "Small", 14px) carry data-small-text */
const SMALL_TEXT_OK = "[data-small-text], sup, sub"

async function axeIssues(page: Page): Promise<Issue[]> {
  // the Next.js dev-mode indicator only exists under `next dev`
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" })
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze()
  return violations.flatMap((v) =>
    v.nodes.map((n) => `axe ${v.id}: ${n.target.join(" ")} | ${n.html.slice(0, 100)}`)
  )
}

/**
 * Primary controls (buttons, form fields and links that are not inside running
 * text) in the header, main and any open dialog are at least 44px tall; icon
 * buttons also 44px wide. Links in sentences are exempt (WCAG 2.5.8 inline).
 */
async function tapTargetIssues(page: Page): Promise<Issue[]> {
  return page.evaluate(() => {
    const scopes = Array.from(document.querySelectorAll("header, main, [role=dialog]"))
    const els = new Set<Element>()
    for (const s of scopes) {
      s.querySelectorAll(
        "a[href], button, select, textarea, input:not([type=hidden]):not([type=checkbox]):not([type=radio])"
      ).forEach((e) => els.add(e))
    }
    const out: string[] = []
    els.forEach((el) => {
      const r = el.getBoundingClientRect()
      const style = getComputedStyle(el)
      if (!r.width || !r.height || style.visibility === "hidden") return
      if (el.closest("[aria-hidden=true], .sr-only")) return
      // skip links become visible only on focus
      if (el.classList.contains("sr-only")) return
      const inline =
        el.tagName === "A" &&
        !!el.closest("p, li:not(nav li):not([role=listitem] nav li), td, address, dd, label") &&
        style.display === "inline"
      if (inline) return
      const text = (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 40)
      if (r.height < 44 - 0.5) out.push(`tap ${el.tagName.toLowerCase()} "${text}" ${Math.round(r.width)}x${Math.round(r.height)}`)
      else if (r.width < 44 - 0.5 && el.tagName !== "A")
        out.push(`tap ${el.tagName.toLowerCase()} "${text}" ${Math.round(r.width)}x${Math.round(r.height)}`)
    })
    return out
  })
}

/** Visible text in the header, main and dialogs is >= 16px; marked small print >= 14px */
async function smallTextIssues(page: Page): Promise<Issue[]> {
  return page.evaluate((okSel) => {
    const out = new Map<string, string>()
    for (const scope of Array.from(document.querySelectorAll("header, main, [role=dialog]"))) {
      const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT)
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const text = (n.textContent || "").trim()
        const el = n.parentElement
        if (!text || !el) continue
        if (el.closest(".sr-only, [aria-hidden=true], script, style, noscript")) continue
        const r = el.getBoundingClientRect()
        if (!r.width || !r.height || getComputedStyle(el).visibility === "hidden") continue
        const size = parseFloat(getComputedStyle(el).fontSize)
        // marked small print may be 14px (spec 3 "Small"), never less
        if (size < (el.closest(okSel) ? 14 : 16)) out.set(`${el.tagName}:${text.slice(0, 30)}`, `text ${size}px <${el.tagName.toLowerCase()}> "${text.slice(0, 40)}"`)
      }
    }
    return Array.from(out.values())
  }, SMALL_TEXT_OK)
}

async function scrollIssues(page: Page): Promise<Issue[]> {
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }))
  return scroll > client ? [`horizontal scroll: ${scroll}px > ${client}px`] : []
}

/** All four gates on the current page; one readable list of everything that fails */
async function expectQualityGates(page: Page, label: string) {
  await page.waitForLoadState("load")
  const issues = [
    ...(await axeIssues(page)),
    ...(await tapTargetIssues(page)),
    ...(await smallTextIssues(page)),
    ...(await scrollIssues(page)),
  ]
  expect(issues, `${label} at ${page.viewportSize()?.width}px`).toEqual([])
}

async function visit(page: Page, path: string, status = 200) {
  const res = await page.goto(path)
  expect(res?.status(), path).toBe(status)
}

// ---------------------------------------------------------------- backend helpers

type Product = {
  id: string
  handle: string
  metadata: Record<string, unknown> | null
  variants: { id: string }[]
}

async function products(request: APIRequestContext): Promise<Product[]> {
  const res = await request.get(`${BACKEND}/store/products?limit=100&fields=id,handle,metadata,*variants`, { headers: h })
  return (await res.json()).products
}

/** A cart holding one in-stock, non add-on item (shared dev databases run low on stock) */
async function cartWithItem(request: APIRequestContext): Promise<string> {
  const { regions } = await (await request.get(`${BACKEND}/store/regions`, { headers: h })).json()
  const { cart } = await (
    await request.post(`${BACKEND}/store/carts`, { headers: h, data: { region_id: regions[0].id } })
  ).json()
  for (const p of await products(request)) {
    if (p.metadata?.is_addon_item === true) continue
    for (const v of p.variants) {
      const res = await request.post(`${BACKEND}/store/carts/${cart.id}/line-items`, {
        headers: h,
        data: { variant_id: v.id, quantity: 1 },
      })
      if (res.ok()) return cart.id
    }
  }
  throw new Error("no variant in stock")
}

async function useCart(page: Page, cartId: string) {
  await page.context().addCookies([{ name: "_medusa_cart_id", value: cartId, url: BASE }])
}

/** A guest Click & Collect order placed through the store API with the manual provider */
async function placeOrder(request: APIRequestContext): Promise<string | null> {
  const cartId = await cartWithItem(request)
  const address = {
    first_name: "Sam",
    last_name: "Gates",
    address_1: "Unit 2A, Southwark Park Rd.",
    city: "London",
    postal_code: "SE16 3TU",
    country_code: "gb",
    phone: "07700900123",
  }
  await request.post(`${BACKEND}/store/carts/${cartId}`, {
    headers: h,
    data: { email: `gates-${Date.now()}@example.com`, shipping_address: address, billing_address: address },
  })
  const { shipping_options } = await (
    await request.get(`${BACKEND}/store/shipping-options?cart_id=${cartId}`, { headers: h })
  ).json()
  const option = shipping_options.find((o: { name: string }) => /collect/i.test(o.name)) ?? shipping_options[0]
  if (!option) return null
  await request.post(`${BACKEND}/store/carts/${cartId}/shipping-methods`, {
    headers: h,
    data: { option_id: option.id },
  })
  const { payment_collection } = await (
    await request.post(`${BACKEND}/store/payment-collections`, { headers: h, data: { cart_id: cartId } })
  ).json()
  const session = await request.post(
    `${BACKEND}/store/payment-collections/${payment_collection.id}/payment-sessions`,
    { headers: h, data: { provider_id: "pp_system_default" } }
  )
  if (!session.ok()) return null
  const done = await (await request.post(`${BACKEND}/store/carts/${cartId}/complete`, { headers: h })).json()
  return done.type === "order" ? done.order.id : null
}

// ---------------------------------------------------------------- pages

const LEGAL = ["terms", "delivery", "returns", "privacy", "cookies", "accessibility", "weee", "repair-terms"]

const STATIC_PAGES: [string, string][] = [
  ["home", "/"],
  ["category", "/c/phone-accessories"],
  ["subcategory", "/c/phone-accessories/cases"],
  ["devices", "/devices"],
  ["device help", "/devices/help"],
  ["device page", "/devices/apple/iphone-16"],
  ["search", "/search?q=case"],
  ["search, no results", "/search?q=zzzzqqq"],
  ["empty basket", "/basket"],
  ["trade", "/trade"],
  ["trade apply (signed out)", "/trade/apply"],
  ["repairs", "/repairs"],
  ["repair booking", "/repairs/book"],
  ["about", "/about"],
  ["contact", "/contact"],
  ["sign in", "/account/login"],
  ["register", "/account/register"],
  ["forgot password", "/account/forgot-password"],
  ["reset password", "/account/reset-password?token=not-a-real-token&email=someone%40example.com"],
  ...LEGAL.map((s): [string, string] => [`legal ${s}`, `/legal/${s}`]),
]

test.describe("quality gates (spec 8)", () => {
  test.skip(!KEY, "needs NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY (load apps/storefront/.env.local)")

  for (const [label, path] of STATIC_PAGES) {
    test(`${label} (${path})`, async ({ page }) => {
      // Turnstile's script is third-party; the form around it is what we test
      await page.route("https://challenges.cloudflare.com/**", (r) => r.fulfill({ body: "" }))
      await visit(page, path)
      await expectQualityGates(page, label)
    })
  }

  test("404 page", async ({ page }) => {
    await visit(page, "/no-such-page-anywhere", 404)
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    await expectQualityGates(page, "404")
  })

  test("product page", async ({ page, request }) => {
    const p = (await products(request)).find((x) => x.metadata?.is_addon_item !== true)!
    await visit(page, `/p/${p.handle}`)
    await expectQualityGates(page, "product")
  })

  test("header menu open (375) and basket drawer open", async ({ page, request }) => {
    await useCart(page, await cartWithItem(request))
    await visit(page, "/")
    await page.waitForLoadState("networkidle") // hydrated: the basket link opens the drawer, not /basket
    if (page.viewportSize()!.width < 1024) {
      await page.getByTestId("nav-menu-button").click()
      await expect(page.getByTestId("nav-menu-popup")).toBeVisible()
      await page.waitForTimeout(300) // transition
      await expectQualityGates(page, "menu open")
      await page.getByRole("button", { name: "Close menu" }).click()
    }
    await page.getByRole("banner").getByRole("link", { name: /basket/i }).first().click()
    const drawer = page.getByRole("dialog", { name: /Your basket/ })
    await expect(drawer).toBeVisible()
    await page.waitForTimeout(400) // slide-in
    await expectQualityGates(page, "basket drawer")
  })

  test("basket with items", async ({ page, request }) => {
    await useCart(page, await cartWithItem(request))
    await visit(page, "/basket")
    await expect(page.getByTestId("basket-status")).toHaveText("1 item in your basket")
    await expectQualityGates(page, "basket")
  })

  test("checkout contact and delivery sections", async ({ page, request }) => {
    await useCart(page, await cartWithItem(request))
    await visit(page, "/checkout")
    await expect(page.getByLabel("Email address")).toBeVisible()
    await expectQualityGates(page, "checkout contact")

    // empty submit: error summary state
    await page.getByTestId("contact-continue").click()
    await expect(page.getByTestId("error-summary")).toBeVisible()
    await expectQualityGates(page, "checkout contact errors")

    await page.getByLabel("Email address").fill(`gates-${Date.now()}@example.com`)
    await page.getByTestId("contact-continue").click()
    await page.waitForURL(/step=delivery/)
    await expect(page.getByTestId("delivery-form")).toBeVisible()
    await expectQualityGates(page, "checkout delivery")
  })

  test("order confirmation", async ({ page, request }) => {
    const orderId = await placeOrder(request)
    test.skip(!orderId, "needs the manual payment provider (dev backend)")
    await visit(page, `/order/${orderId}/confirmed`)
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    await expectQualityGates(page, "order confirmed")
  })

  test("signed-in account pages", async ({ page }) => {
    test.setTimeout(180_000)
    const email = `gates-${page.viewportSize()!.width}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@example.com`
    await visit(page, "/account/register")
    await page.getByLabel("First name").fill("Sam")
    await page.getByLabel("Last name").fill("Gates")
    await page.getByLabel("Email address").fill(email)
    await page.getByLabel("Create a password").fill("correct horse battery")
    await page.getByRole("button", { name: "Create account" }).click()
    await page.waitForURL((u) => !u.pathname.startsWith("/account/register"))

    for (const [label, path] of [
      ["account overview", "/account"],
      ["orders", "/account/orders"],
      ["addresses", "/account/addresses"],
      ["new address", "/account/addresses/new"],
      ["profile", "/account/profile"],
      ["trade account", "/account/trade"],
      ["trade apply (signed in)", "/trade/apply"],
    ]) {
      await visit(page, path)
      await expectQualityGates(page, label)
    }
  })
})
