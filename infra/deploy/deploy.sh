#!/usr/bin/env bash
# Runs on the server, in /opt/technest, from the Deploy workflow:
#   ssh deploy@server "cd /opt/technest && bash -s -- <image tag>" < infra/deploy/deploy.sh
# Pull -> migrate -> record the tag -> start -> reload Caddy.
#
# The new tag is written to .env only after the migration has succeeded. Until
# then the images are pulled and migrated with IMAGE_TAG in the environment
# (which compose prefers over .env), so a failed pull or migrate leaves .env on
# the tag that is running, and a later `docker compose up -d` by hand can't
# start new code on a half-migrated database.
# Tested by infra/deploy/test-deploy.sh.
set -euo pipefail

TAG="${1:?usage: deploy.sh <image tag>}"

previous="$(grep -E '^IMAGE_TAG=' .env | cut -d= -f2 || true)"
echo "$previous" > .previous_tag

IMAGE_TAG="$TAG" docker compose pull --quiet

# This script reaches bash on stdin and `docker compose run` reads stdin too:
# without -T and </dev/null it swallows the rest of the script, so nothing
# after it runs and bash still exits 0.
IMAGE_TAG="$TAG" docker compose --profile ops run --rm -T migrate </dev/null

sed -i '/^IMAGE_TAG=/d' .env
echo "IMAGE_TAG=$TAG" >> .env

docker compose up -d --remove-orphans

# The Caddyfile is a bind mount: compose doesn't recreate Caddy when only its
# content changed. A failed reload must not fail the deploy (the containers are
# up; the health check that follows decides), but it must be seen.
docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile </dev/null \
  || echo "WARNING: Caddy reload failed; the old Caddyfile is still in use" >&2
