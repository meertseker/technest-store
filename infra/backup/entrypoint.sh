#!/usr/bin/env bash
# Runs backup.sh every BACKUP_EVERY_MINUTES (default 60), or runs one command if given
# (e.g. `docker compose run --rm backup backup.sh` or `... restore.sh --list`).
# The interval is the most data a lost disk can cost: with the default, up to one hour of
# orders (DEPLOY.md, "Yedekleme"). A failed run is retried after BACKUP_RETRY_MINUTES (10),
# not at the next interval. A sleep loop rather than crond: busybox crond needs root to
# switch users.
set -euo pipefail
if [ "$#" -gt 0 ]; then exec "$@"; fi
every="${BACKUP_EVERY_MINUTES:-60}"
retry="${BACKUP_RETRY_MINUTES:-10}"
echo "backup: every ${every} min, retry after ${retry} min on failure, keep ${BACKUP_RETENTION_DAYS:-30} days"
# The first backup runs a minute after start, so a new server has one before its first hour.
sleep 60
while true; do
  if /usr/local/bin/backup.sh; then
    sleep $(( every * 60 ))
  else
    echo "backup: FAILED (retrying in ${retry} min)" >&2
    sleep $(( retry * 60 ))
  fi
done
