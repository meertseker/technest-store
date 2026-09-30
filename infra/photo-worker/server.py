"""Tech Nest photo-worker: background removal over HTTP.

Internal only. One job at a time. Only the allow-listed MIT models can run and
the model is always chosen explicitly: rembg's own default model is never used.

POST /remove   multipart: file=<image>, model=<optional allowed model>
               -> 200 image/png (RGBA cut-out, same size as the EXIF-rotated input)
GET  /health   -> {"status": "ok", ...}
"""

import asyncio
import io
import logging
import os
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, Form, HTTPException, Response, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError
from rembg import new_session, remove

ALLOWED_MODELS = ("birefnet-general", "isnet-general-use")
DEFAULT_MODEL = os.environ.get("PHOTO_WORKER_DEFAULT_MODEL", "birefnet-general")
MAX_UPLOAD_BYTES = int(os.environ.get("PHOTO_WORKER_MAX_UPLOAD_BYTES", str(30 * 1024 * 1024)))
MAX_QUEUE = int(os.environ.get("PHOTO_WORKER_MAX_QUEUE", "4"))

if DEFAULT_MODEL not in ALLOWED_MODELS:
    raise SystemExit(f"PHOTO_WORKER_DEFAULT_MODEL must be one of {ALLOWED_MODELS}")

Image.MAX_IMAGE_PIXELS = 60_000_000
log = logging.getLogger("photo-worker")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

_sessions: dict = {}
_job_lock = asyncio.Lock()
_queued = 0


def _session(model: str):
    # Always pass the model name: new_session() without one uses rembg's default.
    if model not in _sessions:
        _sessions[model] = new_session(model)
    return _sessions[model]


@asynccontextmanager
async def lifespan(_app: FastAPI):
    started = time.perf_counter()
    _session(DEFAULT_MODEL)
    log.info("loaded %s in %.1fs", DEFAULT_MODEL, time.perf_counter() - started)
    yield


app = FastAPI(title="photo-worker", lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


def _cut_out(data: bytes, model: str) -> bytes:
    try:
        img = Image.open(io.BytesIO(data))
        img.load()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as e:
        raise HTTPException(status_code=400, detail=f"unreadable image: {e}")
    img = ImageOps.exif_transpose(img).convert("RGB")
    out = remove(img, session=_session(model))
    buf = io.BytesIO()
    out.save(buf, format="PNG", compress_level=1)
    return buf.getvalue()


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "default_model": DEFAULT_MODEL,
        "models": list(ALLOWED_MODELS),
        "busy": _job_lock.locked(),
        "queued": _queued,
    }


@app.post("/remove")
async def remove_background(file: UploadFile = File(...), model: str = Form(DEFAULT_MODEL)):
    global _queued
    if model not in ALLOWED_MODELS:
        raise HTTPException(status_code=400, detail=f"model must be one of {list(ALLOWED_MODELS)}")
    data = await file.read(MAX_UPLOAD_BYTES + 1)
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
            png = await asyncio.to_thread(_cut_out, data, model)
            elapsed_ms = int((time.perf_counter() - started) * 1000)
    finally:
        _queued -= 1

    log.info("removed background model=%s bytes_in=%d ms=%d", model, len(data), elapsed_ms)
    return Response(
        content=png,
        media_type="image/png",
        headers={"X-Model": model, "X-Inference-Ms": str(elapsed_ms)},
    )
