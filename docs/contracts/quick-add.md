# Contract: Quick Add (admin)

Owner: E4 (backend + admin UI, branch `e4/quick-add`). Consumer: E4 admin UI (`src/admin/routes/quick-add`,
`src/admin/widgets/product-photo.tsx`). Status: **v1 (2026-09-30)**. Changes are posted as `[CONTRACT]`.

Staff photograph a product on a phone, Claude (vision) suggests the listing, staff check and edit it,
and the product is created as a **draft**. The photo then goes through the photo pipeline
(`docs/contracts/photos.md`: process -> approve). Publishing is a separate, explicit product update
(`POST /admin/products/:id { status: "published" }`), where the publish guard (vapes, UKCA/CE on
chargers and power products, ADR 0001) runs as for any other product.

All routes are admin routes (session or bearer token; `401` otherwise). From the admin UI use the JS SDK
(`sdk.client.fetch`, `sdk.admin.upload.create`). Errors use Medusa's shape `{ "type": string, "message": string }`;
`message` is an English sentence that is safe to show as-is.

## Flow

1. `sdk.admin.upload.create({ files: [photo] })` (Medusa's `POST /admin/uploads`) -> `file.id`. This file is
   the **original**: never modified, never deleted by Quick Add.
2. `POST /admin/quick-add/analyze { file_id }` -> suggestion (optional: skip if `GET /admin/quick-add/status`
   says AI is off, or on any AI error; the form works without it).
3. `POST /admin/quick-add { ...confirmed fields, photo_file_id }` -> draft product.
4. `POST /admin/photos/process { file_id: <original> }`, show original vs processed,
   then `POST /admin/products/:id/photos/approve`.

## `GET /admin/quick-add/status`

```json
{ "ai_enabled": true, "reason": null, "model": "claude-opus-5-5" }
{ "ai_enabled": false, "reason": "AI suggestions are switched off (ANTHROPIC_API_KEY is not set). You can still add products by hand.", "model": null }
```

## `POST /admin/quick-add/analyze`

Asks Claude for a draft listing. **Writes nothing.** Synchronous, typically 5-30 s: use a client timeout of
at least 150 s (server: 60 s per attempt, 1 retry).

Request `application/json`: `{ "file_id": "1727712345678-IMG_0042.jpg" }` (unknown keys: `400`).

The server reads the file (max 25 MB, max 50 megapixels, JPEG/PNG/WebP), EXIF-rotates and downsizes a copy to
1568 px (long edge) as JPEG for Claude. The original is not changed. The prompt includes the shop's
category handles and device slugs; Claude answers through structured outputs (JSON schema), and the server
then drops handles/slugs that don't exist, clips text and checks the price.

Response `200`:

```json
{
  "suggestion": {
    "is_product_photo": true,
    "title": "Anker 20W USB-C Wall Charger",
    "description": "Compact 20W USB-C wall charger with a UK plug.",
    "category": { "id": "pcat_01...", "handle": "chargers-cables", "name": "Chargers & Cables" },
    "product_type": "charger",
    "devices": [{ "id": "dev_01...", "slug": "iphone-16", "name": "Apple iPhone 16" }],
    "safety_marking": {
      "guess": "UKCA",
      "evidence": "UKCA mark printed on the side of the box",
      "confirmed": false,
      "required_to_publish": true
    },
    "suggested_price": { "amount": 14.99, "currency_code": "gbp", "is_suggestion": true },
    "attributes": { "connector_a": "USB-C", "connector_b": null, "wattage": 20, "cable_length_m": null },
    "confidence": "high",
    "notes": "Check the plug type.",
    "looks_like_vape": false,
    "warnings": []
  },
  "original": { "id": "1727712345678-IMG_0042.jpg", "url": "http://localhost:9004/static/1727712345678-IMG_0042.jpg" },
  "model": "claude-opus-5-5",
  "timings_ms": { "total": 8123 }
}
```

- `product_type`: one of `case, screen-protector, charger, cable, power-bank, wireless-charger, car-charger,
  adapter, earphones, headphones, speaker, controller, gaming-headset, gaming-accessory, keyboard-mouse, hub,
  memory-card, mount-holder, watch-strap, other`.
- `safety_marking.guess`: `UKCA | CE | none`, only a guess from what is visible. `confirmed` is always
  `false`: staff must check the label (see `safety_marking_confirmed` below). `required_to_publish` is true
  when the suggested category is a charger/power category.
- `suggested_price.amount`: **GBP major units incl. VAT** (14.99 = £14.99), a hint only; `null` when Claude
  has no basis or the value is implausible (<= 0 or > 5000). The UI must not pre-fill the price with it
  silently (current UI: a "Use £14.99" button).
- `warnings`: human-readable sentences (unknown category, charger without a mark, vape, no product found).

Errors:

| status | type | when |
|---|---|---|
| 400 | `invalid_data` | bad body, bad/unknown `file_id`, not an image, > 25 MB, > 50 MP |
| 401 | `unauthorized` | not an admin |
| 422 | `ai_refused` | Claude declined (after Anthropic's server-side fallback) |
| 429 | `too_many_requests` | per-admin-user limit (`QUICK_ADD_AI_LIMIT_PER_HOUR`, default 60/hour); `Retry-After` header |
| 502 | `ai_bad_response` | the answer was incomplete or didn't match the schema, or Claude couldn't read the image |
| 503 | `ai_unavailable` | no `ANTHROPIC_API_KEY`, key rejected, Anthropic busy/unreachable/5xx |
| 504 | `ai_timeout` | no answer within `QUICK_ADD_AI_TIMEOUT_MS` (default 60 s), after 1 retry |

On any AI error the UI keeps the form and lets staff type the details.

## `POST /admin/quick-add`

Creates the product **as a draft** (the request cannot set a status) in one workflow: product with one
variant (`Default`), GBP price, the default sales channel and shipping profile, product type, category,
product attributes (ADR 0001), device links, and a stock level at "Tech Nest – Southwark Park Rd".
Any failure rolls all of it back (a product type created by the run included).

Request `application/json` (unknown keys: `400`):

```json
{
  "title": "Anker 20W USB-C Wall Charger",
  "description": "Compact 20W USB-C wall charger.",
  "category_id": "pcat_01...",
  "product_type": "charger",
  "device_ids": ["dev_01..."],
  "price": 12.99,
  "sku": "ANK-20W",
  "stock": 5,
  "safety_marking": "UKCA",
  "safety_marking_confirmed": true,
  "attributes": { "connector_a": "USB-C", "connector_b": null, "wattage": 20, "cable_length_m": null, "is_addon_item": false },
  "photo_file_id": "1727712345678-IMG_0042.jpg",
  "ai_assisted": true
}
```

| field | rules |
|---|---|
| `title` | required, 1-120 chars. The handle is derived from it (`-2`, `-3`... if taken). |
| `price` | required, GBP **major units** incl. VAT, > 0, <= 5000, at most 2 decimals. Stored as-is (12.99). |
| `safety_marking` | required, `UKCA | CE | none`. |
| `safety_marking_confirmed` | must be `true` when `safety_marking` is `UKCA` or `CE` (staff checked the label). |
| `stock` | integer >= 0, default 1. |
| `sku` | optional, must not exist yet. |
| `category_id`, `device_ids`, `photo_file_id` | optional; must exist. |
| `product_type` | optional, one of the values above. |

Business rules (`400 invalid_data`): a title/description that looks like a vape is refused outright;
unconfirmed marking; unknown category/device/file; SKU in use. A charger with `safety_marking: "none"` **is**
accepted (as a draft); publishing it later fails with the guard's message.

Response `201`:

```json
{
  "product": {
    "id": "prod_01...",
    "title": "Anker 20W USB-C Wall Charger",
    "handle": "anker-20w-usb-c-wall-charger",
    "status": "draft",
    "type": { "value": "charger" },
    "categories": [{ "id": "pcat_01...", "handle": "chargers-cables" }],
    "variants": [{ "id": "variant_01...", "sku": "ANK-20W", "prices": [{ "amount": 12.99, "currency_code": "gbp" }] }],
    "product_attributes": { "safety_marking": "UKCA", "connector_a": "USB-C", "wattage": 20, "...": "..." },
    "metadata": {
      "quick_add": {
        "ai_assisted": true,
        "original_file_id": "1727712345678-IMG_0042.jpg",
        "original_url": "http://localhost:9004/static/1727712345678-IMG_0042.jpg"
      }
    }
  }
}
```

`metadata.quick_add.original_*` records the untouched original. The product image is only set by the photo
pipeline's approve route (which also records the original in `metadata.photo_originals`). The product
details widget (`product-photo`) offers Process/Approve for that original later.

## Security and privacy

- `ANTHROPIC_API_KEY` is read only on the server, never returned (status says only on/off), never logged;
  the SDK's logger is off. Photos are sent to Anthropic only from `analyze`; nothing else is.
- Model: `claude-opus-5-5`, structured outputs, `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`)
  so a false-positive safety refusal is retried on Anthropic's recommended fallback model.

## Environment

| variable | default | meaning |
|---|---|---|
| `ANTHROPIC_API_KEY` | empty | Claude API key. Empty = Quick Add without AI suggestions. |
| `QUICK_ADD_AI_LIMIT_PER_HOUR` | 60 | photo analyses per admin user per hour (in-memory, per server process). |
| `QUICK_ADD_AI_TIMEOUT_MS` | 60000 | timeout per Claude attempt. |
