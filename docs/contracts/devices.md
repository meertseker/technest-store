# Contract: devices and device compatibility

Owner: E1. Consumers: E3 (device picker, device-filtered listings, "fits" on product page), E4 (admin).
Status: **draft v1 (2026-09-29)**. Build against the mocks below. Any change is posted as `[CONTRACT]`.

All store routes need the `x-publishable-api-key` header (use the SDK: `sdk.client.fetch`).
All admin routes need an admin session or token (use the admin SDK `sdk.client.fetch`).
Errors use Medusa's standard shape: `{ "type": "not_found" | "invalid_data" | ..., "message": string }`.

## Types

```ts
type DeviceType = "phone" | "tablet" | "console" | "laptop"

type Device = {
  id: string              // "dev_01J..."
  brand: string           // "Apple"
  series: string          // "iPhone 16"   (grouping level under brand)
  model: string           // "iPhone 16 Pro"
  slug: string            // "iphone-16-pro"  unique, lowercase kebab-case
  aliases: string[]       // ["16 pro", "a3102"]  extra search terms, incl. model numbers
  type: DeviceType
  release_year: number | null
  image_url: string | null
}

// A device as seen from a product (the link carries an optional note)
type LinkedDevice = Device & { note: string | null }   // note e.g. "Not compatible with MagSafe"
```

## Store API (E3)

### `GET /store/devices`

Query: `q?` (string; case-insensitive match on `model`, `slug` and every `aliases` entry,
substring match), `type?` (`DeviceType`, may repeat: `type=phone&type=tablet`).

Response `200`: devices grouped brand -> series -> model.

```json
{
  "brands": [
    {
      "brand": "Apple",
      "series": [
        {
          "series": "iPhone 16",
          "devices": [
            { "id": "dev_01", "brand": "Apple", "series": "iPhone 16", "model": "iPhone 16 Pro Max",
              "slug": "iphone-16-pro-max", "aliases": ["16 pro max", "a3084"], "type": "phone",
              "release_year": 2024, "image_url": null },
            { "id": "dev_02", "brand": "Apple", "series": "iPhone 16", "model": "iPhone 16",
              "slug": "iphone-16", "aliases": ["16", "a3081"], "type": "phone",
              "release_year": 2024, "image_url": null }
          ]
        }
      ]
    },
    { "brand": "Sony", "series": [ { "series": "PlayStation", "devices": [ /* PS5, PS4 */ ] } ] }
  ],
  "count": 3
}
```

Ordering: brands in the fixed order Apple, Samsung, Google, Sony, Microsoft, Nintendo, then any others
A-Z. Series by newest `release_year` first. Devices within a series by `release_year` desc, then `model` A-Z.
`count` is the number of devices across all groups. Empty result: `{ "brands": [], "count": 0 }`.
No pagination: the full catalogue is about 60–150 devices. Cache on the storefront (revalidate 1h).

### `GET /store/devices/:slug`

Response `200`: `{ "device": Device, "product_count": number }` (`product_count` counts published products).
`404` `{ "type": "not_found", "message": "Device iphone-99 was not found" }`.

### `GET /store/devices/:slug/products`

Lists products compatible with a device. We **cannot** use `GET /store/products?device_id=`
(Medusa's strict validator rejects unknown query params before custom middleware runs), so this is a
dedicated route with the **same response shape as `GET /store/products`**.

Query:
- `region_id` (string, recommended; without it there's no `calculated_price`)
- `limit` (default 24, max 100), `offset` (default 0)
- `category_id?` (string or repeated), limits results to these categories (children are **not** auto-included; pass them)
- `order?` one of `title`, `-title`, `created_at`, `-created_at` (default `-created_at`)
- `fields?` same syntax as `/store/products` (e.g. `*variants.calculated_price,+metadata`)

Response `200`:

```json
{
  "products": [ /* StoreProduct, exactly as /store/products returns them */ ],
  "count": 12, "offset": 0, "limit": 24,
  "notes": { "prod_01...": "Fits with a slim case only" }
}
```

`notes` maps a product id to that link's note. Products without a note are left out.
Only published products in the key's sales channel are returned. Unknown slug -> `404`.

### `GET /store/products/:id/devices`

For the product page's "Fits:" list. Response `200`: `{ "devices": LinkedDevice[] }`, sorted like `GET /store/devices`
(flattened). Unknown or unpublished product -> `404`.

## Admin API (E4)

### `GET /admin/devices`
Query: `q?`, `type?`, `brand?`, `limit` (default 50), `offset`, `order?` (`model`, `-release_year`, ...).
Response: `{ "devices": Device[], "count": number, "offset": number, "limit": number }`.

### `POST /admin/devices`
Body:
```json
{ "brand": "Apple", "series": "iPhone 16", "model": "iPhone 16 Pro", "type": "phone",
  "slug": "iphone-16-pro", "aliases": ["16 pro"], "release_year": 2024, "image_url": null }
```
`slug` is optional: when it's missing it's generated from `model` (for example "Galaxy S24 Ultra" -> `galaxy-s24-ultra`).
`aliases`, `release_year` and `image_url` are optional. A duplicate slug returns `400 invalid_data`.
Response `200`: `{ "device": Device }`.

### `GET /admin/devices/:id`
Response: `{ "device": Device & { "products": { "id": string, "title": string, "thumbnail": string | null, "note": string | null }[] } }`.

### `POST /admin/devices/:id`
Partial update, same fields as create. Response: `{ "device": Device }`.

### `DELETE /admin/devices/:id`
Removes the device and its product links. Response: `{ "id": "dev_01", "object": "device", "deleted": true }`.

### `GET /admin/products/:id/devices`
Response: `{ "devices": LinkedDevice[] }`.

### `POST /admin/products/:id/devices`
Links or unlinks devices on a product. Both lists are optional. Adding an existing link updates its note.
```json
{ "add": [ { "device_id": "dev_01", "note": null }, { "device_id": "dev_02", "note": "Slim case only" } ],
  "remove": ["dev_03"] }
```
Response: `{ "devices": LinkedDevice[] }` (the product's full list after the change).

## Events

None in v1.
