# Your daily routine and your first week

Shop hours: Mon-Sat 9am-8pm, Sun 11am-5pm. Shop emails go to **hello@technest.co.uk**.
The admin is at **admin.technest.co.uk**. On a phone, the menu button is at the top left.

Our pages in the menu: **Quick add**, **Click & Collect**, **Devices**, **Import products**,
**Trade applications**, **Repair bookings**. **Shop settings** is under **Settings**.

## Every day

### Morning (before opening)

1. **Read the low-stock email** (arrives around 08:00, subject "Low stock: … items to reorder").
   Each line shows the product, "3 left (min 3)". Items waiting on the Click & Collect shelf already
   count as gone. Reorder what you need. **No email means nothing is low.**
2. **Click & Collect board** (script 3). Open **To pick**, oldest first. Pack each order and tap
   **Mark ready**. The customer gets an email with their collection code.
3. **Delivery orders** (script 8). Check the "New order … Delivery" emails and **Orders**. Pack them,
   then mark them as shipped so the customer gets the "on its way" email.
4. **Repair bookings** → **To call back** (script 6). Anything from last night? Plan the calls.
5. **Trade applications** → **Waiting** (script 6). Approve or reject.

### During the day

- Click & Collect customer at the counter: **check the collection code**, hand over the bag, tap
  **Collected** → **Yes, collected**. The card is charged only at that moment.
- Call repair customers back. Add a note, tap **Booked in**. When finished, tap **Done**.
- New stock? **Quick add** (script 1) for one product, **Import products** (script 7) for many.
- Refund? Only from the order page in the admin (script 8). Never in Stripe.

### Evening (before closing)

1. Click & Collect board: anything left in **To pick**? Pack it. Anything in **Ready** with
   "Reminder sent"? It will be cancelled 7 days after Ready; you can call the customer.
   Put items from cancelled orders back on the shelf.
2. All delivery orders packed and marked shipped.
3. Every repair customer you called is out of **To call back**.

## First week after launch: checklist

**Day 1**
- [ ] Log in on your phone and on the shop laptop. Find every page listed at the top.
- [ ] Check emails arrive at hello@technest.co.uk: a new order, a new trade application, a new repair booking. If one is missing, tell the lead.
- [ ] Load stock that isn't online yet with **Import products** (script 7): download the template, fill it in, check the preview, fix the **Problems**, then **Import**.

**Day 2**
- [ ] Check the **Draft** rows from the import. Chargers and power products need UKCA or CE: check the box, set `safety_marking`, import again as `published`.
- [ ] Watch script 1. Add 5 new products with **Quick add** and publish them. Aim for about a minute each.

**Day 3**
- [ ] **Devices**: are the newest phones there, with model numbers under **Other names**?
- [ ] On your 20 best sellers, check **Fits these devices**.
- [ ] Use the **Product photo** box (script 2) on any best seller with a poor photo.

**Day 4**
- [ ] **Settings → Shop settings**: free Standard delivery from £20, Klarna from £30.
- [ ] Raise the reorder level on fast sellers (cables, chargers, screen protectors) with a small CSV import: `sku,reorder_level`.
- [ ] £1 add-ons: in the £1 Deals category **and** `is_addon_item` yes. Check **Promotions** → `ADDONS-3-FOR-2` is active.

**Day 5**
- [ ] Watch script 3. Handle every Click & Collect order on the board: To pick → Mark ready → check the code → Collected.
- [ ] Open one collected order under **Orders**: the payment should show as captured (paid).

**Day 6**
- [ ] Watch script 6. Clear **Trade applications → Waiting** and **Repair bookings → To call back**.
- [ ] Is the low-stock email useful? Too long or too short? Adjust reorder levels.

**Day 7**
- [ ] Any Click & Collect order in **Ready** with "Reminder sent"? Call the customer.
- [ ] Watch script 8. Do one test refund on a test order from the order page.
- [ ] Write down anything that was slow or confusing, and send it to the lead.

## Rules to remember

- Vapes are never sold online. Chargers and power products need UKCA or CE before publishing.
- Photos: only the background changes, and the original is always kept.
- Prices are in pounds and include VAT.
- £1 add-on items can't be a delivery order on their own. Click & Collect is fine.
- Click & Collect is charged at **Collected**; delivery is charged automatically.
- Refunds only from the admin, never from Stripe.
