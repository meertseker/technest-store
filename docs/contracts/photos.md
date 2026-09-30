# Contract: product photo pipeline (admin)

Owner: E4 (backend, branch `e4/photo-pipeline`). Consumer: E4 admin UI (`apps/backend/src/admin/**`).
Status: **draft v1 (2026-09-30)**. Build against the shapes below. Any change is posted as `[CONTRACT]`.

All routes are admin routes: they need an admin session or bearer token. From the admin UI use
`sdk.client.fetch(...)` (never plain `fetch`). Errors use Medusa's standard shape:
`{ "type": "invalid_data" | "not_allowed" | "not_found" | "unexpected_state", "message": string }`.

What the pipeline does (see ADR 0003): keep the original untouched, ask the in-house `photo-worker`
for a cut-out mask, then with `sharp`: global exposure / white-balance correction (clamped, small),
auto-crop to 1:1 with 8% padding, soft shadow, pure white `#FFFFFF` background, 2000 x 2000 px,
WebP (primary) + AVIF. Only the background changes; nothing is generated, nothing is AI-upscaled.

## Types

```ts
type PhotoModel = "birefnet-general" | "isnet-general-use"   // default "birefnet-general"; isnet is the faster fallback

type StoredFile = {
  id: string          // File Module id (the file key), e.g. "1727712345678-photo.jpg"
  url: string         // public URL (local: http://localhost:900N/static/..., prod: R2 URL)
}

type ProcessedFile = StoredFile & {
  format: "webp" | "avif"
  width: 2000
  height: 2000
}
```

## `GET /admin/photos/status`

Lets the UI enable or disable the photo buttons and explain why. Cheap: pings the worker's
`/health` with a 2 s timeout. Poll it when the photo screen opens; don't poll in a loop.

Response `200`:

```json
{ "enabled": true, "reason": null, "provider": "rembg-http", "default_model": "birefnet-general" }
```

```json
{ "enabled": false, "reason": "Photo processing is switched off (PHOTO_WORKER_URL is not set).", "provider": "disabled", "default_model": null }
```

```json
{ "enabled": false, "reason": "The photo worker is not responding. Try again in a minute.", "provider": "rembg-http", "default_model": "birefnet-general" }
```

`reason` is a human-readable English sentence, safe to show as-is. `null` when `enabled` is true.

## `POST /admin/photos/process`

Processes one photo. Synchronous: typically 5-15 s. **Use a client timeout of at least 90 s**
and show a busy state. The worker handles one job at a time; concurrent requests queue.

Two request forms:

1. `multipart/form-data` (upload straight from the phone camera)
   - `file` (required): one image, `image/jpeg`, `image/png` or `image/webp`, max 25 MB
   - `model` (optional): `PhotoModel`
2. `application/json` (the image was already uploaded with Medusa's `POST /admin/uploads`)

   ```json
   { "file_id": "1727712345678-photo.jpg", "model": "isnet-general-use" }
   ```

   `file_id` is required, `model` optional. Unknown keys are rejected (`400 invalid_data`).
   In this form the uploaded file *is* the original and is never deleted by the pipeline.

Rules:

- The shorter side (after EXIF rotation) must be at least **1000 px**, otherwise
  `400 invalid_data` with the exact message `"Photo too small, please retake closer"`.
- If the worker finds no product: `400 invalid_data`, `"No product found in the photo, please retake it against a plain background"`.
- On any failure after the original was uploaded in form 1, everything this request stored is deleted again
  (workflow compensation). Form 2 never deletes the caller's file.

Response `200`:

```json
{
  "original": { "id": "1727712345678-IMG_0042.jpg", "url": "http://localhost:9004/static/1727712345678-IMG_0042.jpg" },
  "processed": { "id": "1727712349999-IMG_0042-processed.webp", "url": "http://localhost:9004/static/1727712349999-IMG_0042-processed.webp",
                 "format": "webp", "width": 2000, "height": 2000 },
  "processed_avif": { "id": "1727712349999-IMG_0042-processed.avif", "url": "http://localhost:9004/static/1727712349999-IMG_0042-processed.avif",
                      "format": "avif", "width": 2000, "height": 2000 },
  "model": "birefnet-general",
  "timings_ms": { "remove_background": 7421, "render": 1310, "total": 9102 }
}
```

Errors:

| status | type | when |
|---|---|---|
| 400 | `invalid_data` | no file / bad JSON / unsupported type / too small / no product found / unknown `file_id` |
| 400 | `not_allowed` | photo processing is disabled (`GET /admin/photos/status` says why) |
| 401 | `unauthorized` | not logged in as admin |
| 500 | `unexpected_state` | the worker failed, timed out (120 s) or is unreachable; message says which |

Processing does **not** touch the product. Show the processed image next to the original and let the
user approve it (below) or discard it (nothing to call; unapproved files are left in storage for now).

## `POST /admin/products/:id/photos/approve`

Makes the processed image the product's main image and thumbnail. Keeps the original: it stays in file
storage and is recorded in `product.metadata.photo_originals`. Existing product images are kept, after the new one.

Request `application/json`:

```json
{
  "processed_file_id": "1727712349999-IMG_0042-processed.webp",
  "original_file_id": "1727712345678-IMG_0042.jpg",
  "processed_avif_file_id": "1727712349999-IMG_0042-processed.avif",
  "set_thumbnail": true
}
```

`processed_file_id` and `original_file_id` required; `processed_avif_file_id` optional; `set_thumbnail`
optional, default `true`. Approving the same processed file twice does not add a duplicate image.

Response `200`:

```json
{
  "product": {
    "id": "prod_01J...",
    "thumbnail": "http://localhost:9004/static/1727712349999-IMG_0042-processed.webp",
    "images": [
      { "id": "img_01J...", "url": "http://localhost:9004/static/1727712349999-IMG_0042-processed.webp" },
      { "id": "img_01H...", "url": "https://.../older-image.jpg" }
    ],
    "metadata": {
      "photo_originals": [
        {
          "processed_file_id": "1727712349999-IMG_0042-processed.webp",
          "processed_url": "http://localhost:9004/static/1727712349999-IMG_0042-processed.webp",
          "processed_avif_url": "http://localhost:9004/static/1727712349999-IMG_0042-processed.avif",
          "original_file_id": "1727712345678-IMG_0042.jpg",
          "original_url": "http://localhost:9004/static/1727712345678-IMG_0042.jpg"
        }
      ]
    }
  }
}
```

Other `metadata` keys on the product are preserved.

Errors: `404 not_found` (unknown product), `400 invalid_data` (validation, or a file id that doesn't exist).
