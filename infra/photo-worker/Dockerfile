# photo-worker: rembg HTTP server with permissively licensed models only.
# rembg's DEFAULT model (Bria RMBG) needs a paid licence for commercial use: never install or
# call it. Every request must send model=... explicitly (see the backend's rembg provider),
# and CI fails if that model's id appears anywhere in the repo.
FROM python:3.11-slim
ARG REMBG_VERSION=2.0.85
# birefnet-general (MIT) is the default; isnet-general-use (Apache-2.0) is the faster fallback.
ARG MODELS="birefnet-general isnet-general-use"
RUN pip install --no-cache-dir "rembg[cpu,cli]==${REMBG_VERSION}" \
 && useradd -r -u 10001 -m rembg
ENV REMBG_HOME=/models \
    OMP_NUM_THREADS=2
# Download only the named models (a bare `rembg d` downloads all of them), then check that
# nothing else ended up in the image.
RUN rembg d ${MODELS} \
 && test "$(ls /models/models | sort | xargs)" = "$(printf '%s\n' ${MODELS} | sort | xargs)" \
 && chown -R rembg /models
USER rembg
EXPOSE 7000
# rembg has no health route; /api is the Swagger UI.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD python -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:7000/api',timeout=4)"
# -t 1: one inference at a time (extra requests queue). --no-ui: no Gradio UI.
CMD ["rembg", "s", "--host", "0.0.0.0", "--port", "7000", "--no-ui", "-t", "1", "-l", "warning"]
