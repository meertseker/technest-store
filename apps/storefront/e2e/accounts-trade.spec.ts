import { expect, test, type Page, type TestInfo } from "@playwright/test"
import { expectNoHorizontalScroll, expectTapTargets } from "./content-helpers"
import AxeBuilder from "@axe-core/playwright"
import { WCAG } from "./helpers"

/*
 * Accounts, trade and repairs (E3, branch e3/accounts-trade). Runs against the
 * local backend in .env.local. Each project registers its own customer.
 * Screenshots go to SCREENS_DIR (default ../../../screens, i.e. /home/user/wt/screens
 * from a worktree) as accounts-{page}-{375|1280}.png.
 */

const SCREENS_DIR = process.env.SCREENS_DIR ?? "../../../screens"

const size = (info: TestInfo) => (info.project.name.includes("375") ? "375" : "1280")

async function shot(page: Page, info: TestInfo, name: string) {
  await page.screenshot({ path: `${SCREENS_DIR}/accounts-${name}-${size(info)}.png`, fullPage: true })
}

/**
 * axe without the Next.js dev-mode indicator (a fixed button that only exists
 * in `next dev` and can overlap footer links on short pages)
 */
async function expectNoAxeViolations(page: Page) {
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" })
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze()
  expect(
    violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.html.slice(0, 120)} | ${n.failureSummary?.slice(0, 200)}`))
  ).toEqual([])
}

async function checkPage(page: Page) {
  await expect(page.locator("h1")).toHaveCount(1)
  await expectNoAxeViolations(page)
  await expectTapTargets(page)
  await expectNoHorizontalScroll(page)
}

/** Stands in for Cloudflare's script: the dev test key always passes anyway */
async function stubTurnstile(page: Page) {
  await page.route("https://challenges.cloudflare.com/**", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `window.turnstile = {
        render(el, opts) {
          const i = document.createElement("input");
          i.type = "hidden"; i.name = opts["response-field-name"] || "cf-turnstile-response";
          i.value = "XXXX.DUMMY.TOKEN.XXXX"; el.appendChild(i);
          const f = document.createElement("div"); f.textContent = "Success!"; f.style.height = "65px"; el.appendChild(f);
          setTimeout(() => opts.callback && opts.callback(i.value), 0);
          return "stub-widget";
        },
        reset() {}, remove() {}
      };`,
    })
  )
}

const uniqueEmail = (info: TestInfo) =>
  `e3-acct-${size(info)}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@example.com`

async function register(page: Page, email: string, next?: string) {
  await page.goto(next ? `/account/register?next=${encodeURIComponent(next)}` : "/account/register")
  await page.getByLabel("First name").fill("Sam")
  await page.getByLabel("Last name").fill("Tester")
  await page.getByLabel("Email address").fill(email)
  await page.getByLabel("Create a password").fill("correct horse battery")
  await page.getByRole("button", { name: "Create account" }).click()
}

test.describe("trade and repairs pages", () => {
  test("/trade explains ex VAT pricing and links to the application", async ({ page }, info) => {
    const res = await page.goto("/trade")
    expect(res?.status()).toBe(200)
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Trade accounts")
    await expect(page.getByRole("heading", { name: "How trade prices work" })).toBeVisible()
    await expect(page.getByText("£6.25 ex VAT")).toBeVisible()
    await expect(page.getByRole("link", { name: "Apply for a trade account" })).toHaveAttribute("href", "/trade/apply")
    await checkPage(page)
    await shot(page, info, "trade")
  })

  test("/trade/apply asks a signed-out visitor to sign in first", async ({ page }, info) => {
    await page.goto("/trade/apply")
    await expect(page.getByRole("link", { name: "Sign in to apply" })).toHaveAttribute(
      "href",
      "/account/login?next=/trade/apply"
    )
    await checkPage(page)
    await shot(page, info, "trade-apply-signed-out")
  })

  test("/repairs shows what we repair, same day, no prices, and no Turnstile", async ({ page }, info) => {
    const scripts: string[] = []
    page.on("request", (r) => r.resourceType() === "script" && scripts.push(r.url()))
    const res = await page.goto("/repairs")
    expect(res?.status()).toBe(200)
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Phone, tablet and console repairs")
    await expect(page.getByText("Most repairs same day").first()).toBeVisible()
    await expect(page.getByRole("heading", { name: "What we repair" })).toBeVisible()
    await expect(page.locator("main")).not.toContainText("£")
    await checkPage(page)
    expect(scripts.filter((s) => !s.startsWith("http://localhost"))).toEqual([])
    await shot(page, info, "repairs")
  })

  test("repair booking: error summary, device picker, Turnstile, success", async ({ page }, info) => {
    await stubTurnstile(page)
    // A unique client IP per project, forwarded to the backend's rate limiter
    await page.setExtraHTTPHeaders({ "cf-connecting-ip": `198.51.100.${1 + Math.floor(Math.random() * 254)}` })
    await page.goto("/repairs/book")
    // The fixed cookie banner would cover the footer once the form is replaced by the short success panel
    await page.getByRole("region", { name: "Cookies on Tech Nest" }).getByRole("button", { name: "Reject" }).click()
    await expect(page.getByTestId("turnstile")).toHaveAttribute("data-state", "done")

    // Empty submit: focusable summary with links to each field
    await page.getByRole("button", { name: "Send repair request" }).click()
    const summary = page.getByTestId("error-summary")
    await expect(summary).toBeFocused()
    await expect(summary.getByRole("heading", { name: "There is a problem" })).toBeVisible()
    await expect(summary.getByRole("link", { name: "Enter your device, like iPhone 13 mini" })).toBeVisible()
    await expect(summary.getByRole("link", { name: /Confirm we can use your details/ })).toBeVisible()
    await summary.getByRole("link", { name: "Enter your name" }).click()
    await expect(page.getByLabel("Name", { exact: true })).toBeFocused()
    await expect(page.getByLabel("Phone number")).toHaveAttribute("aria-invalid", "true")
    await expectNoAxeViolations(page)
    await shot(page, info, "repairs-book-errors")

    // Device picker: type, pick with the keyboard
    const device = page.getByRole("combobox", { name: "Your device" })
    await device.fill("iphone 15 pro")
    await expect(page.getByRole("listbox", { name: "Matching devices" })).toBeVisible()
    await device.press("ArrowDown")
    await device.press("Enter")
    await expect(device).toHaveValue(/iPhone 15 Pro/)
    await expect(page.getByText(/chosen from our device list/)).toBeVisible()

    await page.getByLabel("What is wrong with it?").fill("Cracked screen, touch still works")
    await page.getByRole("radio", { name: "Morning (before 12pm)" }).check()
    await page.getByLabel("Name", { exact: true }).fill("Sam Tester")
    await page.getByLabel("Phone number").fill("07700 900123")
    await page.getByLabel("Email address").fill("sam.tester@example.com")
    await page.getByLabel("Tech Nest can use these details to contact me about this repair").check()
    await shot(page, info, "repairs-book")
    await page.getByRole("button", { name: "Send repair request" }).click()

    const success = page.getByTestId("repair-success")
    // A backend with a real Turnstile secret must reach Cloudflare's siteverify;
    // sandboxes without egress fail closed (docs/contracts/repairs.md)
    await expect(success.or(page.getByTestId("error-summary"))).toBeVisible()
    if (await page.getByTestId("error-summary").getByText("The security check did not work").isVisible()) {
      await expect(page.getByTestId("error-summary")).toBeFocused()
      await shot(page, info, "repairs-book-turnstile-failed")
      test.skip(true, "Backend could not verify the Turnstile token (no route to Cloudflare siteverify)")
    }
    await expect(success).toBeVisible()
    await expect(success).toContainText("We will call you on 07700 900123")
    await expectNoAxeViolations(page)
    await shot(page, info, "repairs-book-success")
  })
})

test.describe("accounts", () => {
  test("sign in page: guest-first, errors, bad password", async ({ page }, info) => {
    await page.goto("/account")
    await expect(page).toHaveURL(/\/account\/login\?next=%2Faccount$/)
    await expect(page.getByRole("heading", { name: "You do not need an account to shop" })).toBeVisible()
    await checkPage(page)
    await shot(page, info, "login")

    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page.getByTestId("error-summary")).toBeFocused()
    await expect(page.getByTestId("error-summary")).toContainText("Enter your email address")
    await expect(page.getByTestId("error-summary")).toContainText("Enter your password")

    await page.getByLabel("Email address").fill(`nobody-${Date.now()}@example.com`)
    await page.getByLabel("Password", { exact: true }).fill("not-the-password")
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page.getByTestId("error-summary")).toContainText("The email address or password is incorrect")
    await expect(page.getByLabel("Email address")).toHaveValue(/nobody-/)
    await expectNoAxeViolations(page)
    await shot(page, info, "login-errors")
  })

  test("password reset pages", async ({ page }, info) => {
    await page.goto("/account/forgot-password")
    await checkPage(page)
    await shot(page, info, "forgot-password")
    await page.getByLabel("Email address").fill("someone@example.com")
    await page.getByRole("button", { name: "Send reset link" }).click()
    await expect(page.getByRole("main").getByRole("status")).toContainText("If there is an account for someone@example.com")

    // E2's email links to /account/reset-password?token=...&email=...
    await page.goto("/account/reset-password?token=not-a-real-token&email=someone%40example.com")
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Choose a new password")
    await checkPage(page)
    await shot(page, info, "reset-password")
    await page.getByLabel("New password", { exact: true }).fill("a new long password")
    await page.getByLabel("Type the new password again").fill("a different password")
    await page.getByRole("button", { name: "Save new password" }).click()
    await expect(page.getByTestId("error-summary")).toContainText("The passwords do not match")
    await page.getByLabel("Type the new password again").fill("a new long password")
    await page.getByRole("button", { name: "Save new password" }).click()
    await expect(page.getByTestId("error-summary")).toContainText("This reset link has expired or has already been used")
    await expect(page.getByRole("link", { name: "Ask for a new reset link" })).toBeVisible()

    await page.goto("/account/reset-password")
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("This link is not complete")
  })

  test("register, overview, orders, addresses, profile, sign out", async ({ page }, info) => {
    const email = uniqueEmail(info)
    await page.goto("/account/register")
    await page.getByRole("button", { name: "Create account" }).click()
    await expect(page.getByTestId("error-summary")).toBeFocused()
    await expect(page.getByTestId("error-summary")).toContainText("Enter your first name")
    await checkPage(page)
    await shot(page, info, "register-errors")

    await register(page, email)
    await expect(page).toHaveURL(/\/account$/)
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hello, Sam")
    await expect(page.getByRole("navigation", { name: "Your account" }).getByRole("link", { name: "Overview" })).toHaveAttribute(
      "aria-current",
      "page"
    )
    await checkPage(page)
    await shot(page, info, "overview")

    await page.goto("/account/orders")
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your orders")
    await expect(page.getByText("You have not ordered with this account yet.")).toBeVisible()
    await checkPage(page)
    await shot(page, info, "orders")

    // A made-up order id is a 404, never someone else's order
    const missing = await page.goto("/account/orders/order_01NOTREAL")
    expect(missing?.status()).toBe(404)

    // Addresses: validation, then a saved address
    await page.goto("/account/addresses")
    await checkPage(page)
    await page.getByRole("link", { name: "Add an address" }).click()
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Add an address")
    await expect(page.getByLabel("First name")).toHaveValue("Sam")
    await page.getByLabel("Postcode").fill("not a postcode")
    await page.getByRole("button", { name: "Save address" }).click()
    await expect(page.getByTestId("error-summary")).toContainText("Enter the first line of the address")
    await expect(page.getByTestId("error-summary")).toContainText("Enter a full UK postcode")
    await expectNoAxeViolations(page)
    await shot(page, info, "address-form-errors")
    await page.getByLabel("Address line 1").fill("Unit 2A, Southwark Park Rd.")
    await page.getByLabel("Town or city").fill("London")
    await page.getByLabel("Postcode").fill("se163tu")
    await page.getByRole("button", { name: "Save address" }).click()
    await expect(page).toHaveURL(/\/account\/addresses\?saved=added/)
    await expect(page.getByRole("main").getByRole("status")).toContainText("Address saved.")
    const card = page.getByTestId("address-card").first()
    await expect(card).toContainText("SE16 3TU")
    await expect(card).toContainText("Main delivery address")
    await checkPage(page)
    await shot(page, info, "addresses")

    // Remove needs a second, explicit click
    await card.locator("summary").click()
    await card.getByRole("button", { name: "Yes, remove it" }).click()
    await expect(page.getByRole("main").getByRole("status")).toContainText("Address removed.")
    await expect(page.getByTestId("address-card")).toHaveCount(0)

    await page.goto("/account/profile")
    await expect(page.getByText(email)).toBeVisible()
    await page.getByLabel("Phone number").fill("12")
    await page.getByRole("button", { name: "Save details" }).click()
    await expect(page.getByTestId("error-summary")).toContainText("Enter a phone number")
    await page.getByLabel("Phone number").fill("07700 900456")
    await page.getByRole("button", { name: "Save details" }).click()
    await expect(page.getByRole("main").getByRole("status")).toContainText("Your details have been saved.")
    await checkPage(page)
    await shot(page, info, "profile")

    await page.getByRole("button", { name: "Sign out" }).click()
    await expect(page).toHaveURL(/\/account\/login/)
    await page.goto("/account/profile")
    await expect(page).toHaveURL(/\/account\/login\?next=%2Faccount%2Fprofile/)

    // Sign back in and land on the page asked for
    await page.getByLabel("Email address").fill(email)
    await page.getByLabel("Password", { exact: true }).fill("correct horse battery")
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/account\/profile$/)
  })

  test("trade application: sign up from /trade/apply, errors, pending status", async ({ page }, info) => {
    await register(page, uniqueEmail(info), "/trade/apply")
    await expect(page).toHaveURL(/\/trade\/apply$/)
    await expect(page.getByLabel("Full name")).toHaveValue("Sam Tester")

    await page.getByLabel("VAT number").fill("123")
    await page.getByRole("button", { name: "Send application" }).click()
    const summary = page.getByTestId("error-summary")
    await expect(summary).toBeFocused()
    await expect(summary).toContainText("Enter your business name")
    await expect(summary).toContainText("Select your type of business")
    await expect(summary).toContainText("Enter a UK VAT number")
    await summary.getByRole("link", { name: "Select your type of business" }).click()
    await expect(page.getByRole("radio", { name: "Sole trader" })).toBeFocused()
    await checkPage(page)
    await shot(page, info, "trade-apply-errors")

    await page.getByLabel("Business name").fill("Acme Phones Ltd")
    await page.getByRole("radio", { name: "Limited company" }).check()
    await page.getByLabel("VAT number").fill("gb 123 4567 89")
    await page.getByLabel("Companies House number").fill("01234567")
    await page.getByLabel("Phone number").fill("020 7946 0000")
    await shot(page, info, "trade-apply")
    await page.getByRole("button", { name: "Send application" }).click()

    await expect(page).toHaveURL(/\/account\/trade\?submitted=1$/)
    await expect(page.getByRole("main").getByRole("status")).toContainText("Application sent")
    const status = page.getByTestId("trade-status")
    await expect(status).toContainText("Pending")
    await expect(status).toContainText("Acme Phones Ltd")
    await expect(status).toContainText("GB123456789")
    await checkPage(page)
    await shot(page, info, "trade-status")

    // A second application is not offered while one is pending
    await page.goto("/trade/apply")
    await expect(page.getByTestId("trade-status")).toContainText("Pending")
    await expect(page.getByRole("button", { name: "Send application" })).toHaveCount(0)
    await page.goto("/trade")
    await expect(page.getByText("Your application: Pending")).toBeVisible()
  })
})
