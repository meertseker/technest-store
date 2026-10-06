# syntax=docker/dockerfile:1.7
# The files the server needs for one release, as an image with the same tag as the app
# images: ghcr.io/<owner>/technest-deploy:<environment>-<commit>-<run>.
# The server never runs it: deploy-gate.sh copies /bundle out of it (docker create + docker cp).
# Shipping these through the registry means the deploy key does not have to (and cannot)
# upload a compose file or a script.
# Build from the repo root: docker build -f infra/deploy/Dockerfile .
# (infra/deploy/Dockerfile.dockerignore replaces the root .dockerignore for this build.)
FROM scratch
COPY docker-compose.yml Caddyfile /bundle/
COPY infra/staging/docker-compose.staging.yml /bundle/docker-compose.staging.yml
COPY infra/deploy/deploy.sh /bundle/deploy.sh
# Never started; `docker create` only wants a command to exist.
CMD ["/bundle/deploy.sh"]
