# Script 7: Import products from a spreadsheet, and the product rules

- **Length:** about 5 minutes
- **You need:** a laptop (a spreadsheet is easier on a big screen), logged in to admin.technest.co.uk; Excel, Numbers or Google Sheets.
- **Where:** menu → **Import products** (address `/app/import`).
- **Status:** checked against the finished admin code on 2026-09-30. Steps marked ⚠ use Medusa's own screens.

This script also covers the rules every product follows: chargers need a safety mark, vapes are never
sold, £1 add-on items, the "3 for £2" offer and reorder levels.

---

### Scene 1 (0:00-0:40) Download the template

**Tap:** menu → **Import products** → **Download template**.

**You'll see:** a file `tech-nest-import-template.csv` with a header row and three examples: a case, a USB-C cable and a £1 phone grip.

**Say:** "One row is one product. The **sku** column, my stock code, is the key: a SKU we already have is updated, a new SKU becomes a new product."

### Scene 2 (0:40-1:45) Fill it in

**Tap:** open the file in your spreadsheet. Replace the examples with your products. Save as **CSV**.

**Say (the columns that matter):**
- "`title`, `price_gbp` in pounds with VAT, like 6.99, and `stock` in the shop."
- "`category`: the category name or its web name, like `cases` or `chargers-cables`."
- "`status`: `published` or `draft`. Empty means published."
- "`device_slugs`: the devices it fits, by web address name, separated by `;`, like `iphone-16;iphone-16-plus`."
- "`safety_marking`: `UKCA`, `CE` or `none`. Chargers and power products need UKCA or CE."
- "`is_addon_item`: `yes` for £1 add-ons."
- "`reorder_level`: when stock falls to this number, it's in the 08:00 low-stock email. Empty means 3."

### Scene 3 (1:45-2:45) Check before importing

**Tap:** **Choose CSV file** and pick your file.

**You'll see:** "Checking your file…", then "Check before importing: 12 new products, 3 updates, 1 row with problems, 2 drafts." and buttons **All**, **Problems**, **Warnings**. Each row shows a badge **New**, **Update** or **Problem**, and **Live** or **Draft**.

**Tap:** **Problems**. Read each message. Fix those rows in the spreadsheet, save, and **Choose another CSV file**.

**Say:** "Nothing changes until I press Import. Rows with problems are skipped; the others go in."

### Scene 4 (2:45-3:15) Import

**Tap:** **Import 15 products**.

**You'll see:** "Done. 12 products added, 3 products updated… See products".

**Say:** "Importing the same file twice changes nothing, so it's safe to try again."

### Scene 5 (3:15-4:00) Fix one thing on many products

**Say:** "To change only one thing, like the reorder level or the safety mark, I make a file with just `sku` and that column. Empty cells mean 'keep what's there'."

**Tap:** show a two-column file: `sku,reorder_level` with `TN-CBL-CC-1M,10`. Import it.

### Scene 6 (4:00-5:00) The product rules

**Say:**
- "**Chargers and power products** (Chargers & Cables, Power Banks, Gaming Charging) need UKCA or CE before they can be published. Without it the import saves them as a **Draft** with the warning 'Imported as a draft: chargers and power products need a safety marking…'. Check the box, set the mark, import again with `status` `published`."
- "**Vapes** are never sold online. A row that looks like a vape is a Problem and is not imported, even as a draft."
- "**£1 add-on items** (`is_addon_item` yes, in the £1 Deals category) can be in any basket, but a basket of only add-ons can't be delivered: the customer must add another item or choose Click & Collect."
- "**3 for £2**: any 3 items from the £1 Deals category, the third is free, up to 10 free items per basket. It's automatic, no code. It's under **Promotions** as `ADDONS-3-FOR-2`, where I can switch it off. ⚠ Keep £1 Deals and the add-on flag the same: the offer looks at the category, the delivery rule looks at the flag."

---

## What can go wrong

| You see | What it means / what to do |
|---|---|
| "The file has no "sku" column…" | Start from the template. Keep the header row. |
| "This file is too big. Split it into files of up to 2000 rows." | Split it. |
| "Safety marking "FCC" must be UKCA, CE or none." | Use one of those three words. |
| "… Remove this row." on a vape | Vapes are never sold online. Delete the row. |
| A warning on a product with several variants (sizes, colours) | Only its price and stock are updated. Change the rest on the product page. |
| Prices look 100 times too big | Type pounds (`6.99`), not pence (`699`). |
| Excel changes `1-deals` or model numbers into dates | Format the column as **Text** before typing, or use Google Sheets. |

## Rules to remember

- Match key is the **SKU**. Same SKU = update, new SKU = new product.
- Empty cell on an existing product = keep the current value.
- Chargers and power products: UKCA or CE, otherwise draft only. Vapes: never.
- £1 add-ons can't be a delivery order on their own. Click & Collect is fine.
