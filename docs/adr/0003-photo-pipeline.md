# ADR 0003: In-house photo pipeline - provider interface and model choice

- Status: accepted (E4)
- Date: 2026-09-30
- Deciders: E4 (owner), human lead (fixed decisions: no Photoroom, no remove.bg, in-house worker)

## Context

Product photos are taken on a phone in the shop. They need a clean, consistent look (white background,
square, same padding) without sending photos to a third-party SaaS and without ever altering the product
itself: only the background may change, and the original must be kept.

## Decision

1. **Background removal runs in our own `photo-worker` container** (`infra/photo-worker/`): the `rembg`
   Python library behind a ~100-line FastAPI server. Internal network only, 2 CPUs / 4 GB, one job at a time.
2. **Model: `birefnet-general`** (BiRefNet, MIT) baked into the image; **`isnet-general-use`** (IS-Net / DIS,
   MIT) baked in as a faster fallback. The server has an allow-list of exactly these two and every request
   names the model explicitly.
3. **Never rembg's default model.** rembg 2.0.8x defaults to BRIA's RMBG model, whose licence does not allow
   commercial use without a separate agreement. It is never downloaded into the image, the server refuses any
   model outside the allow-list, and `scripts/check-no-bria.sh` (tested by `scripts/check-no-bria.test.sh`)
   fails CI if its name appears anywhere in the repo.
4. **Provider interface in a custom Medusa module `photo`** (`apps/backend/src/modules/photo`):

   ```ts
   interface BackgroundRemovalProvider {
     readonly id: string
     readonly defaultModel: PhotoModel | null
     status(): Promise<{ enabled: boolean; reason: string | null }>
     removeBackground(image: Buffer, options?: { model?: PhotoModel }): Promise<{ png: Buffer; model: PhotoModel }>
   }
   ```

   - `RembgHttpProvider` when `PHOTO_WORKER_URL` is set.
   - `DisabledProvider` when it is not: status explains why, processing returns `400 not_allowed`,
     the rest of the backend boots and works normally.
5. **Only the provider's alpha channel is used.** The rendered product pixels always come from the original
   photo. A provider (today's or a future one) therefore cannot alter, "enhance" or generate product pixels.
6. **Everything else is deterministic `sharp`** (`apps/backend/src/lib/photo/render.ts`): conservative global
   per-channel gains (white balance from the removed backdrop, each channel within +/-8%; exposure
   brighten-only, at most +15%), crop to the mask's bounding box, 1:1 canvas with 8% padding, soft blurred
   drop shadow, `#FFFFFF` background, 2000 x 2000 px, WebP (q90) + AVIF (q60). Resampling is Lanczos.
   No generative fill, no AI upscaling, no local retouching.
7. Inputs whose shorter side (after EXIF rotation) is under 1000 px are rejected:
   "Photo too small, please retake closer".
8. The workflow `process-product-photo` stores the original first (File Module), then renders and stores the
   results; compensation deletes files it created. Attaching to a product is a separate, explicit
   `approve-product-photo` workflow (processed image first + thumbnail; original recorded in
   `product.metadata.photo_originals`).

## Why

- BiRefNet-general gives the best edges on hard-edged products (cases, cables, chargers) among the MIT
  models rembg ships; IS-Net is roughly half the cost and good enough when the worker is slow.
- The interface keeps the workflow independent of rembg: a GPU box or another MIT model is a new class.
- A thin server of our own (instead of `rembg s`) lets us enforce the allow-list and one-job-at-a-time,
  and removes the risk of a caller omitting `model` and silently getting the default.

## Consequences

- CPU inference: see the measured timings in `infra/photo-worker/README.md`.
- Image is large (models ~1 GB). Built by CI, pulled to the box; never exposed publicly.
- Upgrading rembg: re-check the default model and the allow-list, rebuild, re-run the benchmark.
