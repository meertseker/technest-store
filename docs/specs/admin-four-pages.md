# Spec: the owner's admin in four pages

Decided by the lead on 2026-10-03 ("en az sayfaya indirmek istiyorum"). Replaces the eight custom
pages plus Medusa's own menu with four pages the shop owner uses every day.

## Menu

Exactly four entries, in this order: **Today**, **Orders**, **Products**, **Shop settings**.
Everything else in the sidebar is hidden (Medusa's Orders, Products, Inventory, Customers,
Promotions, Price Lists, Settings, and the "Extensions" heading if it is still shown). Hidden items
are not removed: their URLs still work (`/orders/:id` is still linked from our order rows; Medusa's
Settings is still where users and API keys live). Hiding is a stylesheet rule injected at admin
start-up; a Medusa upgrade can make items reappear, which is cosmetic, never a breakage.

Opening `/app`, `/app/orders` or `/app/login` still lands on Today (existing redirect).

## Pages

### Today (`/today`)

What needs doing now, with the buttons in the list, in this order:

1. **To pick** (Click & Collect, oldest first, up to 5): Mark ready.
2. **Ready, waiting** (Click & Collect ready > 3 days or reminder sent, up to 5): Collected.
3. **To pack** (delivery orders not yet shipped, oldest first, up to 5): Packed & shipped.
4. **To call back** (repair bookings `new`, up to 5): open booking.
5. **Waiting** (trade applications `pending`, up to 5): Approve / Reject.
6. **Drafts** (products in draft): link to Products → Price & stock filtered to drafts.

A section is not rendered when it is empty. Each section ends with "See all N" linking to the
matching Orders or Products tab. Below the sections: three big links, Orders, Products, Shop settings.
The one-line summary and the Refresh button stay. Rows are the same components the Orders tabs use,
so an action behaves identically in both places.

### Orders (`/shop-orders?tab=`)

Tabs, left to right: **Collect** (`collect`), **Delivery** (`delivery`), **Repairs** (`repairs`),
**Trade** (`trade`). The tab is in the URL so Today and the owner guides can link straight to one.
Default tab: `collect`.

- **Collect**: the existing Click & Collect board unchanged (To pick / Ready / Collected chips,
  Mark ready, Collected with its confirmation, collection code, link to the Medusa order page).
- **Delivery** (new): chips **To pack** / **Shipped**. A row shows order number, time ago, customer
  name, item lines (quantity × title), delivery postcode, total. Action **Packed & shipped**
  (confirmation dialog: "Mark #N as shipped? The customer gets an 'on its way' email."). Each row
  links to Medusa's order page for anything else (address, refund). Refunds stay on Medusa's order
  page; the row says "Refund: open the order".
- **Repairs**: the existing repair bookings list (chips, pager) and its detail page.
- **Trade**: the existing trade applications list and its detail page.

### Products (`/shop-products?tab=`)

Tabs: **Add** (`add`), **Price & stock** (`stock`), **Import** (`import`). Default `add`.

- **Add**: the existing Quick add flow, but the first screen offers two equal choices side by side:
  **Take a photo** (camera, AI suggestion) and **Type it in** (straight to the details form). The
  rest of the flow is unchanged; a product added by typing has no photo and is still a draft.
- **Price & stock** (new): a search box (title or SKU). Results list each variant: thumbnail, product
  title, variant title, SKU, **Price £** (input, VAT included), **In stock** (input, whole number),
  status badge (Draft/Published), **Save** per row. Save writes both values through one backend
  route and shows "Saved". A row links to Medusa's product page for anything else. Optional filter
  chip **Drafts only** (Today's Drafts link opens the tab with it on).
- **Import**: the existing CSV import unchanged.

### Shop settings (`/shop-settings?tab=`)

Tabs: **Delivery & Klarna** (`thresholds`), **Devices** (`devices`). Default `thresholds`.
Both are the existing pages' content unchanged.

## Rules

- All copy in plain English for the owner, same tone as the existing pages. No environment
  variable names in anything the owner sees (`ownerMessage` stays in use).
- Touch targets stay at least 44 px (`TAP`), as on the existing pages.
- Money: inputs in pounds, API payloads in integer pence (`*_pence`), Medusa prices written as-is in
  major units (3.49 = £3.49). Never multiply or divide Medusa prices by 100.
- Every new backend route and workflow has an HTTP integration test.
- No new npm dependencies.
- The old page URLs (`/click-collect`, `/quick-add`, `/repair-bookings`, `/trade-applications`,
  `/import`, `/devices`, `/settings/technest`) redirect to the new tab, so old bookmarks and the
  owner guides keep working; detail pages `/repair-bookings/:id` and `/trade-applications/:id` stay.
- Owner guides (`docs/owner/{en,tr}`) are updated to the new menu names and tabs.

## Out of scope

Redesigning Medusa's own pages (order detail, product detail); refunds outside Medusa's order page;
multi-variant product creation (stays in Medusa's product page); Turkish admin copy.
