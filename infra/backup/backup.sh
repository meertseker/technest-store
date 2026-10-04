#!/usr/bin/env bash
# pg_dump (custom format) -> R2 bucket, then delete dumps older than BACKUP_RETENTION_DAYS.
# Env: PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE, BACKUP_REMOTE (rclone path, e.g. r2:technest-backups/db)
#      and the rclone remote config via RCLONE_CONFIG_R2_* (see docker-compose.yml).
# Optional:
#   BACKUP_HEARTBEAT_URL  pinged after a good backup, and with /fail after a failed one
#                         (a dead-man's switch such as healthchecks.io: silence raises the alarm)
#   BACKUP_AGE_RECIPIENT  an age public key; the dump is encrypted before upload and only the
#                         private key, kept off this server, can read it
set -euo pipefail
: "${BACKUP_REMOTE:?BACKUP_REMOTE is not set}"
: "${PGDATABASE:?PGDATABASE is not set}"
retention="${BACKUP_RETENTION_DAYS:-30}"
state_dir="${BACKUP_STATE_DIR:-/var/lib/backup}"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
name="${PGDATABASE}-${stamp}.dump"
tmp="$(mktemp -d)"

ping() { # ping "" on success, ping "/fail" on failure; never fails the backup itself
  [ -n "${BACKUP_HEARTBEAT_URL:-}" ] || return 0
  curl -fsS -m 10 --retry 3 -o /dev/null "${BACKUP_HEARTBEAT_URL}$1" || echo "backup: heartbeat ping failed" >&2
}
finish() {
  status=$?
  rm -rf "$tmp"
  [ "$status" -eq 0 ] || ping "/fail"
  exit "$status"
}
trap finish EXIT

start=$(date +%s)
pg_dump --format=custom --compress=9 --no-owner --no-privileges --file "$tmp/$name"
# A dump that pg_restore can't list is not a backup.
pg_restore --list "$tmp/$name" > /dev/null
upload="$name"
if [ -n "${BACKUP_AGE_RECIPIENT:-}" ]; then
  upload="$name.age"
  age -r "$BACKUP_AGE_RECIPIENT" -o "$tmp/$upload" "$tmp/$name"
fi
size=$(stat -c %s "$tmp/$upload")
rclone copyto --s3-no-check-bucket "$tmp/$upload" "$BACKUP_REMOTE/$upload"
rclone delete --min-age "${retention}d" --include "${PGDATABASE}-*.dump*" "$BACKUP_REMOTE"
date -u +%s > "$state_dir/last_success"
ping ""
echo "backup: OK $upload (${size} bytes, $(( $(date +%s) - start ))s), pruned > ${retention}d"
