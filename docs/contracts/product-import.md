# Contract: product CSV import

Owner: E4b (E4 area). Consumers: the "Import products" admin page (`src/admin/routes/import`), owner docs.
Status: **v1 (2026-09-30)**.

## Why not Medusa's built-in import

Medusa's product import (`importProductsWorkflow`, `/admin/products/imports`) expects Medusa's own export
format (one row per variant with `Product Id`, `Variant Option 1 Name`, ... columns), runs as a background
job without a per-row preview, and knows nothing about our device links, product attributes (ADR 0001),
stock at our location or the publish guard. We reuse Medusa's core workflows instead
(`createProductsWorkflow`, `updateProductsWorkflow`, `batchInventoryItemLevelsWorkflow`) inside our own
`technest-import-products` workflow, so the product hooks (the publish guard) and compensation still apply.
Prices of existing variants are written by our own step (`set-import-variant-prices`), not
`updateProductVariantsWorkflow`: in 2.21 its price-set compensation deletes the variant's prices when a
later step fails. Our step restores them exactly and emits `product-variant.updated`.

## CSV format

One row = one product with one variant, matched by `sku` (the owner's stock code). Header names are
case-insensitive; `Price (GBP)`, `price`, `qty`, `quantity`, `devices`, `add-on` are accepted aliases.
Comma, semicolon or tab separated; UTF-8 (a BOM is fine). At most 2000 rows per file.

| column | new SKU | existing SKU | format |
|---|---|---|---|
| `sku` | required | required (the match key) | text, unique in the file |
| `title` | required | blank = keep | text |
| `handle` | blank = made from the title | blank = keep | `lowercase-with-dashes`, unique |
| `description` | optional | blank = keep | text |
| `category` | optional | blank = keep, filled = replaces the categories | category handle or name |
| `price_gbp` | required | blank = keep | pounds, VAT included, max 2 decimals (`3.49`, `£3.49`). Stored as-is (3.49) |
| `status` | blank = `published` | blank = keep | `published` / `draft` |
| `stock` | blank = 0 | blank = keep | whole number, at "Tech Nest – Southwark Park Rd" |
| `reorder_level` | blank = 3 | blank = keep | whole number |
| `device_slugs` | optional | blank = keep, filled = replaces the list (existing notes kept) | slugs separated by `;` |
| `connector_a`, `connector_b` | optional | blank = keep | text |
| `wattage`, `cable_length_m` | optional | blank = keep | number |
| `platform` | optional | blank = keep | `ps5;pc` (ADR 0001 values) |
| `is_addon_item` | blank = no | blank = keep | yes/no |
| `safety_marking` | blank = none | blank = keep | `UKCA` / `CE` / `none` |
| `warranty_months` | optional | blank = keep | whole number |

Rules:
- **Vapes** (title/handle look like a vape) are row errors, even as drafts.
- **Chargers and power products** (Chargers & Cables, Power Banks, Gaming > Charging and children) without
  UKCA/CE are imported as **drafts with a warning** instead of published.
- An existing SKU on a product with **several variants** only gets its price and stock updated (warning).
- An existing SKU whose product is a **draft** stays a draft when the `status` column is blank, with a warning
  (`existing_draft_kept: true`, counted in `summary.existing_drafts_kept`). This is what the leftovers of an
  interrupted import look like: put `published` in the column to make them live (the safety guard still applies).
- Rows with errors are skipped; the rest are imported in chunks of 200 rows, each its own workflow run
  (all or nothing within a chunk). If a later chunk fails, the chunks before it stay imported and the
  error says so (`N rows (lines a to b) were imported before a problem stopped the import ...`); importing
  the same file again finishes the job.
- Re-importing the same file changes nothing (idempotent upsert by SKU).
- A 2000-row file takes two minutes or more server-side, longer than the proxy lets a request run, so the
  admin page sends it in **parts** of 200 data rows (`part: 0, 1, ...`), one request each (about 15 s each).
  If the page reports a network error or a timeout, the import may still be running: check the product
  list before importing again (re-importing is safe).

## Admin API

Both take `{ "csv": string }` (max 2,000,000 chars; body limit 5 MB).

`POST /admin/product-import/preview` -> `200 { "plan": ImportPlan }`. Writes nothing.

`POST /admin/product-import` takes `{ "csv": string, "part"?: number }` ->
`200 { "plan": ImportPlan, "created": number, "updated": number, "skipped": number,
"chunks": { "rows": number, "lines": { "from": number, "to": number }, "created": number, "updated": number }[],
"part"?: { "index": number, "count": number, "lines": { "from": number, "to": number } } }`.

With `part` (0-based; what the admin page sends): the plan is built from the whole file, then only data rows
`part*200` to `part*200+199` (by position in the file) are written, in one workflow run; `created`/`updated`/
`skipped` count that part only, `plan` holds that part's rows only (with their own summary; the page puts the
parts together) and `part.count` says how many parts the file has. Full details (prices, stock, attributes) are
loaded for the part's SKUs only, so a part takes about as long whatever the size of the file or the catalogue. Send part 0 first, then the
rest in order. A part past the end -> `400 invalid_data` ("This file has N parts; there is no part M."). A part
that fails rolls back on its own; earlier parts stay written. Without `part`, the whole file is written in
one request as below.
The plan is rebuilt on the server (the client's preview is never trusted), then written in chunks of 200
rows (one `chunks` entry each). A file-level error (no `sku` column, duplicate column, no rows, > 2000 rows,
broken quotes) -> `400 invalid_data`. A chunk that fails after earlier chunks were written -> the error of
the failing chunk (usually `400 invalid_data`) with a message that names the lines already imported.

```ts
type ImportPlan = {
  file_errors: string[]       // non-empty => nothing can be imported
  file_warnings: string[]     // e.g. ignored columns
  rows: {
    line: number              // line in the file (header = 1)
    sku: string
    title: string
    action: "create" | "update" | "error"
    status: "draft" | "published" | null   // status after the import; null for error rows
    errors: string[]          // plain-English, owner-facing
    warnings: string[]
    existing_draft_kept: boolean  // existing draft + blank status column: stays a draft
    input: object             // the parsed row
    resolved?: object         // internal ids the workflow writes (not for display)
  }[]
  summary: { rows: number; create: number; update: number; error: number; with_warnings: number; draft: number;
             existing_drafts_kept: number }
}
```
