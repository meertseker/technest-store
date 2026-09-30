#!/usr/bin/env bash
# pg_dump (custom format) -> R2 bucket, then delete dumps older than BACKUP_RETENTION_DAYS.
# Env: PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE, BACKUP_REMOTE (rclone path, e.g. r2:technest-backups/db)
#      and the rclone remote config via RCLONE_CONFIG_R2_* (see docker-compose.yml).
set -euo pipefail
: "${BACKUP_REMOTE:?BACKUP_REMOTE is not set}"
: "${PGDATABASE:?PGDATABASE is not set}"
retention="${BACKUP_RETENTION_DAYS:-30}"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
name="${PGDATABASE}-${stamp}.dump"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

start=$(date +%s)
pg_dump --format=custom --compress=9 --no-owner --no-privileges --file "$tmp/$name"
# A dump that pg_restore can't list is not a backup.
pg_restore --list "$tmp/$name" > /dev/null
size=$(stat -c %s "$tmp/$name")
rclone copyto --s3-no-check-bucket "$tmp/$name" "$BACKUP_REMOTE/$name"
rclone delete --min-age "${retention}d" --include "${PGDATABASE}-*.dump" "$BACKUP_REMOTE"
date -u +%s > /var/lib/backup/last_success
echo "backup: OK $name (${size} bytes, $(( $(date +%s) - start ))s), pruned > ${retention}d"
