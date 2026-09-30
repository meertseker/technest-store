#!/usr/bin/env bash
# Runs backup.sh every day at BACKUP_AT (HH:MM, Europe/London), or runs one command if given
# (e.g. `docker compose run --rm backup backup.sh` or `... restore.sh --list`).
# A sleep loop rather than crond: busybox crond needs root to switch users.
set -euo pipefail
if [ "$#" -gt 0 ]; then exec "$@"; fi
date -u +%s > /tmp/started
at="${BACKUP_AT:-03:15}"
echo "backup: daily at ${at} (${TZ}), keep ${BACKUP_RETENTION_DAYS:-30} days"
while true; do
  now=$(date +%s)
  next=$(date -d "$(date +%Y-%m-%d) ${at}" +%s)
  [ "$next" -le "$now" ] && next=$(date -d "$(date -d tomorrow +%Y-%m-%d) ${at}" +%s)
  sleep $(( next - now ))
  /usr/local/bin/backup.sh || echo "backup: FAILED (will retry tomorrow; healthcheck turns unhealthy after 26h)" >&2
done
