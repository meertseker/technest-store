#!/usr/bin/env bash
# The only thing the GitHub Actions deploy key may run on the server.
#
# The key is listed in ~deploy/.ssh/authorized_keys as
#   restrict,command="/opt/technest/bin/technest-deploy-gate <environment>" ssh-ed25519 ...
# (written by setup-deploy-key.sh), so whatever the client asks for, sshd runs this
# script instead and hands over the request in SSH_ORIGINAL_COMMAND. No shell, no
# terminal, no port forwarding, no file copy.
#
# Requests:
#   deploy <tag>   <tag> must be <environment>-<40 hex commit>-<run number>
#   rollback       back to the tag and the config files of the deploy before
#   prune          remove images older than two weeks that nothing uses
#   status         docker compose ps
#
# Nothing the client sends is executed. The files a release needs (docker-compose.yml,
# Caddyfile, deploy.sh) are not sent by the client either: they come out of the
# technest-deploy image with the same tag, which only a workflow run with push rights
# to our registry can have put there. A stolen key can re-run a deploy of an image we
# built; it cannot run a command or ship a compose file of its own.
#
# Tested by infra/deploy/test-deploy-gate.sh.
set -euo pipefail

environment="${1:-}"
# The stack's directory is where this file is installed (/opt/technest/bin/..), and the
# request is the only thing read from the client: nothing else comes from the environment.
root="$(dirname "$(cd "$(dirname "$0")" && pwd)")"
request="${SSH_ORIGINAL_COMMAND:-}"
config_files="docker-compose.yml docker-compose.staging.yml Caddyfile"

refuse() {
  echo "deploy-gate: refused: $1" >&2
  exit 64
}

case "$environment" in
  staging | production) ;;
  *) refuse "the key is not set up for an environment (run setup-deploy-key.sh again)" ;;
esac

# Whole request against fixed patterns: no word of it ever reaches a shell.
verb="" tag=""
if [[ "$request" =~ ^deploy\ ([a-z]+-[0-9a-f]{40}-[0-9]{1,9})$ ]]; then
  verb=deploy
  tag="${BASH_REMATCH[1]}"
  [[ "$tag" == "$environment"-* ]] || refuse "tag '$tag' is not a $environment tag"
elif [[ "$request" =~ ^(rollback|prune|status)$ ]]; then
  verb="$request"
else
  refuse "only 'deploy <$environment-commit-run>', 'rollback', 'prune' and 'status' are allowed"
fi

cd "$root"
[ -f .env ] || refuse "$root/.env does not exist (fill it in first, DEPLOY.md)"

# One request at a time (the workflow already queues per environment; this covers a
# second key holder or a re-run that overlaps).
if command -v flock >/dev/null 2>&1; then
  exec 9> "$root/.deploy.lock"
  flock -n 9 || refuse "another deploy request is running"
fi

# Write over the file that is there instead of replacing it: the Caddyfile is mounted
# into the Caddy container as a single file, and a replaced file (new inode) would
# leave the container looking at the old one, so `caddy reload` would reload nothing new.
put() { cat "$1" > "$2"; }

restore_config() { # restore_config <dir>: put back the config files saved there
  local f
  for f in $config_files; do
    if [ -f "$1/$f" ]; then put "$1/$f" "$root/$f"; fi
  done
}

running_tag() {
  grep -E '^IMAGE_TAG=' .env | tail -1 | cut -d= -f2- | sed -E 's/[[:space:]]*(#.*)?$//' || true
}

start_tag() { # start_tag <tag>: record it and bring the stack to it
  sed -i '/^IMAGE_TAG=/d' .env
  echo "IMAGE_TAG=$1" >> .env
  docker compose up -d --remove-orphans || return 1
  # A failed reload is reported, not fatal: the containers are up.
  docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile </dev/null \
    || echo "WARNING: Caddy reload failed; the old Caddyfile is still in use" >&2
}

do_deploy() {
  local owner image cid stage saved before f
  owner="$(grep -E '^GHCR_OWNER=' .env | tail -1 | cut -d= -f2- | sed -E 's/[[:space:]]*(#.*)?$//' || true)"
  [[ "$owner" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?$ ]] || refuse "GHCR_OWNER in $root/.env is missing or not a lower-case GitHub name"
  image="ghcr.io/$owner/technest-deploy:$tag"
  before="$(running_tag)"

  docker pull --quiet "$image"

  stage="$root/.release-new"
  saved="$root/.config-saving"
  rm -rf "$stage" "$saved"
  mkdir -p "$stage" "$saved"
  cid="$(docker create "$image")"
  docker cp "$cid:/bundle/." "$stage" || { docker rm "$cid" >/dev/null; refuse "could not read the release files from $image"; }
  docker rm "$cid" >/dev/null
  for f in docker-compose.yml Caddyfile deploy.sh; do
    [ -s "$stage/$f" ] || refuse "$image has no $f"
  done

  # Keep what is live now, so a failed release leaves the server as it was and a
  # rollback gets the config that belongs to the previous tag.
  for f in $config_files .previous_tag; do
    if [ -f "$root/$f" ]; then cp "$root/$f" "$saved/$f"; fi
  done
  for f in $config_files; do
    if [ -f "$stage/$f" ]; then put "$stage/$f" "$root/$f"; fi
  done

  if bash "$stage/deploy.sh" "$tag" </dev/null; then
    rm -rf "$root/.config-previous"
    mv "$saved" "$root/.config-previous"
    rm -rf "$stage"
    echo "deploy-gate: $tag is running"
    return 0
  fi

  if [ "$(running_tag)" = "$before" ]; then
    # Pull or migrate failed: deploy.sh had not recorded the new tag and started nothing.
    restore_config "$saved"
    if [ -f "$saved/.previous_tag" ]; then put "$saved/.previous_tag" "$root/.previous_tag"; fi
    echo "deploy-gate: deploy of $tag failed before anything was started; config files and tag are unchanged" >&2
  elif [ -n "$before" ]; then
    # The new tag was recorded but the stack did not start: go back to what was running.
    echo "deploy-gate: $tag did not start; going back to $before" >&2
    restore_config "$saved"
    start_tag "$before" || echo "deploy-gate: going back to $before failed too; the server needs a person" >&2
  else
    echo "deploy-gate: the first deploy ($tag) did not start; nothing to go back to. See: docker compose ps" >&2
  fi
  rm -rf "$saved" "$stage"
  exit 1
}

do_rollback() {
  local previous
  previous="$(head -1 .previous_tag 2>/dev/null | tr -d '[:space:]' || true)"
  [[ "$previous" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]*$ ]] || refuse "no previous tag is recorded (nothing to roll back to)"
  if [ -d "$root/.config-previous" ]; then
    restore_config "$root/.config-previous"
  fi
  start_tag "$previous"
  echo "deploy-gate: rolled back to $previous"
}

case "$verb" in
  deploy) do_deploy ;;
  rollback) do_rollback ;;
  # Never the images in use; the previous tag's images stay for two weeks.
  prune) docker image prune -af --filter until=336h ;;
  status) docker compose ps ;;
esac
