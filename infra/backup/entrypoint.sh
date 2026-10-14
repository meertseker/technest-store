#!/usr/bin/env bash
# Runs backup.sh every BACKUP_EVERY_MINUTES (default 60), or runs one command if given
# (e.g. `docker compose run --rm backup backup.sh` or `... restore.sh --list`).
# The interval is the most data a lost disk can cost: with the default, up to one hour of
# orders (DEPLOY.md, "Yedekleme"). A failed run is retried after BACKUP_RETRY_MINUTES (10),
# not at the next interval. A sleep loop rather than crond: busybox crond needs root to
# switch users.
# This script is PID 1. The pauses run in the background and are waited on, so a stop
# signal ends the loop at once instead of after Docker's 10 s grace period (bash does
# not act on a signal while a foreground child like `sleep` is running).
set -euo pipefail
if [ "$#" -gt 0 ]; then exec "$@"; fi
bin="${BACKUP_BIN:-/usr/local/bin}"
every="${BACKUP_EVERY_MINUTES:-60}"
retry="${BACKUP_RETRY_MINUTES:-10}"
pause_pid=""
stop() {
  echo "backup: stopping"
  [ -n "$pause_pid" ] && kill "$pause_pid" 2>/dev/null
  exit 0
}
trap stop TERM INT
pause() { # pause <seconds>: interruptible sleep
  sleep "$1" &
  pause_pid=$!
  wait "$pause_pid" || true
  pause_pid=""
}
echo "backup: every ${every} min, retry after ${retry} min on failure, keep ${BACKUP_RETENTION_DAYS:-30} days"
# The first backup runs a minute after start, so a new server has one before its first hour.
pause 60
while true; do
  if "$bin/backup.sh"; then
    pause $(( every * 60 ))
  else
    echo "backup: FAILED (retrying in ${retry} min)" >&2
    pause $(( retry * 60 ))
  fi
done
