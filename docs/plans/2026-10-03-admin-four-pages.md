# Admin in four pages: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Before writing any admin UI code, load `medusa-dev:building-admin-dashboard-customizations` (with `references/forms.md`, `references/display-patterns.md`, `references/navigation.md`) and the `ui-ux-pro-max` skill family (lead's rule for all Tech Nest UI). Before backend code, load `medusa-dev:building-with-medusa` (`reference/workflows.md`, `reference/api-routes.md`).

**Goal:** The shop owner sees four menu items (Today, Orders, Products, Shop settings), can ship a delivery order and change a price or stock level without opening Medusa's own pages, and can add a product by typing as easily as by photo.

**Architecture:** The eight existing custom pages become components under `src/admin/components/{orders,products,settings}/` and are composed into four UI routes with URL-driven tabs. Two new backend features (delivery orders: list + mark shipped; variant price & stock update) follow the project's module → workflow → route pattern and reuse the Click & Collect listing helpers and the import's price step. Medusa's own sidebar items are hidden by a stylesheet injected at admin start-up.

**Tech Stack:** Medusa 2.21 admin SDK (`defineRouteConfig`), `@medusajs/ui` (`Tabs`, `Container`, `Button`, `Input`, `Badge`), React Query, `react-router-dom` (`useSearchParams`, `Navigate`), Medusa workflows SDK, Jest (`test:unit`, `test:integration:http`).

**Spec:** `docs/specs/admin-four-pages.md`

## Global Constraints

- Branch `e4/admin-four-pages` in `worktrees/e4`; small commits; `main` only takes fast-forward merges after CI.
- Only GET, POST, DELETE routes; every mutation through a workflow; every new route/workflow gets an HTTP integration test (`CLAUDE.md`).
- Money: our payloads in integer pence (`price_pence`); Medusa prices written as-is in major units; `poundsInputToPence` / `formatPence` from `src/admin/lib/pence.ts` at the UI boundary.
- Admin data access only through `sdk` from `src/admin/lib/client.ts` (`sdk.client.fetch` for custom routes, `sdk.admin.*` for built-ins).
- UI: `@medusajs/ui` components, semantic colour classes, `TAP` (min 44 px) on every button and link the owner taps, `size="small"` is NOT used on owner-facing primary actions (existing pages use default size with `TAP`); follow the look of `click-collect/page.tsx`.
- No new npm dependencies. No `.tsx` unit tests (Jest only transforms `.ts`); put logic in `.ts` files under `src/admin/lib` and test those.
- Owner-facing copy: plain English, no env var names.
- Backend checks before each commit: `pnpm --filter @technest/backend lint`, `test:unit`, and the relevant HTTP spec; `pnpm --filter @technest/backend build` before the final merge.

## Review Focus

1. Pressing **Packed & shipped** twice (double tap, or two devices) must ship once and send one email → Task 4 test "shipping an already shipped order is a no-op (200, `already_shipped: true`), no second `shipment.created`".
2. A Click & Collect order must never appear in the Delivery tab and a delivery order never on the Collect board → Task 4 test "a pickup order is not listed under /admin/delivery-orders".
3. Saving price & stock with a bad price (`0`, negative, 3 decimals, text) must be refused with a readable message and change nothing → Task 7 test "invalid price_pence / stock → 400, variant unchanged".
4. Price & stock Save must not wipe the variant's other prices (the 2.21 `updateProductVariantsWorkflow` compensation bug) → Task 7 uses `setImportVariantPricesStep`, test asserts a second (trade price-list) price survives.
5. With Medusa's menu hidden, opening `/app` must still land on Today and the mobile menu must show the four items → Task 1 test on the selector list + Task 11 browser check on a phone-width viewport.

---

### Task 1: Hide Medusa's sidebar items

**Files:**
- Create: `apps/backend/src/admin/lib/hide-core-nav.ts`
- Create: `apps/backend/src/admin/lib/__tests__/hide-core-nav.unit.spec.ts`
- Modify: `apps/backend/src/admin/widgets/orders-today.tsx` (import the module at the top so it runs at admin start-up, next to the existing `OPENED_AT` start-page logic)

**Interfaces:**
- Produces: `coreNavSelectors(basePath: string): string[]` and `CORE_NAV_PATHS` (the hidden Medusa paths), `hideCoreNavCss(basePath: string): string`, `installHideCoreNav(doc: Document, basePath: string): void` (idempotent: a `<style id="technest-hide-core-nav">` once).

- [ ] **Step 1: Write the failing test**

```ts
// apps/backend/src/admin/lib/__tests__/hide-core-nav.unit.spec.ts
import { CORE_NAV_PATHS, coreNavSelectors, hideCoreNavCss } from "../hide-core-nav"

describe("hide-core-nav", () => {
  it("hides exactly Medusa's own menu entries, never ours", () => {
    expect(CORE_NAV_PATHS).toEqual([
      "/orders", "/products", "/inventory", "/customers", "/promotions", "/price-lists", "/settings",
    ])
    const selectors = coreNavSelectors("/app")
    expect(selectors).toContain('a[href="/app/orders"]')
    expect(selectors).toContain('a[href="/app/settings"]')
    // Exact-match selectors only: "/app/shop-orders" must not be caught by "/orders".
    expect(selectors.every((s) => s.startsWith('a[href="/app/') && s.endsWith('"]'))).toBe(true)
    expect(selectors.some((s) => s.includes("shop-"))).toBe(false)
  })

  it("builds one stylesheet that hides the items in the sidebar and the mobile menu", () => {
    const css = hideCoreNavCss("/app")
    expect(css).toContain('nav a[href="/app/orders"]')
    expect(css).toContain("display: none !important")
    expect(css).not.toContain("/app/today")
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/backend && pnpm exec cross-env TEST_TYPE=unit NODE_OPTIONS=--experimental-vm-modules jest --runInBand --forceExit src/admin/lib/__tests__/hide-core-nav`
Expected: FAIL, "Cannot find module '../hide-core-nav'".

- [ ] **Step 3: Implement**

```ts
// apps/backend/src/admin/lib/hide-core-nav.ts
/**
 * The owner's menu is Today, Orders, Products and Shop settings (our routes). Medusa's own
 * entries stay reachable by URL (our rows link to /orders/:id) but are hidden from the sidebar
 * and the mobile menu. A stylesheet, not DOM surgery: a Medusa upgrade can only make an item
 * reappear, never break the page. See docs/specs/admin-four-pages.md.
 */
export const CORE_NAV_PATHS = [
  "/orders", "/products", "/inventory", "/customers", "/promotions", "/price-lists", "/settings",
] as const

const STYLE_ID = "technest-hide-core-nav"

/** Exact-href selectors: "/app/orders" must not match our "/app/shop-orders". */
export function coreNavSelectors(basePath: string): string[] {
  const base = basePath.replace(/\/+$/, "")
  return CORE_NAV_PATHS.map((p) => `a[href="${base}${p}"]`)
}

export function hideCoreNavCss(basePath: string): string {
  // Sidebar and mobile drawer both render the entries as links inside a <nav>. The list item
  // wrapper (`li`) is hidden where the markup has one, else the link itself.
  const rules = coreNavSelectors(basePath).flatMap((s) => [`nav li:has(> ${s})`, `nav ${s}`])
  return `${rules.join(",\n")} {\n  display: none !important;\n}\n`
}

export function installHideCoreNav(doc: Document, basePath: string): void {
  if (doc.getElementById(STYLE_ID)) return
  const style = doc.createElement("style")
  style.id = STYLE_ID
  style.textContent = hideCoreNavCss(basePath)
  doc.head.appendChild(style)
}
```

In `orders-today.tsx`, at module level next to `OPENED_AT`:

```ts
import { installHideCoreNav } from "../lib/hide-core-nav"
// Runs once when the admin bundle loads, on every page (widget modules are imported at start-up).
if (typeof document !== "undefined") installHideCoreNav(document, "/app")
```

- [ ] **Step 4: Run the test** — Expected: PASS.
- [ ] **Step 5: Browser check** — `cd apps/backend && pnpm dev`, open `http://localhost:900N/app`: Medusa's Orders/Products/… entries are gone on desktop and in the phone-width menu; our items remain. If a selector misses (Medusa markup differs), inspect the DOM and adjust `hideCoreNavCss` (keep the exact-href rule), re-run the unit test.
- [ ] **Step 6: Commit** — `git commit -m "feat(admin): hide Medusa's own menu entries; the owner sees our pages only"`

---

### Task 2: URL-driven tabs helper

**Files:**
- Create: `apps/backend/src/admin/lib/tabs.ts`
- Create: `apps/backend/src/admin/lib/__tests__/tabs.unit.spec.ts`
- Create: `apps/backend/src/admin/components/page-tabs.tsx`

**Interfaces:**
- Produces: `parseTab<T extends string>(raw: string | null, allowed: readonly T[], fallback: T): T` (pure), `useUrlTab<T>(allowed, fallback): [T, (t: T) => void]` (wraps `useSearchParams`; setting replaces the `tab` param, keeps the others), and `PageTabs<T>({ tabs: { value: T; label: string }[], value, onChange, children })` rendering `@medusajs/ui` `Tabs` with `Tabs.List` + one `Tabs.Content` per tab (children keyed by value: `Record<T, ReactNode>`), triggers get `TAP`.

- [ ] **Step 1: Test**

```ts
// apps/backend/src/admin/lib/__tests__/tabs.unit.spec.ts
import { parseTab } from "../tabs"

const TABS = ["collect", "delivery", "repairs", "trade"] as const

describe("parseTab", () => {
  it("accepts an allowed tab, ignores case and spaces", () => {
    expect(parseTab("delivery", TABS, "collect")).toBe("delivery")
    expect(parseTab(" Trade ", TABS, "collect")).toBe("trade")
  })
  it("falls back for unknown, empty and missing values", () => {
    expect(parseTab("orders", TABS, "collect")).toBe("collect")
    expect(parseTab("", TABS, "collect")).toBe("collect")
    expect(parseTab(null, TABS, "collect")).toBe("collect")
  })
})
```

- [ ] **Step 2: Run, expect FAIL (module missing).**
- [ ] **Step 3: Implement `tabs.ts`** (`parseTab` as specified; `useUrlTab` uses `useSearchParams` from `react-router-dom`, `setSearchParams(next, { replace: true })`) and `page-tabs.tsx`:

```tsx
import { Tabs } from "@medusajs/ui"
import type { ReactNode } from "react"
import { TAP } from "./shop-ui"

export function PageTabs<T extends string>({ tabs, value, onChange, children }: {
  tabs: { value: T; label: string }[]
  value: T
  onChange: (t: T) => void
  children: Record<T, ReactNode>
}) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as T)}>
      <Tabs.List className="flex-wrap">
        {tabs.map((t) => (
          <Tabs.Trigger key={t.value} value={t.value} className={`${TAP} px-4 text-base`}>
            {t.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {tabs.map((t) => (
        <Tabs.Content key={t.value} value={t.value} className="mt-4">
          {children[t.value]}
        </Tabs.Content>
      ))}
    </Tabs>
  )
}
```

- [ ] **Step 4: Run tests, expect PASS. Commit** — `feat(admin): url-driven page tabs`

---

### Task 3: Orders page — Collect, Repairs, Trade tabs from the existing pages

**Files:**
- Create: `apps/backend/src/admin/components/orders/collect-board.tsx` (body of `routes/click-collect/page.tsx` as `CollectBoard({ status?, embedded?, limit? })`: `embedded` hides the page heading and chips and shows only `status` (default `to_pick`), at most `limit` rows, and a "See all N" link to `/shop-orders?tab=collect`)
- Create: `apps/backend/src/admin/components/orders/repair-list.tsx` (`RepairList({ status?, embedded?, limit? })`) and `trade-list.tsx` (`TradeList({ status?, embedded?, limit? })`), from `routes/repair-bookings/page.tsx` and `routes/trade-applications/page.tsx`
- Create: `apps/backend/src/admin/routes/shop-orders/page.tsx` (label "Orders", icon `ShoppingBag`, `rank: 1`; tabs `collect | delivery | repairs | trade`; `delivery` renders a placeholder `Text` "Coming in Task 5" until Task 5 replaces it)
- Modify: `routes/click-collect/page.tsx`, `routes/repair-bookings/page.tsx`, `routes/trade-applications/page.tsx` → each becomes a redirect with **no `config` export** (so it leaves the sidebar): `const Page = () => <Navigate to="/shop-orders?tab=collect" replace />; export default Page`. The detail pages `repair-bookings/[id]/page.tsx` and `trade-applications/[id]/page.tsx` stay; their "Back" links change to the tab URL.
- Modify: `apps/backend/src/admin/lib/types.ts` only if a shared type moves.

**Interfaces:**
- Consumes: `useUrlTab`, `PageTabs` (Task 2); existing `FilterChips`, `Pager`, `ConfirmDialog`, `TAP` from `components/shop-ui.tsx`.
- Produces: `CollectBoard`, `RepairList`, `TradeList` with the props above, each exporting its query key prefix (`COLLECT_QUERY_KEY = ["click-collect"]`, etc.) so Today can invalidate.

- [ ] **Step 1: Move the Click & Collect page body** into `CollectBoard` without behaviour changes; the route file renders `<CollectBoard />` for one commit so `git diff -M` shows a move. Run `pnpm --filter @technest/backend lint` and open `/click-collect` in the browser: identical.
- [ ] **Step 2: Add `embedded`/`limit`/`status` props** (embedded: no `Heading`, no chips, `limit` via the query's `limit` param, "See all" link when `count > limit`).
- [ ] **Step 3: Same for Repairs and Trade** (`RepairList`, `TradeList`).
- [ ] **Step 4: Create `shop-orders/page.tsx`**:

```tsx
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ShoppingBag } from "@medusajs/icons"
import { Container, Heading, Text } from "@medusajs/ui"
import { PageTabs } from "../../components/page-tabs"
import { CollectBoard } from "../../components/orders/collect-board"
import { RepairList } from "../../components/orders/repair-list"
import { TradeList } from "../../components/orders/trade-list"
import { useUrlTab } from "../../lib/tabs"

const TABS = [
  { value: "collect", label: "Collect" },
  { value: "delivery", label: "Delivery" },
  { value: "repairs", label: "Repairs" },
  { value: "trade", label: "Trade" },
] as const
type Tab = (typeof TABS)[number]["value"]

const ShopOrdersPage = () => {
  const [tab, setTab] = useUrlTab<Tab>(TABS.map((t) => t.value), "collect")
  return (
    <div className="flex flex-col gap-4">
      <Container className="px-4 py-4 md:px-6">
        <Heading level="h1">Orders</Heading>
        <Text size="large" className="text-ui-fg-subtle">Collect, delivery, repairs and trade in one place.</Text>
      </Container>
      <PageTabs tabs={[...TABS]} value={tab} onChange={setTab}>
        {{ collect: <CollectBoard />, delivery: <Text>Coming soon.</Text>, repairs: <RepairList />, trade: <TradeList /> }}
      </PageTabs>
    </div>
  )
}

export const config = defineRouteConfig({ label: "Orders", icon: ShoppingBag, rank: 1 })
export default ShopOrdersPage
```

- [ ] **Step 5: Turn the three old list routes into redirects** (no `config`), fix the detail pages' back links, delete `rank` collisions. Browser check: sidebar shows Today + Orders (+ the not-yet-moved pages), `/click-collect` lands on the Collect tab, Mark ready still works, `/repair-bookings/:id` back link returns to `?tab=repairs`.
- [ ] **Step 6: Commit** — `feat(admin): Orders page with Collect, Repairs and Trade tabs`

---

### Task 4: Delivery orders backend — list and mark shipped

**Files:**
- Create: `apps/backend/src/lib/delivery/index.ts` (types, `DeliveryStatus = "to_pack" | "shipped"`, `DELIVERY_ORDER_FIELDS`, `toDeliveryOrder`), `apps/backend/src/lib/delivery/list.ts`
- Create: `apps/backend/src/workflows/mark-delivery-shipped.ts`, `apps/backend/src/workflows/steps/delivery/prepare-shipment.ts`
- Create: `apps/backend/src/api/admin/delivery-orders/middlewares.ts`, `.../delivery-orders/route.ts` (GET), `.../delivery-orders/[id]/shipped/route.ts` (POST)
- Modify: `apps/backend/src/api/admin/middlewares.ts` (register the validators, same pattern as `click-collect`)
- Create: `apps/backend/integration-tests/http/delivery-orders.spec.ts`
- Create: `docs/contracts/delivery-orders.md`

**Interfaces:**
- Produces: `GET /admin/delivery-orders?status=to_pack|shipped&limit=&offset=` → `{ orders: DeliveryOrder[], count, limit, offset }` with
  ```ts
  type DeliveryOrder = {
    id: string; display_id: number; created_at: string; email: string | null
    customer_name: string | null            // first + last from shipping address
    postcode: string | null; city: string | null
    items: { id: string; title: string; variant_title: string | null; quantity: number; thumbnail: string | null }[]
    total_pence: number                     // Math.round(order.total * 100)
    shipped_at: string | null               // newest fulfillment.shipped_at
    status: "to_pack" | "shipped"
  }
  ```
  and `POST /admin/delivery-orders/:id/shipped` → `{ order_id, fulfillment_id: string | null, already_shipped: boolean }`.
- Consumes: `pickupShippingMethodIds` (export it from `src/lib/click-collect/list.ts`), `createOrderFulfillmentWorkflow`, `createOrderShipmentWorkflow` from `@medusajs/medusa/core-flows`.

- [ ] **Step 1: Write the failing integration test**

```ts
// apps/backend/integration-tests/http/delivery-orders.spec.ts
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { seedTechNest } from "../../src/scripts/seed"
import { adminHeaders } from "../helpers/auth"
import { placeAuthorisedOrder, recordEvents, shippingOptionIdsByCode } from "../helpers/orders"
import { resetPaymentRecorder } from "../helpers/recording-payment-provider"

process.env.TECHNEST_TEST_PAYMENT_PROVIDER = "true"
jest.setTimeout(10 * 60 * 1000)

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let admin: { headers: Record<string, string> }
    let regionId: string
    let options: Record<string, string>
    let events: ReturnType<typeof recordEvents>

    beforeAll(async () => {
      const container = getContainer()
      const seeded = await seedTechNest(container)
      regionId = seeded.region.id
      options = await shippingOptionIdsByCode(container)
      admin = await adminHeaders(api, container)
      events = recordEvents(container, ["shipment.created"])
    })
    beforeEach(() => { resetPaymentRecorder(); events.clear() })

    const deliveryOrder = () =>
      placeAuthorisedOrder(getContainer(), { regionId, shippingOptionId: options["standard"], shippingAmount: 3.49 })
    const pickupOrder = () =>
      placeAuthorisedOrder(getContainer(), { regionId, shippingOptionId: options["click-collect"], shippingAmount: 0 })
    const list = (status: string) => api.get(`/admin/delivery-orders?status=${status}`, admin)
    const ship = (id: string) => api.post(`/admin/delivery-orders/${id}/shipped`, {}, admin).catch((e: any) => e.response)

    it("lists delivery orders to pack, oldest first, never pickup orders", async () => {
      const { order: a } = await deliveryOrder()
      const { order: b } = await deliveryOrder()
      const { order: pickup } = await pickupOrder()
      const { data } = await list("to_pack")
      const ids = data.orders.map((o: any) => o.id)
      expect(ids.indexOf(a.id)).toBeLessThan(ids.indexOf(b.id))
      expect(ids).not.toContain(pickup.id)
      const row = data.orders.find((o: any) => o.id === a.id)
      expect(row).toMatchObject({
        status: "to_pack", shipped_at: null, postcode: "SE16 1AA", customer_name: "Sam Smith",
        items: [{ title: "USB-C cable", quantity: 2 }],
      })
      expect(row.total_pence).toBe(Math.round((2 * 4.99 + 3.49) * 100))
    })

    it("marks an order shipped once: fulfilment + shipment, one email event, then a no-op", async () => {
      const { order } = await deliveryOrder()
      const first = await ship(order.id)
      expect(first.status).toBe(200)
      expect(first.data).toMatchObject({ order_id: order.id, already_shipped: false })
      expect(first.data.fulfillment_id).toEqual(expect.any(String))
      expect(events.names()).toEqual(["shipment.created"])

      const again = await ship(order.id)
      expect(again.status).toBe(200)
      expect(again.data).toMatchObject({ already_shipped: true, fulfillment_id: first.data.fulfillment_id })
      expect(events.names()).toEqual(["shipment.created"])

      const { data: shipped } = await list("shipped")
      expect(shipped.orders.map((o: any) => o.id)).toContain(order.id)
      const { data: toPack } = await list("to_pack")
      expect(toPack.orders.map((o: any) => o.id)).not.toContain(order.id)
    })

    it("refuses a pickup order and a cancelled order", async () => {
      const { order: pickup } = await pickupOrder()
      const res = await ship(pickup.id)
      expect(res.status).toBe(400)
      expect(res.data.message).toMatch(/Click & Collect/)
    })

    it("status is required and must be to_pack or shipped", async () => {
      const res = await api.get("/admin/delivery-orders?status=packed", admin).catch((e: any) => e.response)
      expect(res.status).toBe(400)
    })
  },
})
```

(Check `recordEvents` exposes `names()`; if it exposes `calls`, adapt the two assertions.) The shipping option code `standard` must match the seed (`shippingOptionIdsByCode` keys); check `src/scripts/seed` and use the real code.

- [ ] **Step 2: Run** `pnpm exec cross-env TEST_TYPE=integration:http NODE_OPTIONS=--experimental-vm-modules jest --silent --runInBand --forceExit integration-tests/http/delivery-orders.spec.ts` — expected FAIL with 404s.

- [ ] **Step 3: Implement the listing** (`src/lib/delivery/list.ts`):

```ts
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { pickupShippingMethodIds } from "../click-collect/list"
import { DELIVERY_ORDER_FIELDS, type DeliveryOrder, type DeliveryOrderRow, type DeliveryStatus, toDeliveryOrder } from "."

/**
 * Delivery orders (every non-pickup, non-cancelled order). "Shipped" is not a
 * database filter in 2.21 (fulfillment_status is computed), so the newest
 * SCAN_LIMIT orders are read and split here; a small shop never has more open
 * delivery orders than that, and the Shipped tab only needs the recent ones.
 */
const SCAN_LIMIT = 200

export async function listDeliveryOrders(
  container: MedusaContainer,
  { status, limit, offset }: { status: DeliveryStatus; limit: number; offset: number }
): Promise<{ orders: DeliveryOrder[]; count: number }> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const pickupMethods = await pickupShippingMethodIds(container)
  const { data } = await query.graph({
    entity: "order",
    fields: DELIVERY_ORDER_FIELDS,
    filters: { status: { $nin: ["canceled", "draft"] } },
    pagination: { take: SCAN_LIMIT, skip: 0, order: { created_at: "DESC" } },
  })
  const rows = (data as unknown as DeliveryOrderRow[])
    .filter((o) => !(o.shipping_methods ?? []).some((m) => pickupMethods.includes(m.id)))
    .map(toDeliveryOrder)
    .filter((o) => o.status === status)
  if (status === "to_pack") rows.reverse() // oldest first
  return { orders: rows.slice(offset, offset + limit), count: rows.length }
}
```

`toDeliveryOrder` sets `shipped_at` to the newest `fulfillments[].shipped_at` (null when none) and `status = shipped_at ? "shipped" : "to_pack"`; `total_pence = Math.round(Number(order.total) * 100)`; `customer_name` from `shipping_address.first_name/last_name`. `DELIVERY_ORDER_FIELDS` = `["id","display_id","created_at","email","total","shipping_address.*","items.id","items.title","items.variant_title","items.quantity","items.thumbnail","items.detail.fulfilled_quantity","shipping_methods.id","fulfillments.id","fulfillments.shipped_at","fulfillments.canceled_at"]`.

- [ ] **Step 4: Implement the workflow** (`mark-delivery-shipped.ts`): `prepareShipmentStep({ order_id })` loads the order with the fields above, throws `NOT_ALLOWED` "Order N is a Click & Collect order; use the Collect tab" when any shipping method id is a pickup method, `NOT_ALLOWED` when cancelled, returns `{ already_shipped, fulfillment_id, items }` where `items` are unfulfilled quantities (same arithmetic as `prepare-collection.ts`). Then:

```ts
when("ship-if-needed", { prepared }, ({ prepared }) => !prepared.already_shipped && prepared.items.length > 0).then(() => {
  const fulfillment = createOrderFulfillmentWorkflow.runAsStep({
    input: transform({ input, prepared }, ({ input, prepared }) => ({
      order_id: input.order_id, items: prepared.items, created_by: input.actor_id, no_notification: true,
    })),
  })
  createOrderShipmentWorkflow.runAsStep({
    input: transform({ input, prepared, fulfillment }, ({ input, prepared, fulfillment }) => ({
      order_id: input.order_id, fulfillment_id: fulfillment.id, items: prepared.items, created_by: input.actor_id,
      // The shipment is what the customer hears about ("on its way", order-dispatched-email).
      no_notification: false,
    })),
  })
})
```

Use `acquireLockStep`/`releaseLockStep` with key `technest-delivery:${order_id}` (timeout 10, ttl 60) like `mark-ready-for-collection.ts`. Return `{ order_id, fulfillment_id, already_shipped }`.

- [ ] **Step 5: Routes + validators** (`z.object({ status: z.enum(["to_pack","shipped"]), limit: z.coerce.number().int().min(1).max(50).default(20), offset: z.coerce.number().int().min(0).default(0) })`; POST body `z.object({}).strict()`; `actor_id: req.auth_context.actor_id`), register in `src/api/admin/middlewares.ts` next to the click-collect entries.
- [ ] **Step 6: Run the spec until PASS; run `test:unit` and lint.**
- [ ] **Step 7: Contract doc** `docs/contracts/delivery-orders.md` (shapes above, the "scan then split" note, the events). Post `[CONTRACT]` in TEAM_CHAT.
- [ ] **Step 8: Commit** — `feat(delivery): list delivery orders and mark them shipped`

---

### Task 5: Delivery tab UI

**Files:**
- Create: `apps/backend/src/admin/components/orders/delivery-list.tsx` (`DeliveryList({ status?, embedded?, limit? })`, `DELIVERY_QUERY_KEY = ["delivery-orders"]`)
- Create: `apps/backend/src/admin/lib/delivery.ts` (`DeliveryOrder` type copied from the contract, `deliverySummary(order): string` = `"2 × USB-C cable (1 m)"` joined with ", ", pure) + `__tests__/delivery.unit.spec.ts`
- Modify: `routes/shop-orders/page.tsx` (replace the placeholder)

- [ ] **Step 1: Unit test `deliverySummary`** (two items, variant title null → no brackets; quantity 1 → "1 × Case").
- [ ] **Step 2: Implement the list**, mirroring `CollectBoard`: `FilterChips` To pack / Shipped (hidden when `embedded`), rows as `Container` cards: `#display_id` + `timeAgo(created_at)` + `customer_name`, `deliverySummary`, `postcode` and `city`, `formatPence(total_pence)`, buttons: **Packed & shipped** (primary, `TAP`, only in `to_pack`; opens `ConfirmDialog` title "Mark #N as shipped?" body "The customer gets an 'on its way' email." → `POST /admin/delivery-orders/:id/shipped` via `sdk.client.fetch`, `onSuccess` invalidates `DELIVERY_QUERY_KEY` and shows `toast.success("#N is on its way")`), **Open order** (secondary, `Link` to `/orders/${id}`), and a `Text` "Refund: open the order". Shipped rows show "Shipped {timeAgo(shipped_at)}". Loading: `PageLoading`; empty: "Nothing to pack." / "Nothing shipped yet.".
- [ ] **Step 3: Wire the tab.** Browser check with a seeded delivery order (place one through the storefront or `placeAuthorisedOrder` in a script): it appears under To pack, shipping moves it to Shipped, Mailpit shows the dispatch email.
- [ ] **Step 4: Commit** — `feat(admin): Delivery tab — pack and ship from the Orders page`

---

### Task 6: Products page — Add (photo or typed) and Import tabs

**Files:**
- Create: `apps/backend/src/admin/components/products/add-product.tsx` (body of `routes/quick-add/page.tsx`), move `routes/quick-add/types.ts` → `components/products/add-product-types.ts`
- Create: `apps/backend/src/admin/components/products/import-products.tsx` (body of `routes/import/page.tsx`; move `template.ts`, `types.ts` beside it)
- Create: `apps/backend/src/admin/routes/shop-products/page.tsx` (label "Products", icon `Tag`, `rank: 2`; tabs `add | stock | import`; `stock` renders "Coming in Task 8" until Task 8)
- Modify: `routes/quick-add/page.tsx`, `routes/import/page.tsx` → redirects without `config` (`/shop-products?tab=add`, `?tab=import`)

- [ ] **Step 1: Move Quick add** into `AddProduct` unchanged (one commit, `git diff -M` shows the move).
- [ ] **Step 2: Two equal choices on the first screen.** In the `"photo"` step replace the current layout (camera first, small "Add without a photo" link) with two cards of the same size in a `grid grid-cols-1 sm:grid-cols-2 gap-3`:
  - **Take a photo** — `Camera` icon, hint "Point the phone at the product; we suggest the details." → existing file input / capture flow.
  - **Type it in** — `Pencil` icon, hint "Fill in the name, price and stock yourself." → `setStep("details")` with an empty form (this is the existing "Add without a photo" path).
  Keep `TAP`, `Text size="large"`; both are `<button type="button">` styled like the Today shortcut cards. The "done" screen's "Add another" returns to this screen.
- [ ] **Step 3: Move Import** into `ImportProducts` unchanged.
- [ ] **Step 4: `shop-products/page.tsx`** like `shop-orders` (heading "Products", subtitle "Add one, change a price or stock, or import many."), redirects for the old routes.
- [ ] **Step 5: Browser check:** both choices work end to end (typed product appears as a draft in Medusa Products; photo path unchanged); `/quick-add` and `/import` redirect.
- [ ] **Step 6: Commit** — `feat(admin): Products page — add by photo or by typing, import tab`

---

### Task 7: Price & stock backend

**Files:**
- Create: `apps/backend/src/workflows/update-variant-price-stock.ts`
- Create: `apps/backend/src/api/admin/products/[id]/variants/[variant_id]/price-stock/route.ts` (POST) + validator in `src/api/admin/products/[id]/variants/middlewares.ts` (register in `src/api/admin/middlewares.ts`)
- Create: `apps/backend/integration-tests/http/price-stock.spec.ts`
- Create: `docs/contracts/price-stock.md`

**Interfaces:**
- Produces: `POST /admin/products/:id/variants/:variant_id/price-stock` body `{ price_pence?: number (int ≥ 1), stock?: number (int 0..100000) }` (at least one; `.strict()`) → `{ variant_id, price_pence, stock }` (the values after the update). Errors: `invalid_data` for a bad body, `not_found` when the variant is not on that product, `invalid_data` "This product's stock is not tracked here" when the variant has no inventory item.
- Consumes: `setImportVariantPricesStep` (`src/workflows/steps/set-import-variant-prices.ts`), `batchInventoryItemLevelsWorkflow`, `loadDefaults` (`steps/build-product-import-plan.ts`) for `location_id`.

- [ ] **Step 1: Integration test**

```ts
// apps/backend/integration-tests/http/price-stock.spec.ts
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { seedTechNest } from "../../src/scripts/seed"
import { adminHeaders } from "../helpers/auth"

jest.setTimeout(10 * 60 * 1000)

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let admin: { headers: Record<string, string> }
    let productId: string
    let variantId: string

    beforeAll(async () => {
      const container = getContainer()
      await seedTechNest(container)
      admin = await adminHeaders(api, container)
      // A product with one variant, a GBP price and stock at the shop, through Quick add.
      const { data } = await api.post("/admin/quick-add", { title: "Test cable", price: "4.99", safety_marking: "none", sku: "TEST-CABLE", stock: 3 }, admin)
      productId = data.product.id
      variantId = data.product.variants[0].id
    })

    const url = () => `/admin/products/${productId}/variants/${variantId}/price-stock`
    const read = async () => {
      const query = getContainer().resolve(ContainerRegistrationKeys.QUERY)
      const { data } = await query.graph({
        entity: "product_variant",
        fields: ["id", "prices.amount", "prices.currency_code", "prices.price_list_id", "inventory_items.inventory.location_levels.stocked_quantity"],
        filters: { id: variantId },
      })
      return data[0] as any
    }

    it("updates price and stock together, in pence in and out, major units in Medusa", async () => {
      const { data } = await api.post(url(), { price_pence: 549, stock: 7 }, admin)
      expect(data).toEqual({ variant_id: variantId, price_pence: 549, stock: 7 })
      const v = await read()
      expect(v.prices.find((p: any) => p.currency_code === "gbp" && !p.price_list_id).amount).toBe(5.49)
      expect(v.inventory_items[0].inventory.location_levels[0].stocked_quantity).toBe(7)
    })

    it("updates one of the two and leaves the other alone", async () => {
      await api.post(url(), { stock: 2 }, admin)
      const v = await read()
      expect(v.prices.find((p: any) => p.currency_code === "gbp" && !p.price_list_id).amount).toBe(5.49)
      expect(v.inventory_items[0].inventory.location_levels[0].stocked_quantity).toBe(2)
    })

    it("refuses bad input and changes nothing", async () => {
      for (const body of [{}, { price_pence: 0 }, { price_pence: -1 }, { price_pence: 5.5 }, { price_pence: "5" }, { stock: -1 }, { stock: 1.5 }, { colour: "red" }]) {
        const res = await api.post(url(), body, admin).catch((e: any) => e.response)
        expect([res.status, body]).toEqual([400, body])
      }
      const v = await read()
      expect(v.prices.find((p: any) => p.currency_code === "gbp" && !p.price_list_id).amount).toBe(5.49)
    })

    it("404s a variant that is not on that product", async () => {
      const res = await api.post(`/admin/products/prod_nope/variants/${variantId}/price-stock`, { stock: 1 }, admin).catch((e: any) => e.response)
      expect(res.status).toBe(404)
    })
  },
})
```

Add a fifth test once the seed has a trade price list: create a price-list price for the variant through `sdk`/API, save a new `price_pence`, assert the price-list price is still there (review focus 4). If the seed has no price list, create one in the test with `POST /admin/price-lists`.

- [ ] **Step 2: Run → FAIL (404).**
- [ ] **Step 3: Workflow**

```ts
export const updateVariantPriceStockWorkflow = createWorkflow(
  "update-variant-price-stock",
  function (input: { product_id: string; variant_id: string; price_pence?: number; stock?: number }) {
    const variant = loadVariantForPriceStockStep(input) // throws not_found; returns { variant_id, inventory_item_id | null, gbp_price_id | null, location_id }
    when("price", { input }, ({ input }) => input.price_pence !== undefined).then(() => {
      const prices = transform({ input, variant }, ({ input, variant }) => [{
        variant_id: variant.variant_id,
        prices: [{ id: variant.gbp_price_id ?? undefined, currency_code: "gbp", amount: input.price_pence! / 100 }],
      }])
      setImportVariantPricesStep(prices)
    })
    when("stock", { input, variant }, ({ input, variant }) => input.stock !== undefined && !!variant.inventory_item_id).then(() => {
      const levels = transform({ input, variant }, ({ input, variant }) => ({
        create: variant.has_level ? [] : [{ inventory_item_id: variant.inventory_item_id!, location_id: variant.location_id, stocked_quantity: input.stock! }],
        update: variant.has_level ? [{ inventory_item_id: variant.inventory_item_id!, location_id: variant.location_id, stocked_quantity: input.stock! }] : [],
        delete: [] as string[],
      }))
      batchInventoryItemLevelsWorkflow.runAsStep({ input: levels })
    })
    const result = readVariantPriceStockStep({ variant_id: input.variant_id, location_id: variant.location_id })
    return new WorkflowResponse(result) // { variant_id, price_pence, stock }
  }
)
```

`amount: price_pence / 100` is the one boundary conversion (pence → major units); `readVariantPriceStockStep` converts back with `Math.round(amount * 100)`. The load step uses `loadDefaults(query)` for `location_id` and throws `INVALID_DATA` "This product's stock is not tracked here" when `stock` is given but there is no inventory item.

- [ ] **Step 4: Route + validator** (`z.object({ price_pence: z.number().int().min(1).optional(), stock: z.number().int().min(0).max(100000).optional() }).strict().refine((b) => b.price_pence !== undefined || b.stock !== undefined, "Give a price or a stock level")`).
- [ ] **Step 5: Run until PASS; lint; `test:unit`. Contract doc. Commit** — `feat(products): update one variant's price and stock from the admin`

---

### Task 8: Price & stock tab UI

**Files:**
- Create: `apps/backend/src/admin/components/products/price-stock.tsx` (`PriceStock({ draftsOnly? })`)
- Create: `apps/backend/src/admin/lib/price-stock.ts` (`variantRows(products): VariantRow[]` flattening `sdk.admin.product.list` results: `{ product_id, variant_id, product_title, variant_title, sku, thumbnail, status, price_pence: number | null, stock: number | null }` where `price_pence = Math.round(gbpPrice.amount * 100)` and `stock = variant.inventory_quantity ?? null`) + `__tests__/price-stock.unit.spec.ts`
- Modify: `routes/shop-products/page.tsx` (replace the placeholder; read `?drafts=1` to preset the chip)

- [ ] **Step 1: Unit test `variantRows`**: a product with two variants and prices in gbp + eur → two rows with the gbp price in pence; a variant without a gbp price → `price_pence: null`; `inventory_quantity` missing → `stock: null`.
- [ ] **Step 2: Implement.** Query: `sdk.admin.product.list({ q, limit: 20, fields: "id,title,status,thumbnail,*variants,*variants.prices,+variants.inventory_quantity", status: draftsOnly ? "draft" : undefined })`, `queryKey: ["price-stock", q, draftsOnly]`, `q` debounced with `useDebounced` (300 ms). Display query loads on mount (empty `q` lists the 20 newest). Row: `Thumb`, titles, SKU, `Badge` Draft/Published, two `Input`s (`inputMode="decimal"` for price prefilled with `penceToPoundsInput`, `inputMode="numeric"` for stock), **Save** (`TAP`, `isLoading` while pending, disabled until a value changed or invalid). Mutation: `POST /admin/products/:id/variants/:vid/price-stock` with `poundsInputToPence` (rejects bad input client-side with the field in error state and the message "Price must be a whole number of pence, like 4.99"); `onSuccess`: update the row from the response, `toast.success("Saved")`, invalidate `["price-stock"]`. "Open product" link to `/products/${product_id}`. Empty search: "No products match." Price input never shows `null` as `0`: it shows empty and the row says "No GBP price yet".
- [ ] **Step 3: Browser check** on a draft from Task 6: change price and stock, reload, values persist; Medusa product page shows the same.
- [ ] **Step 4: Commit** — `feat(admin): Price & stock tab`

---

### Task 9: Shop settings page

**Files:**
- Create: `apps/backend/src/admin/components/settings/thresholds.tsx` (body of `routes/settings/technest/page.tsx`), `components/settings/devices.tsx` (body of `routes/devices/page.tsx`; move `device-form.tsx` beside it)
- Create: `apps/backend/src/admin/routes/shop-settings/page.tsx` (label "Shop settings", icon `CogSixTooth`, `rank: 3`; tabs `thresholds` "Delivery & Klarna" | `devices` "Devices")
- Modify: `routes/settings/technest/page.tsx`, `routes/devices/page.tsx` → redirects without `config`

- [ ] **Step 1–3:** move, compose, redirect, as in Task 3. Browser check: both tabs work; `/settings/technest` redirects.
- [ ] **Step 4: Commit** — `feat(admin): Shop settings page with Delivery & Klarna and Devices tabs`

---

### Task 10: Today with the lists inside

**Files:**
- Modify: `apps/backend/src/admin/routes/today/page.tsx`, `components/today.tsx`, `lib/today.ts` + its test

- [ ] **Step 1: `lib/today.ts`:** add `deliveryToPack: number` to the counts, extend `todayTasks` with a "To pack" task (tone and wording like the others: "3 delivery orders to pack"), update `todaySummary`; extend the unit test (`today.unit.spec.ts`) with the new count in the existing cases.
- [ ] **Step 2: `useToday`:** add the sixth query `GET /admin/delivery-orders?status=to_pack&limit=1` for the count.
- [ ] **Step 3: Page:** replace the card grid with sections in the spec's order, each `section` = `Heading h2` + the embedded list (`<CollectBoard embedded status="to_pick" limit={5} />`, `<CollectBoard embedded status="ready" limit={5} />` filtered client-side to reminder-sent/over 3 days using the existing `reminder_sent_at`/`ready_at` fields, `<DeliveryList embedded status="to_pack" limit={5} />`, `<RepairList embedded status="new" limit={5} />`, `<TradeList embedded status="pending" limit={5} />`), rendered only when its count > 0; a Drafts card linking to `/shop-products?tab=stock&drafts=1`; then the three big links (Orders → `/shop-orders`, Products → `/shop-products`, Shop settings → `/shop-settings`). Keep the summary line, "Updated … Refreshes every minute." and Refresh (Refresh also invalidates `COLLECT_QUERY_KEY`, `DELIVERY_QUERY_KEY`, `REPAIR_QUERY_KEY`, `TRADE_QUERY_KEY`). "All done" state: `Text size="large"` "Nothing waiting. Enjoy the quiet." when every count is 0.
- [ ] **Step 4: Browser check** with one item in each queue; actions work from Today and the section disappears when empty.
- [ ] **Step 5: Commit** — `feat(admin): Today shows the queues with their buttons`

---

### Task 11: Guides, contracts, verification

**Files:**
- Modify: `docs/owner/tr/*.md`, `docs/owner/en/*.md`, `docs/owner/README.md` (menu names and paths: "Click & Collect" → "Orders → Collect", "Quick add" → "Products → Add", "Import products" → "Products → Import", "Repair bookings" → "Orders → Repairs", "Trade applications" → "Orders → Trade", "Devices" → "Shop settings → Devices", "Settings → Shop settings" → "Shop settings → Delivery & Klarna"; new short sections for "Delivery" (pack & ship) and "Price & stock")
- Modify: `CLAUDE.md` folder map line for `src/admin/` (routes: today, shop-orders, shop-products, shop-settings; components/{orders,products,settings}), `docs/ops/uptime-and-sentry.md` if it names pages
- Modify: `apps/storefront` nothing.

- [ ] **Step 1: Update the guides** (grep each old page name; keep the Turkish files in Turkish).
- [ ] **Step 2: Full local run:** `pnpm --filter @technest/backend lint`, `test:unit`, the four HTTP specs touched (`delivery-orders`, `price-stock`, `click-collect`, `quick-add`), `pnpm --filter @technest/backend build`.
- [ ] **Step 3: Browser walkthrough** (desktop and 390 px wide): sidebar = 4 items; `/app` → Today; each tab; each old URL redirects; each action once; screenshots saved to `../worktrees/screens/admin-four-pages/` for the lead.
- [ ] **Step 4: `/code-review`**, fix findings. Push the branch, wait for CI, `[MERGE-START]`, fast-forward `main`, push, `[MERGE-DONE]` with the contract notes.
