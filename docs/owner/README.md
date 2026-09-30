# Tech Nest Online: owner guides

These guides are for the shop owner. They show how to run the online shop from the admin at
**admin.technest.co.uk**, on a phone or a laptop.

On a phone, open the menu with the button at the top left. The Tech Nest pages are in that
left-hand menu (the sidebar). The admin is in English, so the guides use the exact English button names.

A Turkish copy of every file is in [`tr/`](./tr/README.md).

## What is in this folder

| File | What it is | Menu |
|---|---|---|
| [en/01-quick-add.md](./en/01-quick-add.md) | A product from a phone photo, with AI suggestions, saved as a draft | Quick add |
| [en/02-photo-widget.md](./en/02-photo-widget.md) | The "Product photo" box: Process, Approve, Discard | Products → a product |
| [en/03-click-and-collect.md](./en/03-click-and-collect.md) | The board: To pick, Mark ready, Collected (takes payment); day-3 reminder, day-7 cancel | Click & Collect |
| [en/04-devices.md](./en/04-devices.md) | The Devices page, and "Fits these devices" on a product | Devices |
| [en/05-settings.md](./en/05-settings.md) | Free Standard delivery and Klarna amounts | Settings → Shop settings |
| [en/06-trade-and-repairs.md](./en/06-trade-and-repairs.md) | Trade applications and repair bookings | Trade applications, Repair bookings |
| [en/07-import-and-product-rules.md](./en/07-import-and-product-rules.md) | CSV import; safety marks, vapes, £1 add-ons, 3 for £2, reorder levels | Import products |
| [en/08-orders-and-refunds.md](./en/08-orders-and-refunds.md) | Delivery orders, cancelling, refunds (admin only, never Stripe) | Orders |
| [en/first-week-routine.md](./en/first-week-routine.md) | One page: your daily routine, and a checklist for the first week | |

## How to use the scripts

Files 01 to 08 are **screen-recording scripts**. Each one makes a video of 3 to 5 minutes.

1. Open the admin on the device you will use every day (usually your phone).
2. Start a screen recording.
3. Follow the scenes in order. **Tap** says what to press, **You'll see** what appears, **Say** what to say out loud.
4. Use a **test product** or a **test order**, never a real customer's order.
5. Keep the video. Watch it again when you forget a step.

Each script ends with **What can go wrong** (the exact message and what to do) and **Rules to remember**.
You can also just read a script as a how-to guide.

## Checked against the code, and what is still open

All scripts were checked against the finished admin pages on 2026-09-30 (button names, messages, order
of steps). Two kinds of marks are left:

- **⚠** : the step uses one of Medusa's own screens (Orders, Products edit, Promotions, Customers, Pricing,
  the Settings menu). Before recording, the lead opens that screen once and checks the button name.
  Then delete the mark.
- **[LEAD?]** : a decision or a missing piece the lead must answer. Don't record that part until it's answered.

### For the lead before recording

- All emails named in the scripts are on `main`.
- Safety marking, the £1 add-on flag and the reorder level of an existing product are edited in the
  "Product details for Tech Nest" box on the product page (also after Quick add). Script 7's CSV import
  still works for many products at once.
- Trade tier prices are entered in Medusa's **Trade** price list, VAT included in pounds. Who enters them? [LEAD?]

## Words used in these guides

- **SKU**: your stock code for a product (for example `TN-CASE-IP16-CLR`).
- **Draft**: a product that is saved but not shown on the website yet.
- **Publish**: make a product visible on the website.
- **Add-on item**: a £1 item. It can go in any basket, but a basket of only add-ons can't be delivered. Click & Collect is fine.
- **Collection code**: 6 letters and numbers (like `K7MQ2X`) the customer shows at the counter.
