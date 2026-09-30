#!/usr/bin/env bash
# Restore a dump from R2 into the database. DESTRUCTIVE: replaces existing objects.
#   restore.sh --list              list available dumps (newest last)
#   restore.sh latest --yes        restore the newest dump
#   restore.sh <file.dump> --yes   restore a specific dump
# Stop server and worker first (docker compose stop server worker), start them after.
set -euo pipefail
: "${BACKUP_REMOTE:?BACKUP_REMOTE is not set}"
: "${PGDATABASE:?PGDATABASE is not set}"
list() { rclone lsf --include "${PGDATABASE}-*.dump" "$BACKUP_REMOTE" | sort; }
if [ "${1:-}" = "--list" ] || [ -z "${1:-}" ]; then list; exit 0; fi
target="$1"
if [ "$target" = "latest" ]; then target="$(list | tail -n 1)"; fi
[ -n "$target" ] || { echo "restore: no dumps found in $BACKUP_REMOTE" >&2; exit 1; }
[ "${2:-}" = "--yes" ] || { echo "restore: would restore $target into $PGDATABASE. Re-run with --yes." >&2; exit 2; }
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
start=$(date +%s)
rclone copyto "$BACKUP_REMOTE/$target" "$tmp/$target"
pg_restore --clean --if-exists --no-owner --no-privileges --exit-on-error --dbname "$PGDATABASE" "$tmp/$target"
echo "restore: OK $target in $(( $(date +%s) - start ))s"
