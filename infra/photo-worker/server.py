"""Tech Nest photo-worker: background removal over HTTP.

Internal only. One job at a time. Only the allow-listed MIT models can run and
the model is always chosen explicitly: rembg's own default model is never used.

POST /remove   multipart: file=<image bytes>, model=<optional allowed model>
               -> 200 image/png (RGBA cut-out of the EXIF-rotated input; same aspect
                  ratio, downscaled to at most PHOTO_WORKER_MAX_SIDE on the longer side)
GET  /health   -> {"status": "ok", ...}

Safety limits:
- The server never fetches anything: it only accepts uploaded bytes (no URLs, so no SSRF),
  and the models are baked into the image (no downloads at runtime).
- Request bodies are capped while streaming (413), images are checked for type
  (JPEG/PNG/WebP), pixel count (decompression bombs) and downscaled before inference.
- One inference at a time, a short queue (503 when full), and only one model kept in
  memory: switching model unloads the other one first.
"""

import asyncio
import gc
import io
import logging
import os
import time
import warnings
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, Form, HTTPException, Response, UploadFile
from fastapi.responses import JSONResponse
from PIL import Image, ImageOps, UnidentifiedImageError
from rembg import new_session, remove

ALLOWED_MODELS = ("birefnet-general", "isnet-general-use")
# Pillow format names. MPO is what iPhone "JPEG"s with depth data open as.
ALLOWED_FORMATS = ("JPEG", "MPO", "PNG", "WEBP")
DEFAULT_MODEL = os.environ.get("PHOTO_WORKER_DEFAULT_MODEL", "birefnet-general")
MAX_UPLOAD_BYTES = int(os.environ.get("PHOTO_WORKER_MAX_UPLOAD_BYTES", str(30 * 1024 * 1024)))
MAX_PIXELS = int(os.environ.get("PHOTO_WORKER_MAX_PIXELS", "60000000"))
MAX_SIDE = int(os.environ.get("PHOTO_WORKER_MAX_SIDE", "2048"))
MAX_QUEUE = int(os.environ.get("PHOTO_WORKER_MAX_QUEUE", "4"))
# Multipart overhead allowance on top of the file itself (boundaries, the model field).
BODY_OVERHEAD_BYTES = 64 * 1024

if DEFAULT_MODEL not in ALLOWED_MODELS:
    raise SystemExit(f"PHOTO_WORKER_DEFAULT_MODEL must be one of {ALLOWED_MODELS}")

# Pillow only warns between 1x and 2x this limit; make that an error too.
Image.MAX_IMAGE_PIXELS = MAX_PIXELS
warnings.simplefilter("error", Image.DecompressionBombWarning)

log = logging.getLogger("photo-worker")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

_sessions: dict = {}
_job_lock = asyncio.Lock()
_queued = 0


def _session(model: str):
    """The session for `model`, unloading any other model first (bounded memory).

    Always passes the model name: new_session() without one uses rembg's default.
    """
    if model not in ALLOWED_MODELS:
        raise ValueError(f"model not allowed: {model}")
    if model not in _sessions:
        if _sessions:
            _sessions.clear()
            gc.collect()
        _sessions[model] = new_session(model)
    return _sessions[model]


@asynccontextmanager
async def lifespan(_app: FastAPI):
    started = time.perf_counter()
    _session(DEFAULT_MODEL)
    log.info("loaded %s in %.1fs", DEFAULT_MODEL, time.perf_counter() - started)
    yield


app = FastAPI(title="photo-worker", lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


class BodyLimit:
    """Rejects request bodies over the limit before they are parsed or spooled.

    Checks Content-Length up front and also counts streamed bytes, so a chunked
    request without a length can't get past it either.
    """

    def __init__(self, inner, limit: int):
        self.inner = inner
        self.limit = limit

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.inner(scope, receive, send)

        for key, value in scope.get("headers", []):
            if key == b"content-length":
                try:
                    too_big = int(value) > self.limit
                except ValueError:
                    too_big = True
                if too_big:
                    return await self._reject(scope, receive, send)

        seen = 0

        async def limited_receive():
            nonlocal seen
            message = await receive()
            if message["type"] == "http.request":
                seen += len(message.get("body", b""))
                if seen > self.limit:
                    # Raised inside body parsing; FastAPI re-raises HTTPExceptions as they are.
                    raise HTTPException(status_code=413, detail="file too large")
            return message

        await self.inner(scope, limited_receive, send)

    @staticmethod
    async def _reject(scope, receive, send):
        await JSONResponse({"detail": "file too large"}, status_code=413)(scope, receive, send)


app.add_middleware(BodyLimit, limit=MAX_UPLOAD_BYTES + BODY_OVERHEAD_BYTES)


def _open_image(data: bytes) -> Image.Image:
    try:
        img = Image.open(io.BytesIO(data))
        if img.format not in ALLOWED_FORMATS:
            raise HTTPException(status_code=400, detail="unsupported image type (use JPEG, PNG or WebP)")
        if img.width * img.height > MAX_PIXELS:
            raise HTTPException(status_code=400, detail="image has too many pixels")
        img.load()
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError,
            Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise HTTPException(status_code=400, detail="unreadable image")
    return img


def _cut_out(data: bytes, model: str) -> tuple[bytes, tuple[int, int]]:
    img = _open_image(data)
    img = ImageOps.exif_transpose(img).convert("RGB")
    # The model runs at ~1024 px anyway; anything above MAX_SIDE only costs memory.
    img.thumbnail((MAX_SIDE, MAX_SIDE), Image.Resampling.LANCZOS)
    out = remove(img, session=_session(model))
    buf = io.BytesIO()
    out.save(buf, format="PNG", compress_level=1)
    return buf.getvalue(), out.size


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "default_model": DEFAULT_MODEL,
        "models": list(ALLOWED_MODELS),
        "loaded": list(_sessions),
        "busy": _job_lock.locked(),
        "queued": _queued,
    }


@app.post("/remove")
async def remove_background(file: UploadFile = File(...), model: str = Form(DEFAULT_MODEL)):
    global _queued
    if model not in ALLOWED_MODELS:
        raise HTTPException(status_code=400, detail=f"model must be one of {list(ALLOWED_MODELS)}")
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    await file.close()
    if not data:
        raise HTTPException(status_code=400, detail="empty file")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="file too large")
    if _queued >= MAX_QUEUE:
        raise HTTPException(status_code=503, detail="busy, try again shortly")

    _queued += 1
    try:
        async with _job_lock:
            started = time.perf_counter()
            png, size = await asyncio.to_thread(_cut_out, data, model)
            elapsed_ms = int((time.perf_counter() - started) * 1000)
    finally:
        _queued -= 1

    # No file names or image content in logs.
    log.info("removed background model=%s bytes_in=%d size=%dx%d ms=%d", model, len(data), *size, elapsed_ms)
    return Response(
        content=png,
        media_type="image/png",
        headers={"X-Model": model, "X-Inference-Ms": str(elapsed_ms)},
    )
