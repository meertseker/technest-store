# Tech Nest photo-worker: rembg (library) behind a tiny FastAPI server.
# Models baked in at build time: birefnet-general (default), isnet-general-use (fast fallback).
# Both MIT. rembg's own default model is never downloaded or used (see docs/adr/0003).
# Internal only: never publish port 7000 to the internet. Run with 2 CPUs / 4 GB.
FROM python:3.12-slim-bookworm

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
# Bake the two allowed models, and warm numba's JIT cache (pymatting) so the
# non-root runtime user doesn't need a writable site-packages.
RUN python bake_models.py \
 && chmod -R a+rX /opt/rembg-models \
 && mkdir -p /opt/numba-cache && python -c "import rembg" \
 && chown -R 10001 /opt/numba-cache

COPY server.py .

USER 10001

EXPOSE 7000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:7000/health', timeout=4).status == 200 else 1)"

# One process, one job at a time (the server also serialises jobs with a lock).
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "7000", "--workers", "1", "--no-server-header"]
