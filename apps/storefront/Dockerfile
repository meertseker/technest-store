# syntax=docker/dockerfile:1.7
# Next.js storefront (standalone output). Build from the repo root:
#   docker build -f apps/storefront/Dockerfile --build-arg NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=pk_... .
# NEXT_PUBLIC_* values are inlined at build time, so staging and production get separate images.

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_OUTPUT=standalone
RUN corepack enable && corepack prepare pnpm@10.11.1 --activate
WORKDIR /repo

FROM base AS build
ARG NEXT_PUBLIC_MEDUSA_BACKEND_URL=https://api.technest.co.uk
ARG NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_BASE_URL=https://technest.co.uk
ARG NEXT_PUBLIC_DEFAULT_REGION=gb
ARG NEXT_PUBLIC_STRIPE_KEY
ARG NEXT_PUBLIC_IMAGE_HOSTNAME
ARG NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_MEDUSA_BACKEND_URL=$NEXT_PUBLIC_MEDUSA_BACKEND_URL \
    NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=$NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY \
    NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL \
    NEXT_PUBLIC_DEFAULT_REGION=$NEXT_PUBLIC_DEFAULT_REGION \
    NEXT_PUBLIC_STRIPE_KEY=$NEXT_PUBLIC_STRIPE_KEY \
    NEXT_PUBLIC_IMAGE_HOSTNAME=$NEXT_PUBLIC_IMAGE_HOSTNAME \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter "@technest/storefront..."
RUN pnpm --filter @technest/storefront build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=8000 \
    HOSTNAME=0.0.0.0
RUN groupadd -r -g 10001 nextjs && useradd -r -u 10001 -g nextjs -m -d /home/nextjs nextjs
WORKDIR /app
COPY --from=build --chown=nextjs:nextjs /repo/apps/storefront/.next/standalone ./
COPY --from=build --chown=nextjs:nextjs /repo/apps/storefront/.next/static ./apps/storefront/.next/static
COPY --from=build --chown=nextjs:nextjs /repo/apps/storefront/public ./apps/storefront/public
USER nextjs
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/storefront/server.js"]
