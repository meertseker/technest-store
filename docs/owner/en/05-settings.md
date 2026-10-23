# Script 5: Shop settings (free delivery and Klarna)

- **Length:** about 3 minutes
- **You need:** your phone or laptop, logged in to admin.technestlondon.co.uk; the website open in a second tab to show the effect. Put every value back as it was at the end.
- **Where:** menu → **Shop settings** → **Delivery & Klarna** tab (address `/app/shop-settings?tab=thresholds`; the old `/app/settings/technest` address still lands there).
- **Status:** checked against the admin code on 2026-10-11 (menu: Today, Orders, Products, Shop settings, each with tabs). Shop settings is one of our four menu pages now, not inside Medusa's Settings menu.

---

### Scene 1 (0:00-0:30) What is on this page

**Tap:** menu → **Shop settings**. The **Delivery & Klarna** tab is open.

**You'll see:** "Delivery & Klarna", "The basket amounts for free delivery and for Klarna. Amounts include VAT.", an **Edit** button, and two rows:
- **Free Standard delivery from** £20.00
- **Klarna from** £30.00

**Say:** "Two money rules for the shop. I don't need to change them often, but this is where they are."

### Scene 2 (0:30-1:30) Free delivery

**Tap:** **Edit**. In **Free Standard delivery from (£)** type `25`. Tap **Save**.

**You'll see:** "Settings saved", and the row now shows £25.00.

**Tap:** on the website, put a £10 item in the basket: the bar says "£15.00 away from free delivery".

**Say:** "When the basket reaches this amount, VAT included, Standard delivery costs nothing. Next-day is never free. Click & Collect is always free. The change is live straight away."

### Scene 3 (1:30-2:15) Klarna

**Say:** "Klarna lets customers pay later or in parts. It only shows at checkout when the basket is at least this amount. Keep it at thirty pounds unless you have a reason."

### Scene 4 (2:15-3:00) Put it back

**Tap:** **Edit** → type `20` → **Save**. Reload the page: £20.00 stays.

**Say:** "Type pounds, like 20 or 20.00. If a number looks strange, fix it straight away: customers see it."

---

## What can go wrong

| You see | What it means / what to do |
|---|---|
| "Enter an amount between £0.00 and £1,000.00, e.g. 20.00" | Type pounds, not pence, and at most £1,000. |
| "Couldn't save the settings" | Try again. If it stays, tell the lead. |
| Free delivery set to £0 | Then Standard delivery is always free. Only do this on purpose. |

## Where are the reorder levels?

The low-stock email (08:00 every morning) uses each product's **reorder level** (normally 3). Change it on
the product page, box "Product details for Tech Nest" → Edit → "Reorder level", or for many products at once
with a CSV import, column `reorder_level` (script 7).

## Rules to remember

- All amounts are in pounds and include VAT.
- Free delivery is for Standard delivery only. Next-day is never free. Click & Collect is always free.
- Klarna only shows at or above the Klarna amount (normally £30).
