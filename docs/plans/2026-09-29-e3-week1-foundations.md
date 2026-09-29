# E3 Week 1: Storefront Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the dtc-starter storefront into a UK-only Tech Nest storefront shell: tests in place, no country prefix, brand tokens + shadcn, and a header and footer built from the real shop data with LocalBusiness JSON-LD, running on port 8003 against the backend on 9003.

**Architecture:** Next.js 15 App Router, server components by default. The shop's facts live in one JSON file copied from `google-business-profile/profile.json` and are exposed through the typed `siteConfig`, which the footer, JSON-LD and later pages read. The design tokens live once, as CSS variables in `globals.css`, mirrored in `src/lib/design/tokens.ts` so a unit test can check contrast and that the two match.

**Tech Stack:** Next 15.5.24, React 19.0.5, Tailwind v3 (+ existing `@medusajs/ui-preset`), shadcn/ui (v3-style, hand-added), lucide-react, Vitest, Playwright, @axe-core/playwright. Package manager pnpm (never create another lockfile).

**Spec:** `docs/specs/design.md` (E3 design spec). Team brief: `E3_STOREFRONT_PROMPT.md` (outside the repo).

## Global Constraints

- Brand red `#D6001C` only for primary buttons, sale badges and the logo. Focus ring `#1D4ED8`, 3px, 2px offset, on `:focus-visible`.
- Body text ≥16px; tap targets ≥44px; WCAG 2.2 AA; zero axe violations at 375px and 1280px.
- One typeface: Inter via `next/font/google`.
- Server components by default; `"use client"` only where interaction needs it.
- No emojis in UI, code, comments or commits. No semicolons, double quotes, 2-space indent, kebab-case files (repo AGENTS.md).
- Prices are formatted as Medusa returns them (major units), `en-GB`, GBP; never divide by 100.
- Storefront dev port **8003** via `PORT=8003 pnpm dev` (team convention); backend URL `http://localhost:9003`; `.env.local` is untracked.
- Do not upgrade Next or Tailwind. Install deps only inside `apps/storefront`.
- Shop data (address, phone, hours, coordinates, maps link) comes only from `src/content/google-profile.json` via `siteConfig`; never hard-code it in components.
- Work in `worktrees/e3` on branch `e3/setup`; keep each merge under ~400 changed lines where possible (split into `e3/setup` = Tasks 0–3 and `e3/layout` = Tasks 4–7 if it grows).

## Review Focus

1. **Sunday/after-hours "today" logic:** at 20:30 Monday London time, the footer must say "Closed now · opens 9am tomorrow"-style text rather than "Open". Server time in UTC during BST is the likely bug. Test pinned in Task 4 (`getOpenStatus` with a BST date).
2. **Old country-prefixed URLs** (`/dk/products/x`, `/gb/cart`) from bookmarks or the starter's emails must redirect to the unprefixed path, not 404. Test pinned in Task 1 (middleware unit test) and Task 7 (e2e).
3. **Backend down:** header and footer must still render (the basket shows 0). A thrown `retrieveCart` must not blank the page. Pinned in Task 6 (CartButton already catches, and the e2e checks the footer renders with no cart cookie).
4. **Keyboard users behind the sticky header:** focus must not be hidden under the header (WCAG 2.4.11). Pinned in Task 3 (`scroll-padding-top` in CSS) and Task 7 (the e2e tabs to the footer link and asserts it's in the viewport).
5. **Hours strings from Google changing format** (e.g. "Closed", "Open 24 hours", "9:30 am–6 pm"): the parser must not crash the layout. Pinned in Task 4 parser tests.

---

## File map

| File | Responsibility |
|---|---|
| `apps/storefront/vitest.config.mts` | Unit test runner (node env, tsconfig path aliases) |
| `apps/storefront/playwright.config.ts` | E2E runner, 375 + 1280 projects, dev server on 8003 |
| `apps/storefront/e2e/*.spec.ts` | Page-level e2e + axe tests |
| `apps/storefront/src/app/api/health/route.ts` | Liveness for Docker (E4) |
| `apps/storefront/src/lib/constants/store.ts` | `STORE_COUNTRY = "gb"` and friends |
| `apps/storefront/src/middleware.ts` | Only: strip legacy country prefix, set cache-id cookie |
| `apps/storefront/src/lib/design/tokens.ts` | Token values mirrored from CSS, contrast helper |
| `apps/storefront/src/styles/globals.css` | CSS variables, focus ring, base type |
| `apps/storefront/src/lib/utils.ts` | `cn()` for shadcn |
| `apps/storefront/src/components/ui/button.tsx` | shadcn Button with Tech Nest variants |
| `apps/storefront/src/content/google-profile.json` | Copy of GBP profile.json (source of shop facts) |
| `apps/storefront/src/lib/site-config.ts` | Typed shop config + hours parsing + open status |
| `apps/storefront/src/lib/seo/local-business.ts` | LocalBusiness JSON-LD builder |
| `apps/storefront/src/modules/layout/templates/nav/index.tsx` | Header |
| `apps/storefront/src/modules/layout/components/device-chip/index.tsx` | Device chip slot (static until the device picker story) |
| `apps/storefront/src/modules/layout/templates/footer/index.tsx` | Footer |

---

### Task 0: Worktree, docs, test tooling, health route, port 8003

**Files:**
- Create: `docs/specs/design.md` (copy of the E3 spec draft), `docs/plans/2026-09-29-e3-week1-foundations.md` (this file)
- Create: `apps/storefront/vitest.config.mts`, `apps/storefront/playwright.config.ts`, `apps/storefront/src/app/api/health/route.ts`, `apps/storefront/src/app/api/health/route.test.ts`
- Modify: `apps/storefront/package.json` (scripts, devDeps), `apps/storefront/.env.template`

**Interfaces:**
- Produces: `pnpm test` (Vitest, `src/**/*.test.ts`), `pnpm test:e2e` (Playwright, `e2e/`), `GET /api/health → 200 "ok"`.

- [ ] **Step 1: Create the worktree and copy docs**

```bash
cd /c/Users/meert/Desktop/technest/store
git worktree add ../worktrees/e3 -b e3/setup
cd ../worktrees/e3
mkdir -p docs/specs docs/plans
cp "$SCRATCH/design.md" docs/specs/design.md
cp "$SCRATCH/2026-09-29-e3-week1-foundations.md" docs/plans/
pnpm install
git add docs && git commit -m "docs: add E3 design spec and week 1 plan"
```
(`$SCRATCH` = the E3 session scratchpad directory.)

- [ ] **Step 2: Add test deps**

```bash
cd apps/storefront
pnpm add -D vitest@^3 vite-tsconfig-paths@^5 @playwright/test@^1 @axe-core/playwright@^4
pnpm exec playwright install chromium
```

- [ ] **Step 3: Configs and scripts**

`apps/storefront/vitest.config.mts`:
```ts
import tsconfigPaths from "vite-tsconfig-paths"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
})
```

`apps/storefront/playwright.config.ts`:
```ts
import { defineConfig, devices } from "@playwright/test"

const PORT = 8003

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [
    { name: "mobile-375", use: { ...devices["iPhone 13"], viewport: { width: 375, height: 812 } } },
    { name: "desktop-1280", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: `pnpm exec next dev --turbopack -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: true,
    timeout: 180_000,
  },
})
```
Note: `devices["iPhone 13"]` uses WebKit; only chromium is installed, so set `browserName: "chromium"` in the mobile project's `use` too.

`package.json` scripts: leave `dev`/`start` as E1 set them (the port comes from `PORT=8003 pnpm dev`, which is the team convention). Add:
```json
"typecheck": "tsc --noEmit",
"test": "vitest run",
"test:e2e": "playwright test"
```
Add `/test-results`, `/playwright-report` to `apps/storefront/.gitignore` (create it if missing).

`.env.template` is E1's shared template (with `800N`/`900N` placeholders). Don't edit it. Create the untracked `.env.local` from it with N=3 plus E3's publishable key from the `technest_e3` backend.

- [ ] **Step 4: Write the failing health test**

`src/app/api/health/route.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import { GET } from "./route"

describe("GET /api/health", () => {
  it("returns 200 ok without calling the backend", async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.text()).toBe("ok")
    expect(res.headers.get("cache-control")).toBe("no-store")
  })
})
```

- [ ] **Step 5: Run it and check that it fails**

Run: `pnpm test` → FAIL (cannot find `./route`).

- [ ] **Step 6: Implement**

`src/app/api/health/route.ts`:
```ts
export const dynamic = "force-dynamic"

export function GET() {
  return new Response("ok", {
    status: 200,
    headers: { "content-type": "text/plain", "cache-control": "no-store" },
  })
}
```

- [ ] **Step 7: Run it and check that it passes**

Run: `pnpm test` → 1 passed. Then `PORT=8003 pnpm dev` and `curl -s localhost:8003/api/health` → `ok` (the middleware matcher already excludes `/api`).

- [ ] **Step 8: Commit**

```bash
git add -A apps/storefront && git commit -m "chore(storefront): vitest, playwright, health route, port 8003"
```

---

### Task 1: UK only, with no country segment in URLs

**Files:**
- Create: `src/lib/constants/store.ts`, `src/middleware.test.ts`
- Move: `src/app/[countryCode]/(main)` → `src/app/(main)`, `src/app/[countryCode]/(checkout)` → `src/app/(checkout)`
- Modify: `src/middleware.ts`, `src/modules/common/components/localized-client-link/index.tsx`, every file listed by `grep -rl countryCode src` (23 files, listed below), `src/app/api/payment-return/route.ts`
- Delete usage (not files yet): `CountrySelect`, `LanguageSelect` in `side-menu`

**Interfaces:**
- Produces: `STORE_COUNTRY: "gb"` from `@lib/constants/store`; the `middleware` export redirects `/<two-letter-code>/rest` → `/rest` (308) when the code is a known ISO country used by the starter (`dk`, `gb`, `us`, `de`, `fr`, `es`, `it`, `se`), and otherwise passes through.

- [ ] **Step 1: Write the failing middleware test**

`src/middleware.test.ts`:
```ts
import { NextRequest } from "next/server"
import { describe, expect, it } from "vitest"
import { middleware } from "./middleware"

const req = (path: string, cookie?: string) =>
  new NextRequest(new URL(path, "http://localhost:8003"), {
    headers: cookie ? { cookie } : {},
  })

describe("middleware", () => {
  it("redirects legacy country-prefixed paths with 308", async () => {
    const res = await middleware(req("/dk/products/usb-c-cable?x=1"))
    expect(res.status).toBe(308)
    expect(res.headers.get("location")).toBe("http://localhost:8003/products/usb-c-cable?x=1")
  })

  it("redirects a bare country root to /", async () => {
    const res = await middleware(req("/gb"))
    expect(res.headers.get("location")).toBe("http://localhost:8003/")
  })

  it("does not treat two-letter real routes as countries", async () => {
    const res = await middleware(req("/c/cases"))
    expect(res.headers.get("location")).toBeNull()
  })

  it("sets the cache id cookie once", async () => {
    const res = await middleware(req("/"))
    expect(res.cookies.get("_medusa_cache_id")?.value).toBeTruthy()
    const again = await middleware(req("/", "_medusa_cache_id=abc"))
    expect(again.cookies.get("_medusa_cache_id")).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run it and check that it fails**

Run: `pnpm test src/middleware.test.ts` → FAIL (the current middleware fetches regions and throws without a backend URL).

- [ ] **Step 3: Implement the constant and the middleware**

`src/lib/constants/store.ts`:
```ts
/** Tech Nest sells to the UK only; every region lookup uses this country. */
export const STORE_COUNTRY = (process.env.NEXT_PUBLIC_DEFAULT_REGION || "gb").toLowerCase()
export const STORE_CURRENCY = "gbp"
export const STORE_LOCALE = "en-GB"
```

`src/middleware.ts` (full replacement):
```ts
import { NextRequest, NextResponse } from "next/server"

/** Country prefixes the dtc-starter used; old links must still work. */
const LEGACY_COUNTRY_PREFIXES = new Set(["dk", "gb", "us", "de", "fr", "es", "it", "se"])

export async function middleware(request: NextRequest) {
  const { pathname, search, origin } = request.nextUrl
  const [, first, ...rest] = pathname.split("/")

  if (first && LEGACY_COUNTRY_PREFIXES.has(first.toLowerCase())) {
    const target = `${origin}/${rest.join("/")}${search}`
    return NextResponse.redirect(target, 308)
  }

  const response = NextResponse.next()
  if (!request.cookies.get("_medusa_cache_id")) {
    response.cookies.set("_medusa_cache_id", crypto.randomUUID(), {
      maxAge: 60 * 60 * 24,
      sameSite: "lax",
    })
  }
  return response
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|images|assets|.*\\.(?:png|svg|jpg|jpeg|gif|webp|avif|ico|txt|xml)).*)",
  ],
}
```
Note: Task 1 keeps the starter's `/products`, `/categories`, `/cart` paths. The `/p`, `/c` and `/basket` renames happen in the catalogue stories, each with its own redirect.

- [ ] **Step 4: Run it and check that it passes**

Run: `pnpm test src/middleware.test.ts` → 4 passed.

- [ ] **Step 5: Move the routes**

```bash
cd apps/storefront/src/app
git mv "[countryCode]/(main)" "(main)"
git mv "[countryCode]/(checkout)" "(checkout)"
rmdir "[countryCode]"
```

- [ ] **Step 6: Replace every `countryCode` use**

Rule for each file from `grep -rl countryCode src`:
- Route `params` types: remove `countryCode` from `Promise<{ countryCode: string; ... }>`. Where the value was used, import `STORE_COUNTRY` from `@lib/constants/store` and use that.
- `generateStaticParams` in `products/[handle]/page.tsx`, `categories/[...category]/page.tsx`, `collections/[handle]/page.tsx`: stop mapping over regions' countries; return one entry per handle.
- `src/lib/data/cart.ts`, `products.ts`, `customer.ts`, `regions.ts`: keep the `countryCode` parameters where they call `getRegion(countryCode)`, but callers pass `STORE_COUNTRY`. In functions that `redirect(\`/${countryCode}/...\`)`, drop the prefix.
- `regions.ts` `getRegion`: change the fallback from `regionMap.get("us")` to `regionMap.get(STORE_COUNTRY)`.
- `localized-client-link/index.tsx`: keep the component (40+ call sites) but make it a plain link:
```tsx
import Link from "next/link"
import React from "react"

/** Thin wrapper kept for the starter's call sites; the site has no country prefix. */
const LocalizedClientLink = ({
  children,
  href,
  ...props
}: {
  children?: React.ReactNode
  href: string
  className?: string
  onClick?: () => void
  passHref?: true
  [x: string]: unknown
}) => (
  <Link href={href} {...props}>
    {children}
  </Link>
)

export default LocalizedClientLink
```
- `side-menu`: remove the `CountrySelect` and `LanguageSelect` blocks and their props. `nav/index.tsx` stops fetching regions/locales for them (Task 6 rewrites the nav anyway).
- `payment-return/route.ts` and `payment-button`: E2 owns the payment step. Change only the URL prefix, and post `[HEADS-UP] → E2` naming the two lines.

Verify: `grep -rn "countryCode" src | grep -v "lib/data"` → only `getRegion(countryCode)`-style internal params remain.

- [ ] **Step 7: Typecheck and run**

Run: `pnpm typecheck` → 0 errors. Then `PORT=8003 pnpm dev`, open `http://localhost:8003/` (renders the starter home with no redirect), and check that `curl -sI localhost:8003/dk/store` shows `308` with `location: /store`.

- [ ] **Step 8: Commit and post**

```bash
git add -A apps/storefront && git commit -m "feat(storefront): UK-only routing without country segment"
```
Chat: `[HEADS-UP] → E2`: payment-return path changed from `/{cc}/...` to `/...`.

---

### Task 2: next.config hardening

**Files:**
- Modify: `apps/storefront/next.config.js`
- Create: `apps/storefront/src/lib/security-headers.test.ts`, `apps/storefront/security-headers.js`

**Interfaces:**
- Produces: `securityHeaders` (CommonJS array of `{ key, value }`) from `security-headers.js`, used by `next.config.js` `headers()` for `/:path*`. The `/checkout` CSP is added later together with E2.

- [ ] **Step 1: Write the failing test**

`src/lib/security-headers.test.ts`:
```ts
import { describe, expect, it } from "vitest"
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { securityHeaders } = require("../../security-headers.js")

const get = (k: string) => securityHeaders.find((h: { key: string }) => h.key === k)?.value

describe("securityHeaders", () => {
  it("sets the baseline headers", () => {
    expect(get("X-Content-Type-Options")).toBe("nosniff")
    expect(get("Referrer-Policy")).toBe("strict-origin-when-cross-origin")
    expect(get("X-Frame-Options")).toBe("DENY")
    expect(get("Permissions-Policy")).toContain("camera=()")
    expect(get("Strict-Transport-Security")).toContain("max-age=63072000")
  })
})
```

- [ ] **Step 2: Run it and check that it fails** → `pnpm test` FAIL (module not found).

- [ ] **Step 3: Implement**

`apps/storefront/security-headers.js`:
```js
/** Baseline headers for every route. The CSP for /checkout is agreed with E2 and added separately. */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self \"https://js.stripe.com\")" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
]

module.exports = { securityHeaders }
```

`next.config.js` changes:
```js
const { securityHeaders } = require("./security-headers")
const BACKEND_URL = new URL(process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9003")
const IMAGE_HOST = process.env.NEXT_PUBLIC_IMAGE_HOSTNAME // R2/CDN public host (E1's .env.template)

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // A stray C:\Users\meert\package-lock.json makes Next pick the wrong workspace root (E1, chat 22:06)
  turbopack: { root: path.join(__dirname, "../..") },
  outputFileTracingRoot: path.join(__dirname, "../.."),
  logging: { fetches: { fullUrl: true } },
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: BACKEND_URL.protocol.replace(":", ""), hostname: BACKEND_URL.hostname, port: BACKEND_URL.port },
      ...(IMAGE_HOST ? [{ protocol: "https", hostname: IMAGE_HOST }] : []),
    ],
  },
  async headers() {
    const rules = [{ source: "/:path*", headers: securityHeaders }]
    // E2 owns checkout-csp.js (agreed in chat 2026-09-29); apply it only once it exists
    try {
      const { checkoutCsp } = require("./checkout-csp")
      rules.push({ source: "/checkout/:path*", headers: [{ key: "Content-Security-Policy", value: checkoutCsp }] })
    } catch {}
    return rules
  },
}
```
Delete the `MEDUSA_CLOUD_S3_*` lines (E1 already removed them from `.env.template`). Leave `output: "standalone"` to E4. If E4's branch merged first, keep their line.

- [ ] **Step 4: Run the tests and the build**

Run: `pnpm test` → all pass. `pnpm build`: if it fails on type or lint errors that were previously hidden, fix them in this task (they are real bugs). Record the count in the commit message.

- [ ] **Step 5: Commit**

```bash
git add -A apps/storefront && git commit -m "feat(storefront): image optimisation, strict build, security headers"
```

---

### Task 3: Design tokens, Inter, focus ring, shadcn Button

**Files:**
- Create: `src/lib/design/tokens.ts`, `src/lib/design/tokens.test.ts`, `src/lib/utils.ts`, `src/components/ui/button.tsx`, `components.json`
- Modify: `src/styles/globals.css`, `tailwind.config.js`, `src/app/layout.tsx`

**Interfaces:**
- Produces: Tailwind colours `brand`, `brand-hover`, `brand-foreground`, `brand-subtle`, `surface`, `surface-2`, `border` (DEFAULT), `border-strong`, `foreground`, `muted-foreground`, `success`, `success-subtle`, `warning`, `warning-subtle`, `destructive`, `ring`; `cn(...classes)`; `<Button variant="primary|secondary|ghost" size="md|lg|icon">`; the `.content-container` width.

- [ ] **Step 1: Write the failing tests**

`src/lib/design/tokens.test.ts`:
```ts
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { contrastRatio, tokens } from "./tokens"

const css = readFileSync(join(__dirname, "../../styles/globals.css"), "utf8")

describe("design tokens", () => {
  it("CSS variables match tokens.ts", () => {
    for (const [name, hex] of Object.entries(tokens)) {
      expect(css).toMatch(new RegExp(`--${name}:\\s*${hex};`, "i"))
    }
  })

  it.each([
    ["brand", "background", 4.5],
    ["brand-foreground", "brand", 4.5],
    ["foreground", "surface", 4.5],
    ["muted-foreground", "surface", 4.5],
    ["success", "success-subtle", 4.5],
    ["warning", "warning-subtle", 4.5],
    ["destructive", "background", 4.5],
    ["brand", "brand-subtle", 4.5],
    ["border-strong", "surface", 3],
    ["ring", "background", 3],
    ["ring", "brand", 1],
  ] as const)("%s on %s ≥ %s:1", (fg, bg, min) => {
    expect(contrastRatio(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(min)
  })
})
```

- [ ] **Step 2: Run it and check that it fails** → `pnpm test` FAIL (no `./tokens`).

- [ ] **Step 3: Implement the tokens**

`src/lib/design/tokens.ts`:
```ts
/** Mirror of the CSS variables in styles/globals.css. The test keeps the two in sync. */
export const tokens = {
  brand: "#D6001C",
  "brand-hover": "#B00017",
  "brand-foreground": "#FFFFFF",
  "brand-subtle": "#FDECEE",
  background: "#FFFFFF",
  surface: "#F6F7F9",
  "surface-2": "#EEF0F3",
  border: "#E3E6EA",
  "border-strong": "#6B7280",
  foreground: "#111827",
  "muted-foreground": "#4B5563",
  success: "#166534",
  "success-subtle": "#E8F5EC",
  warning: "#92400E",
  "warning-subtle": "#FEF3E2",
  destructive: "#B91C1C",
  ring: "#1D4ED8",
} as const

export type TokenName = keyof typeof tokens

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export const contrastRatio = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
```

Prepend to `src/styles/globals.css` (after the three `@import`s):
```css
:root {
  --brand: #D6001C;
  --brand-hover: #B00017;
  --brand-foreground: #FFFFFF;
  --brand-subtle: #FDECEE;
  --background: #FFFFFF;
  --surface: #F6F7F9;
  --surface-2: #EEF0F3;
  --border: #E3E6EA;
  --border-strong: #6B7280;
  --foreground: #111827;
  --muted-foreground: #4B5563;
  --success: #166534;
  --success-subtle: #E8F5EC;
  --warning: #92400E;
  --warning-subtle: #FEF3E2;
  --destructive: #B91C1C;
  --ring: #1D4ED8;
  --radius: 0.5rem;
  --header-h: 64px;
}

@media (min-width: 1024px) {
  :root { --header-h: 72px; }
}

@layer base {
  html {
    scroll-padding-top: calc(var(--header-h) + 52px);
    scroll-padding-bottom: 96px;
    -webkit-text-size-adjust: 100%;
  }
  body {
    @apply bg-background text-foreground font-sans text-base leading-relaxed antialiased;
  }
  :focus-visible {
    outline: 3px solid var(--ring);
    outline-offset: 2px;
  }
  .tabular-nums { font-variant-numeric: tabular-nums; }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; }
  }
}
```
Remove the starter's `input:focus ~ label` floating-label rules only if they conflict with the focus ring (they don't at this stage, so leave them).

`tailwind.config.js` `theme.extend` additions (keep the preset and the existing keys):
```js
colors: {
  // existing grey scale stays
  brand: { DEFAULT: "var(--brand)", hover: "var(--brand-hover)", foreground: "var(--brand-foreground)", subtle: "var(--brand-subtle)" },
  background: "var(--background)",
  surface: { DEFAULT: "var(--surface)", 2: "var(--surface-2)" },
  border: { DEFAULT: "var(--border)", strong: "var(--border-strong)" },
  foreground: "var(--foreground)",
  "muted-foreground": "var(--muted-foreground)",
  success: { DEFAULT: "var(--success)", subtle: "var(--success-subtle)" },
  warning: { DEFAULT: "var(--warning)", subtle: "var(--warning-subtle)" },
  destructive: "var(--destructive)",
  ring: "var(--ring)",
},
fontFamily: { sans: ["var(--font-inter)", "system-ui", "sans-serif"] },
borderRadius: { /* existing */ DEFAULT: "var(--radius)" },
```
Add `"./src/components/**/*.{js,ts,jsx,tsx}"` to `content` if it is missing (it is already listed in the starter).

- [ ] **Step 4: Run it and check that it passes** → `pnpm test` all pass.

- [ ] **Step 5: Inter via next/font**

`src/app/layout.tsx`:
```tsx
import { getBaseURL } from "@lib/util/env"
import { Metadata } from "next"
import { Inter } from "next/font/google"
import "styles/globals.css"

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" })

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
  title: { default: "Tech Nest | Phone accessories and repairs, Bermondsey", template: "%s | Tech Nest" },
}

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" data-mode="light" className={inter.variable}>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded focus:bg-background focus:px-4 focus:py-3">
          Skip to content
        </a>
        <main id="main" className="relative">{props.children}</main>
      </body>
    </html>
  )
}
```
(The skip link sits before `<main>`. The header is rendered by `(main)/layout.tsx` inside `<main>`, so move `id="main"` to a wrapper around `{props.children}` in `(main)/layout.tsx` in Task 6, and change the root's `<main>` to a `<div>` then.)

- [ ] **Step 6: shadcn Button (Tailwind v3 style, hand-added)**

```bash
pnpm add class-variance-authority@^0.7 tailwind-merge@^2 @radix-ui/react-slot@^1 lucide-react
```
`components.json`:
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": { "config": "tailwind.config.js", "css": "src/styles/globals.css", "baseColor": "neutral", "cssVariables": true },
  "aliases": { "components": "@/components", "utils": "@/lib/utils", "ui": "@/components/ui" },
  "iconLibrary": "lucide"
}
```
Add `"@/*": ["*"]` to `tsconfig.json` `paths` so shadcn's `@/` aliases resolve. When adding more components later, use `pnpm dlx shadcn@2.3.0 add <name>` (the last CLI line that targets Tailwind v3) and then swap colour classes to our tokens.

`src/lib/utils.ts`:
```ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

`src/components/ui/button.tsx`:
```tsx
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded font-semibold text-base transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-brand text-brand-foreground hover:bg-brand-hover",
        secondary: "border border-border-strong bg-background text-foreground hover:bg-surface",
        ghost: "text-foreground underline-offset-4 hover:underline",
      },
      size: {
        md: "min-h-11 px-4",
        lg: "min-h-12 px-6",
        icon: "size-11",
      },
    },
    defaultVariants: { variant: "primary", size: "lg" },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
```

- [ ] **Step 7: Verify and commit**

Run: `pnpm test && pnpm typecheck && pnpm lint`, all green. `PORT=8003 pnpm dev`: the body font is Inter (DevTools, computed `font-family` begins with `__Inter`), and Tab shows the blue ring.
```bash
git add -A apps/storefront && git commit -m "feat(storefront): design tokens, Inter, focus ring, shadcn button"
```

---

### Task 4: siteConfig from the Google profile, with opening hours

**Files:**
- Create: `src/content/google-profile.json` (copied from `google-business-profile/profile.json`, unchanged), `src/lib/site-config.ts`, `src/lib/site-config.test.ts`

**Interfaces:**
- Produces:
```ts
type DayName = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday"
type DayHours = { day: DayName; opens: string | null; closes: string | null } // "09:00", "20:00"; null = closed
siteConfig: {
  name: string; legalName: string | null; vatNumber: string | null
  phone: { display: string; e164: string }
  email: string
  address: { line1: string; line2: string; locality: string; postcode: string; country: "GB"; oneLine: string }
  geo: { lat: number; lng: number }
  mapsUrl: string
  rating: { value: number; count: number }
  hours: DayHours[] // Monday first
}
parseHoursLine(line: string): DayHours
getOpenStatus(now: Date, hours?: DayHours[]): { open: boolean; label: string; today: DayHours }
formatTime(hhmm: string): string // "09:00" -> "9am", "17:30" -> "5:30pm"
```

- [ ] **Step 1: Copy the data**

```bash
mkdir -p apps/storefront/src/content
cp /c/Users/meert/Desktop/technest/google-business-profile/profile.json apps/storefront/src/content/google-profile.json
```

- [ ] **Step 2: Write the failing tests**

`src/lib/site-config.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import { formatTime, getOpenStatus, parseHoursLine, siteConfig } from "./site-config"

describe("parseHoursLine", () => {
  it("parses Google's en-dash format", () => {
    expect(parseHoursLine("Tuesday 9 am–8 pm")).toEqual({ day: "Tuesday", opens: "09:00", closes: "20:00" })
    expect(parseHoursLine("Sunday 11 am–5 pm")).toEqual({ day: "Sunday", opens: "11:00", closes: "17:00" })
  })
  it("parses minutes, hyphens and 12 noon/midnight", () => {
    expect(parseHoursLine("Monday 9:30 am-12 pm")).toEqual({ day: "Monday", opens: "09:30", closes: "12:00" })
    expect(parseHoursLine("Friday 12 am–11:30 pm")).toEqual({ day: "Friday", opens: "00:00", closes: "23:30" })
  })
  it("treats Closed and unknown text as closed without throwing", () => {
    expect(parseHoursLine("Sunday Closed")).toEqual({ day: "Sunday", opens: null, closes: null })
    expect(parseHoursLine("Sunday Hours might differ")).toEqual({ day: "Sunday", opens: null, closes: null })
  })
  it("handles Open 24 hours", () => {
    expect(parseHoursLine("Saturday Open 24 hours")).toEqual({ day: "Saturday", opens: "00:00", closes: "24:00" })
  })
})

describe("siteConfig", () => {
  it("is built from the profile", () => {
    expect(siteConfig.address.postcode).toBe("SE16 3TU")
    expect(siteConfig.phone.e164).toBe("+447775669000")
    expect(siteConfig.hours.map((h) => h.day)[0]).toBe("Monday")
    expect(siteConfig.hours).toHaveLength(7)
    expect(siteConfig.hours.find((h) => h.day === "Sunday")).toEqual({ day: "Sunday", opens: "11:00", closes: "17:00" })
    expect(siteConfig.rating).toEqual({ value: 5, count: 30 })
  })
})

describe("formatTime", () => {
  it("formats compactly", () => {
    expect(formatTime("09:00")).toBe("9am")
    expect(formatTime("17:30")).toBe("5:30pm")
    expect(formatTime("12:00")).toBe("12pm")
  })
})

describe("getOpenStatus (Europe/London)", () => {
  it("is open at 19:30 London on a BST Monday (18:30 UTC)", () => {
    const s = getOpenStatus(new Date("2026-10-05T18:30:00Z"))
    expect(s.open).toBe(true)
    expect(s.label).toBe("Open now · until 8pm")
  })
  it("is closed at 20:30 London on a BST Monday (19:30 UTC) even though UTC says 19:30", () => {
    const s = getOpenStatus(new Date("2026-10-05T19:30:00Z"))
    expect(s.open).toBe(false)
    expect(s.label).toBe("Closed now · opens 9am tomorrow")
  })
  it("uses Sunday hours and GMT after the clocks change", () => {
    const s = getOpenStatus(new Date("2026-11-01T10:30:00Z")) // Sunday 10:30 GMT
    expect(s.today.day).toBe("Sunday")
    expect(s.open).toBe(false)
    expect(s.label).toBe("Closed now · opens 11am today")
  })
})
```

- [ ] **Step 3: Run it and check that it fails** → `pnpm test` FAIL (module not found).

- [ ] **Step 4: Implement**

`src/lib/site-config.ts`:
```ts
import profile from "@/content/google-profile.json"

export type DayName = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday"
export type DayHours = { day: DayName; opens: string | null; closes: string | null }

const DAYS: DayName[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

const to24 = (h: string, m: string | undefined, ampm: string) => {
  let hour = parseInt(h, 10) % 12
  if (ampm === "pm") hour += 12
  return `${String(hour).padStart(2, "0")}:${m ?? "00"}`
}

const TIME = "(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm)"
const RANGE = new RegExp(`${TIME}\\s*[–-]\\s*${TIME}`, "i")

export function parseHoursLine(line: string): DayHours {
  const day = DAYS.find((d) => line.startsWith(d))
  if (!day) throw new Error(`Unknown day in hours line: ${line}`)
  const rest = line.slice(day.length).trim()
  if (/open 24 hours/i.test(rest)) return { day, opens: "00:00", closes: "24:00" }
  const m = rest.match(RANGE)
  if (!m) return { day, opens: null, closes: null }
  return {
    day,
    opens: to24(m[1], m[2], m[3].toLowerCase()),
    closes: to24(m[4], m[5], m[6].toLowerCase()),
  }
}

export function formatTime(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number)
  const suffix = h >= 12 && h < 24 ? "pm" : "am"
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}${m ? `:${String(m).padStart(2, "0")}` : ""}${suffix}`
}

// Address "Unit 2A, Southwark Park Rd., London SE16 3TU" -> parts
const [line1, line2Raw, cityPostcode] = profile.address.split(",").map((s) => s.trim())
const postcode = cityPostcode.match(/[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i)?.[0] ?? ""
const locality = cityPostcode.replace(postcode, "").trim()

const hoursByDay = new Map(profile.opening_hours.map((l) => [parseHoursLine(l).day, parseHoursLine(l)]))

export const siteConfig = {
  name: profile.name,
  legalName: null as string | null, // [LEAD?] pending
  vatNumber: null as string | null, // [LEAD?] pending
  phone: {
    display: profile.phone,
    e164: `+44${profile.phone.replace(/\s/g, "").replace(/^0/, "")}`,
  },
  email: "hello@technest.co.uk",
  address: {
    line1,
    line2: line2Raw.replace(/\.$/, ""),
    locality,
    postcode,
    country: "GB" as const,
    oneLine: profile.address,
  },
  geo: { lat: profile.coordinates.lat, lng: profile.coordinates.lng },
  mapsUrl: profile.links.maps,
  rating: { value: profile.rating, count: profile.review_count },
  hours: DAYS.map((d) => hoursByDay.get(d) ?? { day: d, opens: null, closes: null }),
}

const londonParts = (now: Date) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ""
  return { day: get("weekday") as DayName, time: `${get("hour")}:${get("minute")}` }
}

export function getOpenStatus(now: Date, hours: DayHours[] = siteConfig.hours) {
  const { day, time } = londonParts(now)
  const idx = DAYS.indexOf(day)
  const today = hours[idx]
  const open = !!today.opens && !!today.closes && time >= today.opens && time < today.closes
  if (open) return { open, today, label: `Open now · until ${formatTime(today.closes!)}` }
  if (today.opens && time < today.opens) {
    return { open, today, label: `Closed now · opens ${formatTime(today.opens)} today` }
  }
  for (let i = 1; i <= 7; i++) {
    const next = hours[(idx + i) % 7]
    if (next.opens) {
      const when = i === 1 ? "tomorrow" : next.day
      return { open, today, label: `Closed now · opens ${formatTime(next.opens)} ${when}` }
    }
  }
  return { open, today, label: "Closed now" }
}
```
`tsconfig.json` already has `resolveJsonModule: true`, and the `@/*` alias was added in Task 3.

- [ ] **Step 5: Run it and check that it passes** → `pnpm test` all pass.

- [ ] **Step 6: Commit**

```bash
git add -A apps/storefront && git commit -m "feat(storefront): site config and opening hours from Google profile"
```

---

### Task 5: LocalBusiness JSON-LD

**Files:**
- Create: `src/lib/seo/local-business.ts`, `src/lib/seo/local-business.test.ts`, `src/lib/seo/json-ld.tsx`
- Modify: `src/app/(main)/layout.tsx`

**Interfaces:**
- Consumes: `siteConfig` (Task 4).
- Produces: `buildLocalBusinessJsonLd(config = siteConfig, baseUrl: string): Record<string, unknown>`; `<JsonLd data={...} />` server component (reused for Product/Breadcrumb later).

- [ ] **Step 1: Write the failing test**

`src/lib/seo/local-business.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import { siteConfig } from "@/lib/site-config"
import { buildLocalBusinessJsonLd } from "./local-business"

describe("buildLocalBusinessJsonLd", () => {
  const ld = buildLocalBusinessJsonLd(siteConfig, "https://technest.co.uk") as any

  it("describes the shop", () => {
    expect(ld["@context"]).toBe("https://schema.org")
    expect(ld["@type"]).toEqual(["Store", "MobilePhoneStore"])
    expect(ld.telephone).toBe("+447775669000")
    expect(ld.address).toMatchObject({ "@type": "PostalAddress", postalCode: "SE16 3TU", addressCountry: "GB" })
    expect(ld.geo).toEqual({ "@type": "GeoCoordinates", latitude: 51.4923393, longitude: -0.0643359 })
    expect(ld.url).toBe("https://technest.co.uk")
    expect(ld.hasMap).toBe(siteConfig.mapsUrl)
  })

  it("has one opening spec per open day", () => {
    const sunday = ld.openingHoursSpecification.find((s: any) => s.dayOfWeek === "https://schema.org/Sunday")
    expect(sunday).toEqual({ "@type": "OpeningHoursSpecification", dayOfWeek: "https://schema.org/Sunday", opens: "11:00", closes: "17:00" })
    expect(ld.openingHoursSpecification).toHaveLength(7)
  })

  it("does not claim a rating (self-serving LocalBusiness reviews are ineligible)", () => {
    expect(ld.aggregateRating).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run it and check that it fails** → FAIL (module not found).

- [ ] **Step 3: Implement**

`src/lib/seo/local-business.ts`:
```ts
import { siteConfig as defaultConfig } from "@/lib/site-config"

type SiteConfig = typeof defaultConfig

export function buildLocalBusinessJsonLd(config: SiteConfig = defaultConfig, baseUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": ["Store", "MobilePhoneStore"],
    name: config.name,
    url: baseUrl,
    telephone: config.phone.e164,
    email: config.email,
    image: `${baseUrl}/images/shop/shopfront.jpg`,
    address: {
      "@type": "PostalAddress",
      streetAddress: `${config.address.line1}, ${config.address.line2}`,
      addressLocality: config.address.locality,
      postalCode: config.address.postcode,
      addressCountry: config.address.country,
    },
    geo: { "@type": "GeoCoordinates", latitude: config.geo.lat, longitude: config.geo.lng },
    hasMap: config.mapsUrl,
    openingHoursSpecification: config.hours
      .filter((h) => h.opens && h.closes)
      .map((h) => ({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: `https://schema.org/${h.day}`,
        opens: h.opens,
        closes: h.closes,
      })),
    priceRange: "£",
  }
}
```

`src/lib/seo/json-ld.tsx`:
```tsx
/** Renders JSON-LD safely: "<" is escaped so data can never close the script tag. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  )
}
```
In `(main)/layout.tsx`, render `<JsonLd data={buildLocalBusinessJsonLd(siteConfig, getBaseURL())} />` once, before `<Nav />`.

Add the shopfront image: resize `google-business-profile/photos/photo_09.jpg` to 1600px wide, JPEG q80, and save it as `apps/storefront/public/images/shop/shopfront.jpg` (≤300KB):
```bash
python -c "from PIL import Image; i=Image.open(r'../../google-business-profile/photos/photo_09.jpg'); i.thumbnail((1600,1600)); i.save('apps/storefront/public/images/shop/shopfront.jpg', quality=80, optimize=True, progressive=True)"
```
(Only photos 05–10 are Tech Nest; see the spec, section 5.)

- [ ] **Step 4: Run it and check that it passes** → `pnpm test` all pass. `PORT=8003 pnpm dev`, then `curl -s localhost:8003 | grep -o 'application/ld+json' | head -1` shows it is present.

- [ ] **Step 5: Commit**

```bash
git add -A apps/storefront && git commit -m "feat(storefront): LocalBusiness JSON-LD from site config"
```

---

### Task 6: Header

**Files:**
- Modify: `src/modules/layout/templates/nav/index.tsx`, `src/modules/layout/components/cart-dropdown/index.tsx` (label + aria-live only), `src/app/(main)/layout.tsx`, `src/app/layout.tsx`
- Create: `src/modules/layout/components/device-chip/index.tsx`, `src/modules/layout/components/logo/index.tsx`

**Interfaces:**
- Consumes: `Button` (Task 3), `cn`, `siteConfig`.
- Produces: `<DeviceChip device={{ label: string } | null} />` (server component; the device-picker story passes the value read from the `tn_device` cookie). `<Logo />`.

- [ ] **Step 1: Write the failing e2e test**

`e2e/layout.spec.ts`:
```ts
import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

test.describe("site shell", () => {
  test("header has logo, search, device chip and basket", async ({ page }) => {
    await page.goto("/")
    const header = page.getByRole("banner")
    await expect(header.getByRole("link", { name: "Tech Nest home" })).toBeVisible()
    await expect(header.getByRole("link", { name: /choose your device/i })).toBeVisible()
    await expect(header.getByRole("button", { name: /search/i }).or(header.getByRole("searchbox"))).toBeVisible()
    const basket = header.getByRole("link", { name: /basket/i }).or(header.getByRole("button", { name: /basket/i }))
    await expect(basket.first()).toBeVisible()
    const status = header.getByRole("status")
    await expect(status).toHaveCount(1)
    await expect(status).toHaveText(/\d+ items? in your basket/)
  })

  test("skip link is first and moves focus to main", async ({ page }) => {
    await page.goto("/")
    await page.keyboard.press("Tab")
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused()
  })

  test("header tap targets are at least 44px", async ({ page }) => {
    await page.goto("/")
    const boxes = await page.getByRole("banner").locator("a:visible, button:visible").evaluateAll((els) =>
      els.map((e) => { const r = e.getBoundingClientRect(); return { h: r.height, w: r.width, t: e.textContent } })
    )
    for (const b of boxes) expect(b.h, `height of ${b.t}`).toBeGreaterThanOrEqual(44)
  })

  test("legacy country URL redirects", async ({ page }) => {
    const res = await page.goto("/gb")
    expect(new URL(page.url()).pathname).toBe("/")
    expect(res?.ok()).toBe(true)
  })

  test("no axe violations", async ({ page }) => {
    await page.goto("/")
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()
    expect(results.violations).toEqual([])
  })
})
```

- [ ] **Step 2: Run it and check that it fails**

Requires E3's backend on 9003 (`cd apps/backend && pnpm dev` with `.env` PORT=9003, DB `technest_e3`). Run: `pnpm test:e2e e2e/layout.spec.ts` → FAIL (no "Tech Nest home" link, no device chip).

- [ ] **Step 3: Implement**

`src/modules/layout/components/logo/index.tsx`:
```tsx
import Link from "next/link"

export default function Logo() {
  return (
    <Link href="/" aria-label="Tech Nest home" className="inline-flex min-h-11 items-center">
      <span className="text-xl font-extrabold uppercase tracking-tight text-brand lg:text-2xl">Tech Nest</span>
    </Link>
  )
}
```

`src/modules/layout/components/device-chip/index.tsx`:
```tsx
import Link from "next/link"
import { Smartphone } from "lucide-react"
import { cn } from "@/lib/utils"

type Props = { device: { label: string } | null; className?: string }

/** Static until the device-picker story wires the tn_device cookie. */
export default function DeviceChip({ device, className }: Props) {
  return (
    <Link
      href="/devices"
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-full bg-surface px-4 text-base text-foreground hover:bg-surface-2",
        className
      )}
    >
      <Smartphone aria-hidden className="size-5" />
      {device ? (
        <span>
          Shopping for: <strong className="font-semibold">{device.label}</strong>
          <span className="text-muted-foreground"> · change</span>
        </span>
      ) : (
        <span>Choose your device</span>
      )}
    </Link>
  )
}
```

`src/modules/layout/templates/nav/index.tsx` (full replacement):
```tsx
import { Suspense } from "react"
import Link from "next/link"
import { User } from "lucide-react"
import CartButton from "@modules/layout/components/cart-button"
import DeviceChip from "@modules/layout/components/device-chip"
import Logo from "@modules/layout/components/logo"
import Search from "@modules/layout/components/search"
import SideMenu from "@modules/layout/components/side-menu"

export default async function Nav() {
  const device = null // device-picker story: read tn_device cookie here

  return (
    <div className="sticky inset-x-0 top-0 z-50">
      <header className="border-b border-border bg-background">
        <nav aria-label="Main" className="content-container flex h-[var(--header-h)] items-center gap-2 lg:gap-6">
          <div className="lg:hidden">
            <SideMenu />
          </div>
          <Logo />
          <div className="hidden flex-1 lg:block">
            <Search />
          </div>
          <DeviceChip device={device} className="hidden lg:inline-flex" />
          <div className="ml-auto flex items-center gap-1 lg:ml-0">
            <div className="lg:hidden">
              <Search />
            </div>
            <Link href="/account" className="hidden min-h-11 items-center gap-2 px-2 lg:inline-flex">
              <User aria-hidden className="size-5" />
              Account
            </Link>
            <Suspense fallback={<Link href="/cart" className="inline-flex min-h-11 items-center px-2">Basket (0)</Link>}>
              <CartButton />
            </Suspense>
          </div>
        </nav>
        <div className="border-t border-border bg-surface px-4 py-1 lg:hidden">
          <DeviceChip device={device} className="w-full justify-center bg-transparent" />
        </div>
      </header>
    </div>
  )
}
```
`SideMenu` loses its `regions/locales/currentLocale` props in Task 1; update its links to Shop, Repairs, Trade, Account, and make its trigger `min-h-11 min-w-11` with `aria-label="Menu"`.

`cart-dropdown`: change the trigger text from "Cart" to "Basket", make the trigger `min-h-11`, show `Basket` plus a visual count badge (`aria-hidden`), and add a visually hidden `<span role="status" aria-atomic="true" className="sr-only">{totalItems} {totalItems === 1 ? "item" : "items"} in your basket</span>` (the header's only live region). Visual and behaviour changes to the dropdown wait for the basket-drawer story.

`search` trigger: ensure it renders a `button` with an accessible name "Search" and `min-h-11 min-w-11`. Change only the trigger classes and label.

`(main)/layout.tsx`: wrap `{props.children}` in `<div id="main" tabIndex={-1}>`, and in the root layout change `<main id="main">` to `<div>` and `<main>` around the page area to keep one `main` landmark: root `<body>` → skip link + `{children}`; `(main)/layout.tsx` → `<Nav/>`, `<main id="main" tabIndex={-1}>{children}</main>`, `<Footer/>`. Do the same in `(checkout)/layout.tsx`.

`content-container` is defined by the Medusa preset. Override it in `globals.css` `@layer components` as `mx-auto w-full max-w-[1280px] px-4 md:px-6 xl:px-8` so the spec's gutters apply.

- [ ] **Step 4: Run it and check that it passes** → `pnpm test:e2e e2e/layout.spec.ts` passes on both projects. If axe reports violations from starter home-page components, fix them if they are small (contrast, labels), otherwise note them in the commit and chat (the home page is rebuilt in weeks 2–3). The header itself must have zero violations: scope a second axe run with `.include("header")` and assert it is empty.

- [ ] **Step 5: Commit**

```bash
git add -A apps/storefront && git commit -m "feat(storefront): Tech Nest header with device chip slot and basket"
```

---

### Task 7: Footer

**Files:**
- Modify: `src/modules/layout/templates/footer/index.tsx` (full replacement), `e2e/layout.spec.ts`

**Interfaces:**
- Consumes: `siteConfig`, `getOpenStatus`, `formatTime` (Task 4).

- [ ] **Step 1: Add the failing e2e tests** (append to `e2e/layout.spec.ts`)

```ts
test.describe("footer", () => {
  test("shows real shop details from the profile", async ({ page }) => {
    await page.goto("/")
    const footer = page.getByRole("contentinfo")
    await expect(footer).toContainText("Unit 2A, Southwark Park Rd")
    await expect(footer).toContainText("SE16 3TU")
    await expect(footer.getByRole("link", { name: /07775 669000/ })).toHaveAttribute("href", "tel:+447775669000")
    await expect(footer.getByRole("link", { name: /open in google maps/i })).toHaveAttribute("href", /google\.com\/maps/)
    await expect(footer).toContainText("Sunday")
    await expect(footer).toContainText("11am–5pm")
    for (const name of ["Terms", "Delivery", "Returns", "Privacy", "Cookies", "Accessibility"]) {
      await expect(footer.getByRole("link", { name, exact: true })).toBeVisible()
    }
  })

  test("footer link is not hidden under the sticky header when tabbed to", async ({ page }) => {
    await page.goto("/")
    const link = page.getByRole("contentinfo").getByRole("link", { name: "Terms", exact: true })
    await link.focus()
    const box = await link.boundingBox()
    const header = await page.getByRole("banner").boundingBox()
    expect(box!.y).toBeGreaterThanOrEqual(header!.y + header!.height)
  })
})
```

- [ ] **Step 2: Run it and check that it fails** → FAIL (the starter footer has no address).

- [ ] **Step 3: Implement**

`src/modules/layout/templates/footer/index.tsx`:
```tsx
import Link from "next/link"
import { MapPin, Phone } from "lucide-react"
import { listCategories } from "@lib/data/categories"
import { formatTime, getOpenStatus, siteConfig } from "@/lib/site-config"

const HELP = [
  { href: "/legal/delivery", label: "Delivery" },
  { href: "/legal/returns", label: "Returns" },
  { href: "/click-and-collect", label: "Click & Collect" },
  { href: "/contact", label: "Contact us" },
]
const LEGAL = [
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/delivery", label: "Delivery" },
  { href: "/legal/returns", label: "Returns" },
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/cookies", label: "Cookies" },
  { href: "/legal/accessibility", label: "Accessibility" },
]

export default async function Footer() {
  const categories = await listCategories({ parent_category_id: "null", limit: 8 }).catch(() => [])
  const status = getOpenStatus(new Date())
  const { address, phone, mapsUrl, hours } = siteConfig

  return (
    <footer className="mt-20 border-t border-border bg-surface">
      <div className="content-container grid gap-10 py-12 md:grid-cols-2 lg:grid-cols-4">
        <section aria-labelledby="f-shop">
          <h2 id="f-shop" className="text-lg font-semibold">Shop</h2>
          <ul className="mt-3 space-y-1">
            {categories.map((c) => (
              <li key={c.id}>
                <Link href={`/categories/${c.handle}`} className="inline-flex min-h-11 items-center hover:underline">{c.name}</Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="f-help">
          <h2 id="f-help" className="text-lg font-semibold">Help</h2>
          <ul className="mt-3 space-y-1">
            {HELP.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="inline-flex min-h-11 items-center hover:underline">{l.label}</Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="f-visit">
          <h2 id="f-visit" className="text-lg font-semibold">Visit us</h2>
          <address className="mt-3 not-italic">
            {address.line1}, {address.line2}
            <br />
            {address.locality} {address.postcode}
          </address>
          <p className="mt-2 font-semibold">{status.label}</p>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 text-base">
            {hours.map((h) => (
              <div key={h.day} className="contents">
                <dt>{h.day}</dt>
                <dd className="tabular-nums">{h.opens && h.closes ? `${formatTime(h.opens)}–${formatTime(h.closes)}` : "Closed"}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-3 flex flex-col gap-1">
            <a href={`tel:${phone.e164}`} className="inline-flex min-h-11 items-center gap-2 hover:underline">
              <Phone aria-hidden className="size-5" /> {phone.display}
            </a>
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 hover:underline">
              <MapPin aria-hidden className="size-5" /> Open in Google Maps
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </div>
        </section>

        <section aria-labelledby="f-more">
          <h2 id="f-more" className="text-lg font-semibold">Repairs and trade</h2>
          <ul className="mt-3 space-y-1">
            <li><Link href="/repairs" className="inline-flex min-h-11 items-center hover:underline">Book a repair</Link></li>
            <li><Link href="/trade" className="inline-flex min-h-11 items-center hover:underline">Trade accounts</Link></li>
            <li><Link href="/about" className="inline-flex min-h-11 items-center hover:underline">About us</Link></li>
          </ul>
        </section>
      </div>

      <div className="border-t border-border">
        <div className="content-container flex flex-col gap-3 py-6 text-sm text-muted-foreground lg:flex-row lg:items-center lg:justify-between">
          <p>
            &copy; {new Date().getFullYear()} {siteConfig.legalName ?? siteConfig.name}
            {siteConfig.vatNumber ? ` · VAT ${siteConfig.vatNumber}` : ""}
          </p>
          <nav aria-label="Legal">
            <ul className="flex flex-wrap gap-x-4">
              {LEGAL.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="inline-flex min-h-11 items-center text-base hover:underline">{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  )
}
```
Check the real `listCategories` signature in `src/lib/data/categories.ts` before using it (the argument names above come from the starter's pattern). Adjust it to the actual signature, and keep the `.catch(() => [])` so a backend outage still renders the footer.

The footer's "Delivery" appears in both Help and Legal. The e2e scopes the legal links with `exact: true` inside the footer, so `getByRole(...).first()` may be needed. Rather than duplicating, drop "Delivery" and "Returns" from HELP if the test is ambiguous.

The page renders the "Open now" status at request time. Because the layout is dynamic (it reads cookies for the cart), that is fine. If the layout becomes static later, move the status into a tiny client component.

- [ ] **Step 4: Run all tests**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm test:e2e`, all green on both projects. With the backend stopped, `PORT=8003 pnpm dev` + `curl -s localhost:8003 | grep -c "SE16 3TU"` should print ≥1. If the page 500s instead, the Review Focus #3 bug is live: wrap the failing calls with `.catch(() => null)`.

- [ ] **Step 5: Commit, review, merge**

```bash
git add -A apps/storefront && git commit -m "feat(storefront): footer with real shop details and hours"
```
Then follow the brief's section 10: read the chat, `/code-review`, `[MERGE-START] e3/setup`, rebase on main, typecheck/lint/tests, `git merge --ff-only`, `[MERGE-DONE]`, `[CONTRACT]` with the route list (`/`, `/store`, `/products/[handle]`, `/categories/[...category]`, `/cart`, `/checkout`, `/order/[id]/confirmed`, `/account/...`, `/api/health`) and the note that `/p`, `/c` and `/basket` arrive with redirects in weeks 2–5.
