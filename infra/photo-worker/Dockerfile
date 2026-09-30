# Tech Nest photo-worker: rembg (library, pinned) behind a small FastAPI server (server.py).
# Models baked in at build time: birefnet-general (MIT, default) and isnet-general-use (fallback).
# rembg's own default model is never downloaded or used: bake_models.py fails the build if any
# other model ends up in the image, and the server only runs allow-listed models (docs/adr/0003).
# Internal only: never publish port 7000 to the internet.
# Resources: birefnet-general needs more than 4 GB (OOM-killed at 4 GB in the spike), so compose
# gives this container 2 CPUs / 6 GB. Fallback on a smaller box: PHOTO_MODEL=isnet-general-use
# (backend env) + PHOTO_WORKER_DEFAULT_MODEL=isnet-general-use here, which fits 4 GB.
FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    U2NET_HOME=/opt/rembg-models \
    NUMBA_CACHE_DIR=/opt/numba-cache \
    OMP_NUM_THREADS=2 \
    PHOTO_WORKER_DEFAULT_MODEL=birefnet-general

WORKDIR /app
RUN useradd --system --uid 10001 --no-create-home photo

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY bake_models.py .
# Bake exactly the two allowed models (and check nothing else is there), then warm numba's JIT
# cache (pymatting) so the non-root runtime user doesn't need a writable site-packages.
RUN python bake_models.py \
 && chmod -R a+rX /opt/rembg-models \
 && mkdir -p /opt/numba-cache && python -c "import rembg" \
 && chown -R 10001 /opt/numba-cache

COPY server.py .

USER 10001

EXPOSE 7000
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:7000/health', timeout=4).status == 200 else 1)"

# One process, one job at a time (the server also serialises jobs with a lock and a small queue).
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "7000", "--workers", "1", \
     "--limit-concurrency", "16", "--timeout-keep-alive", "5", "--no-server-header"]
