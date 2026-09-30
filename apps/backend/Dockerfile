# syntax=docker/dockerfile:1.7
# Medusa backend. One image, two roles: set MEDUSA_WORKER_MODE=server or worker at runtime.
# Build from the repo root: docker build -f apps/backend/Dockerfile .

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    NEXT_TELEMETRY_DISABLED=1 \
    MEDUSA_DISABLE_TELEMETRY=true
RUN corepack enable && corepack prepare pnpm@10.11.1 --activate
WORKDIR /repo

FROM base AS build
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter "@technest/backend..."
# Build workspace dependencies (e.g. @technest/emails) before the backend.
RUN pnpm --filter "@technest/backend..." build
# Drop devDependencies but keep the lockfile-exact pnpm layout (relative symlinks),
# so the runtime keeps the same monorepo paths: /app/node_modules, /app/apps/backend/...
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    CI=true pnpm install --frozen-lockfile --prod --ignore-scripts --filter "@technest/backend..." \
 && mkdir -p packages

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=9000 \
    MEDUSA_DISABLE_TELEMETRY=true
RUN apt-get update \
 && apt-get install -y --no-install-recommends tini \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd -r -g 10001 medusa \
 && useradd -r -u 10001 -g medusa -m -d /home/medusa medusa
WORKDIR /app
COPY --from=build --chown=medusa:medusa /repo/node_modules ./node_modules
COPY --from=build --chown=medusa:medusa /repo/packages ./packages
COPY --from=build --chown=medusa:medusa /repo/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=build --chown=medusa:medusa /repo/apps/backend/.medusa/server ./apps/backend/.medusa/server
WORKDIR /app/apps/backend/.medusa/server
USER medusa
EXPOSE 9000
# `medusa start` answers GET /health in server and worker mode alike (Medusa 2.21).
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||9000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["/app/apps/backend/node_modules/.bin/medusa", "start"]
