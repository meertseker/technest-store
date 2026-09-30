# Script 5: Settings

- **Length:** about 5 minutes
- **You need:** your phone or laptop, logged in to admin.technest.co.uk; a test product; the website open on a second screen or tab to show the effect. Put every value back as it was at the end.
- **Status:** Draft written from the brief - verify every step against the final UI before recording.

---

### Scene 1 (0:00-0:30) What is on this page

**On screen:** sidebar, tap **Settings** (the Tech Nest settings page, not Medusa's own settings). Show the fields.

> ⚠ Verify against the final UI (page name and where it sits in the menu)

**Say:** "This page has the shop's money rules. The free-delivery amount, the Klarna minimum, and the reorder levels for the low-stock email. You don't need to change them often. But it's good to know where they are."

### Scene 2 (0:30-1:45) Free-delivery threshold

**On screen:** the **free-delivery threshold** field, showing £20.00. Change it to £25.00. Save. On the website, add a £10 item to the basket and show the bar: "£15.00 away from free delivery".

> ⚠ Verify against the final UI

**Say:** "First, free delivery. It starts at twenty pounds. When the basket reaches this amount, VAT included, Standard delivery becomes free. The basket shows a bar, like 'fifteen pounds away from free delivery'. That pushes people to add one more thing. Type the amount in pounds and save. The shop's delivery price changes straight away. Next-day delivery is never free. Click and Collect is always free."

### Scene 3 (1:45-2:45) Klarna minimum

**On screen:** the **Klarna minimum** field, showing £30.00. Show a basket under £30 (no Klarna at checkout) and one over £30 (Klarna shown).

> ⚠ Verify against the final UI

**Say:** "Next, Klarna. Klarna lets customers pay later or in parts. It only shows at checkout when the basket is thirty pounds or more. You can change that amount here. Keep it at thirty unless you have a good reason."

### Scene 4 (2:45-4:15) Reorder levels

**On screen:** the reorder level for a product, showing 3. Change it to 5 for a fast seller. Save.

> ⚠ Verify against the final UI (where reorder levels are edited: on this page, in the product's details, or both)

**Say:** "Now reorder levels. Every product has a reorder level. The normal level is three. Every morning at eight o'clock you get an email with the products that are running low, based on this number. For something that sells fast, like USB-C cables, set it higher, like five or ten. Then you get warned in time to reorder. For slow items, leave it at three. The level counts for each version of a product, like each colour or each model."

### Scene 5 (4:15-5:00) Save and check

**On screen:** put the free-delivery threshold back to £20.00. Save. Show the saved message. Reload to show the values stayed.

> ⚠ Verify against the final UI

**Say:** "Always save, and look for the message that says it's saved. Reload the page to check. If a number looks strange, like two thousand pounds instead of twenty, fix it straight away. Customers see these numbers."

---

## Common mistakes / if something goes wrong

- **Typed pence instead of pounds**: type 20 or 20.00 for twenty pounds, not 2000.
  > ⚠ Verify against the final UI (confirm the fields take pounds)
- **The value won't save**: amounts must be between £0 and £1,000. A reorder level must be a whole number, 0 or more.
- **Free delivery set to £0**: then Standard delivery is always free. Only do this on purpose.
- **Too many products in the low-stock email**: some reorder levels are too high. Lower them for slow items.
- **No low-stock email**: if nothing is low, no email is sent that day.

## Rules to remember

- All amounts are in pounds and include VAT.
- Free delivery is for Standard delivery only. Next-day is never free. Click & Collect is always free.
- Klarna only shows at or above the Klarna minimum (normally £30).
- The 08:00 low-stock email uses each product's reorder level (normally 3).
