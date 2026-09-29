# E4 plan: in-house photo studio (photo-worker + photo module)

Status: DRAFT. Owner: E4.

## Goals
- Owner takes a phone photo and gets a clean white-background product image. Target: 15 s or less per photo on a CX43, and a full Quick Add in 60 s or less.
- Only the background changes. Nothing generative, no AI upscaling, and the original is always kept.
- The provider sits behind an interface (rembg today, swappable later).

## Licence guard (hard rule)
- rembg v2.0.85 **defaults to `bria-rmbg`** (non-commercial, gated). Its official Docker image bakes it in. So:
  - Build our own image, pinned to `rembg[cpu,cli]==2.0.85` on `python:3.11-slim`, and download **only** the named models: `rembg d birefnet-general isnet-general-use` (a bare `rembg d` downloads everything, bria included).
  - Every request sends `model=` explicitly. The Node client refuses to send without a model from an allow-list (`birefnet-general`, `birefnet-general-lite`, `isnet-general-use`).
  - CI step `licence-guard`: `git grep -nI -i -E 'bria|rmbg' -- . ':!docs/**'` fails the build on any match. After the image is built, also check `ls /models/models/` contains only the allowed models.

## photo-worker container
```Dockerfile
FROM python:3.11-slim
RUN pip install --no-cache-dir "rembg[cpu,cli]==2.0.85" \
 && useradd -r -u 10001 rembg
ENV REMBG_HOME=/models OMP_NUM_THREADS=2
RUN rembg d birefnet-general birefnet-general-lite isnet-general-use && chown -R rembg /models
USER rembg
EXPOSE 7000
HEALTHCHECK CMD python -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:7000/api')"
CMD ["rembg","s","--host","0.0.0.0","--port","7000","--no-ui","-t","1","-l","warning"]
```
- `-t 1` gives one inference at a time, and extra requests queue inside rembg. `--no-ui` turns off the Gradio UI (idle CPU).
- Compose: `cpus: 2`, `mem_limit: 4g`, internal network only (no `ports:`), `restart: unless-stopped`.
- There is no health endpoint, so the health check uses `GET /api` (Swagger docs).
- **Risk:** birefnet-general is 973 MB of weights, and ONNX at 1024² can peak at many GB. It **may not fit in 4 GB or 15 s on 2 vCPU**. Week-2 spike (below) decides the default model.

## Pipeline (Medusa workflow `process-product-photo`, runs in the worker)
1. `storeOriginalStep`: upload the untouched original through the File module (`originals/<uuid>.<ext>`), then record `ProductPhoto{ original_file_id, status: "processing" }`.
2. `validateInputStep`: read metadata with sharp. If the short side is under 1000px, fail with `PHOTO_TOO_SMALL`, and the UI says "Retake closer". Apply EXIF auto-rotate.
3. `removeBackgroundStep`: downscale to a 1600px long side (the model works at 1024² anyway; this saves upload and decode time), then `POST http://photo-worker:7000/api/remove` (multipart `file`, `model=<configured>`), with a 60 s timeout and 1 retry. The result is a PNG with alpha. **The alpha mask is applied to the ORIGINAL full-resolution pixels** (the mask is upscaled), so product pixels are never model output.
4. `composeStep` (sharp, deterministic):
   - trim to the alpha bounding box, then a 1:1 canvas where the product's longest side = 84% (8% padding each side)
   - exposure/white balance: `normalise({lower:1, upper:99})` on the product layer only, plus a mild gray-world WB gain clamped to ±8% per channel (global colour/levels only, no pixel synthesis)
   - soft shadow: a blurred (σ≈18) 25%-opacity black copy of the alpha, offset y+2%, composited under the product on #FFFFFF
   - resize to 2000×2000 (downscale only; if smaller, keep native size and never upscale), then output WebP q=85 and AVIF q=55
5. `saveResultStep`: upload the cleaned files and set `ProductPhoto.status = "ready"`. The cleaned image is added to the product **only on Approve** (the widget) or on Quick Add publish.
- Compensation: on failure, delete the uploaded derived files. The original is always kept.

## Module `productPhoto` (E4)
- `ProductPhoto`: id, product_id (nullable until publish), original_url, cleaned_webp_url, cleaned_avif_url, model, duration_ms, status (processing|ready|failed|approved|kept_original), error_code.
- Link: product ↔ product_photo.
- Interface: `BackgroundRemovalProvider.remove(buf, {model}) → Promise<Buffer /* RGBA PNG */>`, with the implementation `RembgHttpProvider` (env `PHOTO_WORKER_URL`, `PHOTO_MODEL`).

## Admin API (E4)
- `POST /admin/photos` (multipart) → `{ photo_id }` (202). The workflow runs async in the worker.
- `GET /admin/photos/:id` → status + URLs (the UI polls every 1 s).
- `POST /admin/photos/:id/approve | retry | keep-original`
- `POST /admin/quick-add/suggest { photo_id }` → Claude vision JSON: `{title, description, category_handle, tags[], is_add_on, safety_marking_hint}`. It returns 503 `{reason:"ai_unavailable"}` if `ANTHROPIC_API_KEY` is missing.
- `GET /admin/photos/capabilities` → `{ background_removal: bool, ai_suggest: bool }`, which the UI uses for graceful degradation.

## Week-2 spike: model and timing (numbers go in the chat)
- On a CX43 (or locally at `--cpus=2`): 10 real phone photos × {birefnet-general, birefnet-general-lite, isnet-general-use} × input {1024, 1600}. Record p50/p95 seconds and peak RSS (`docker stats`).
- Decision rule: pick the best-quality model with p95 ≤ 12 s (leaving 3 s for sharp and upload) and peak RSS ≤ 3.5 GB. If birefnet-general fails, check with the lead before raising the limits to 4 CPU / 6 GB, or fall back to lite, then to isnet. Report the quality trade-off with side-by-side images.

## Open questions
- Where the product-photo files live in dev: the local file provider (fine). In prod, R2 `originals/` should be private. Needs E1's file-provider config (private bucket vs public prefix).
