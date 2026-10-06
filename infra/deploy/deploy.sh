#!/usr/bin/env bash
# Runs on the server, in /opt/technest. The Deploy workflow asks for it over SSH
# ("deploy <image tag>"); deploy-gate.sh checks the request, takes this file out of
# the technest-deploy image with that tag and runs it.
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

# The value only: the template's line carries a trailing comment, which must not
# end up as the tag a rollback goes back to.
previous="$(grep -E '^IMAGE_TAG=' .env | tail -1 | cut -d= -f2- | sed -E 's/[[:space:]]*(#.*)?$//' || true)"
echo "$previous" > .previous_tag

IMAGE_TAG="$TAG" docker compose pull --quiet

# `docker compose run` reads stdin. If this script is ever fed to bash on stdin
# (the test does), run without -T and </dev/null would swallow the rest of the
# script: nothing after it would run and bash would still exit 0.
IMAGE_TAG="$TAG" docker compose --profile ops run --rm -T migrate </dev/null

sed -i '/^IMAGE_TAG=/d' .env
echo "IMAGE_TAG=$TAG" >> .env

docker compose up -d --remove-orphans

# The Caddyfile is a bind mount: compose doesn't recreate Caddy when only its
# content changed. A failed reload must not fail the deploy (the containers are
# up; the health check that follows decides), but it must be seen.
docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile </dev/null \
  || echo "WARNING: Caddy reload failed; the old Caddyfile is still in use" >&2
