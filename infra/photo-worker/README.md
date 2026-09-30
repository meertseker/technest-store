# photo-worker

Background removal for product photos. `rembg` (library, pinned) behind a small FastAPI server
(`server.py`). Owned by E4. Decision record: [docs/adr/0003-photo-pipeline.md](../../docs/adr/0003-photo-pipeline.md).
The backend side (provider, workflow, routes) is in `apps/backend/src/modules/photo` and
`apps/backend/src/workflows/process-product-photo.ts`; the admin API is in
[docs/contracts/photos.md](../../docs/contracts/photos.md).

- Models baked into the image: **`birefnet-general`** (default) and **`isnet-general-use`** (faster fallback).
  Both MIT. Nothing else can run: the server has an allow-list and rembg's own default model is never
  downloaded (`scripts/check-no-bria.sh` keeps its name out of the repo).
- **Internal only.** Never publish port 7000 on a public interface or route it through Caddy.
  In production compose: no `ports:`, only the backend's internal network.
- Resources: **2 CPUs / 4 GB**. One job at a time (single uvicorn worker + a lock); up to 4 requests queue,
  more get `503`.
- The container needs no internet access at runtime.

## HTTP contract

### `POST /remove`

`multipart/form-data`:

| field | required | notes |
|---|---|---|
| `file` | yes | JPEG / PNG / WebP (anything Pillow reads), max 30 MB, max 60 MP. EXIF orientation is applied. |
| `model` | no | `birefnet-general` (default) or `isnet-general-use`. The backend always sends it. |

Responses:

- `200 image/png`: RGBA cut-out, same size as the (EXIF-rotated) input. Headers: `X-Model`, `X-Inference-Ms`.
- `400 application/json` `{"detail": "..."}`: unknown model, empty or unreadable image.
- `413`: file too large. `503`: queue full, retry shortly.

The backend only uses the PNG's **alpha channel**; product pixels always come from the original photo.

### `GET /health`

`200 {"status": "ok", "default_model": "birefnet-general", "models": [...], "busy": false, "queued": 0}`

## Build and run

```bash
docker build -t technest/photo-worker infra/photo-worker          # ~1.2 GB, models included
docker run --rm --cpus=2 --memory=4g -p 127.0.0.1:7000:7000 technest/photo-worker
curl -s localhost:7000/health
curl -s -F file=@photo.jpg -F model=birefnet-general localhost:7000/remove -o cutout.png
```

Backend: set `PHOTO_WORKER_URL=http://localhost:7000` (dev) or `http://photo-worker:7000` (compose).
Unset = photo processing disabled, everything else works.

Env (all optional): `OMP_NUM_THREADS` (default 2, match the CPU limit), `PHOTO_WORKER_DEFAULT_MODEL`,
`PHOTO_WORKER_MAX_UPLOAD_BYTES`, `PHOTO_WORKER_MAX_QUEUE`.

Production compose sketch (the file itself is E4's `docker-compose.yml`, not part of this change):

```yaml
photo-worker:
  image: ghcr.io/<owner>/technest-photo-worker:<tag>
  restart: unless-stopped
  cpus: 2
  mem_limit: 4g
  environment: { OMP_NUM_THREADS: "2" }
  networks: [internal]          # no ports: - never exposed
```

## Benchmark

`bash infra/photo-worker/bench.sh <url> <model> <images...>` prints wall time and inference time per image.

MEASURED_TIMINGS_PLACEHOLDER
