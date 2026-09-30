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
- Rows with errors are skipped; the rest are imported in one workflow run (all or nothing for those rows).
- Re-importing the same file changes nothing (idempotent upsert by SKU).

## Admin API

Both take `{ "csv": string }` (max 2,000,000 chars; body limit 5 MB).

`POST /admin/product-import/preview` -> `200 { "plan": ImportPlan }`. Writes nothing.

`POST /admin/product-import` -> `200 { "plan": ImportPlan, "created": number, "updated": number, "skipped": number }`.
The plan is rebuilt on the server (the client's preview is never trusted). A file-level error
(no `sku` column, duplicate column, no rows, > 2000 rows, broken quotes) -> `400 invalid_data`.

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
    input: object             // the parsed row
    resolved?: object         // internal ids the workflow writes (not for display)
  }[]
  summary: { rows: number; create: number; update: number; error: number; with_warnings: number; draft: number }
}
```
