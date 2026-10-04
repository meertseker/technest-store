#!/usr/bin/env bash
# Unhealthy when the last successful backup is older than BACKUP_MAX_AGE_SECONDS (default: two
# backup intervals plus ten minutes). The state file is on a volume, so a deploy that recreates
# the container doesn't reset the clock. Docker only reports "unhealthy"; the alarm that
# reaches a person is the heartbeat in backup.sh.
set -eu
state_dir="${BACKUP_STATE_DIR:-/var/lib/backup}"
limit="${BACKUP_MAX_AGE_SECONDS:-$(( ${BACKUP_EVERY_MINUTES:-60} * 120 + 600 ))}"
now=$(date -u +%s)
if [ -f "$state_dir/last_success" ]; then
  [ $(( now - $(cat "$state_dir/last_success") )) -lt "$limit" ]
else
  # First start with an empty volume: give the first backup one limit to succeed.
  [ -f "$state_dir/first_start" ] || date -u +%s > "$state_dir/first_start"
  [ $(( now - $(cat "$state_dir/first_start") )) -lt "$limit" ]
fi
