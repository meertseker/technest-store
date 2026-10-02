# photo-worker

Background removal for product photos. `rembg` (library, pinned) behind a small FastAPI server
(`server.py`). Owned by E4. Decision record: [docs/adr/0003-photo-pipeline.md](../../docs/adr/0003-photo-pipeline.md).
The backend side (provider, workflow, routes) is in `apps/backend/src/modules/photo` and
`apps/backend/src/workflows/process-product-photo.ts`; the admin API is in
[docs/contracts/photos.md](../../docs/contracts/photos.md).

- Models baked into the image: **`birefnet-general`** (default, required by the lead) and
  **`isnet-general-use`** (lighter fallback). Nothing else can run: the server has an allow-list, the
  build fails if any other model file is in the image, and rembg's own default model is never
  downloaded (`scripts/check-no-bria.sh`, run in CI, keeps its name out of the repo).
- **Internal only.** Never publish port 7000 on a public interface or route it through Caddy.
  In production compose: no `ports:`, only the backend's internal network.
- Resources: **2 CPUs / 6 GB** for `birefnet-general` (it was OOM-killed at 4 GB in the spike, see
  `docs/plans/2026-09-29-e4-photo-pipeline.md`). **Fallback** on a box that can't spare 6 GB:
  `PHOTO_MODEL=isnet-general-use` in the backend env (compose passes the same value to
  `PHOTO_WORKER_DEFAULT_MODEL`) and a 4 GB limit; isnet ran in 5-7 s at 2.1 GB peak.
- Bounded memory: one job at a time (single uvicorn worker + a lock), up to 4 requests queue (more get
  `503`), only one model loaded at a time (switching unloads the other), inputs downscaled to 2048 px
  before inference, request bodies capped while streaming.
- No SSRF surface: the server only accepts uploaded bytes and never fetches URLs. The models are baked
  in, so the container needs no internet access at runtime.

## HTTP contract

### `POST /remove`

`multipart/form-data`:

| field | required | notes |
|---|---|---|
| `file` | yes | JPEG, PNG or WebP (checked by decoding, not by the declared type), max 30 MB, max 60 MP. EXIF orientation is applied. |
| `model` | no | `birefnet-general` (default) or `isnet-general-use`. The backend always sends it. |

Responses:

- `200 image/png`: RGBA cut-out of the (EXIF-rotated) input, same aspect ratio, at most 2048 px on the
  longer side (the backend already sends 2048 px). Headers: `X-Model`, `X-Inference-Ms`.
- `400 application/json` `{"detail": "..."}`: unknown model, empty, unreadable or unsupported image, too many pixels.
- `413`: file too large. `503`: queue full, retry shortly.

The backend only uses the PNG's **alpha channel**; product pixels always come from the original photo.

### `GET /health`

`200 {"status": "ok", "default_model": "birefnet-general", "models": [...], "loaded": ["birefnet-general"], "busy": false, "queued": 0}`

Nothing else is served (no Swagger UI, no OpenAPI document).

## Build and run

```bash
docker build -t technest/photo-worker infra/photo-worker          # ~1.2 GB, models included
docker run --rm --cpus=2 --memory=6g -p 127.0.0.1:7000:7000 technest/photo-worker
curl -s localhost:7000/health
curl -s -F file=@photo.jpg -F model=birefnet-general localhost:7000/remove -o cutout.png
```

Backend: set `PHOTO_WORKER_URL=http://localhost:7000`. With it unset the backend uses fal.ai when
`FAL_KEY` is set; with neither, photo processing is disabled and everything else works.

Env (all optional): `OMP_NUM_THREADS` (default 2, match the CPU limit), `PHOTO_WORKER_DEFAULT_MODEL`
(the model preloaded at start), `PHOTO_WORKER_MAX_UPLOAD_BYTES` (30 MB), `PHOTO_WORKER_MAX_PIXELS` (60 MP),
`PHOTO_WORKER_MAX_SIDE` (2048), `PHOTO_WORKER_MAX_QUEUE` (4).

Production does not run this worker: since 2026-10-02 background removal is hosted on fal.ai
(`FAL_KEY`, ADR 0004). The worker stays for local use without a fal key; when `PHOTO_WORKER_URL` is
set, the backend uses it instead of fal.

## Tests

`server.py` is tested with rembg stubbed out (no models or onnxruntime needed):

```bash
pip install fastapi==0.128.0 python-multipart==0.0.21 "pillow>=12.1,<13" httpx
python -m unittest infra/photo-worker/test_server.py
```

The backend's tests never need this container: they use a fake HTTP worker
(`apps/backend/integration-tests/helpers/photo.ts`).

## Benchmark

`bash infra/photo-worker/bench.sh <url> <model> <images...>` prints wall time and inference time per image.

Measured so far (2026-09-29 spike, `rembg s` image, 2 CPU / 4 GB, see the plan): isnet-general-use
5-7 s per photo at 2.1 GB peak; birefnet-general OOM-killed at 4 GB. BiRefNet timings at 6 GB are still
to be measured on the production-sized box.
