#!/usr/bin/env bash
# Restore a dump from R2 into the database. DESTRUCTIVE: the database is dropped and rebuilt.
#   restore.sh --list              list available dumps (newest last)
#   restore.sh latest --yes        restore the newest dump
#   restore.sh <file.dump> --yes   restore a specific dump
# Stop server and worker first (docker compose stop server worker), start them after.
#
# What it does, in this order:
#   1. dumps the database as it is now and uploads it as pre-restore-<name> (if this fails,
#      nothing is touched): everything since the chosen dump would otherwise be gone for good
#   2. drops the database and creates an empty one from template0. `pg_restore --clean` into
#      the existing database only drops what the dump knows about, so tables added by a newer
#      migration would stay and the next migrate would fail on "already exists"
#   3. restores in one transaction and stops at the first error, so a failed restore leaves
#      an empty database, never half of one
# An encrypted dump (.age) needs BACKUP_AGE_IDENTITY: the path of the private key file,
# brought to the server for the restore and removed afterwards.
set -euo pipefail
: "${BACKUP_REMOTE:?BACKUP_REMOTE is not set}"
: "${PGDATABASE:?PGDATABASE is not set}"
list() { rclone lsf --include "${PGDATABASE}-*.dump*" "$BACKUP_REMOTE" | sort; }
if [ "${1:-}" = "--list" ] || [ -z "${1:-}" ]; then list; exit 0; fi
target="$1"
if [ "$target" = "latest" ]; then target="$(list | tail -n 1)"; fi
[ -n "$target" ] || { echo "restore: no dumps found in $BACKUP_REMOTE" >&2; exit 1; }
[ "${2:-}" = "--yes" ] || { echo "restore: would DROP $PGDATABASE and restore $target into it. Re-run with --yes." >&2; exit 2; }
case "$target" in
  *.age) [ -n "${BACKUP_AGE_IDENTITY:-}" ] || { echo "restore: $target is encrypted; set BACKUP_AGE_IDENTITY to the private key file" >&2; exit 1; } ;;
esac

tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
start=$(date +%s)

rclone copyto "$BACKUP_REMOTE/$target" "$tmp/$target"
dump="$tmp/$target"
case "$target" in
  *.age) dump="$tmp/${target%.age}"; age -d -i "$BACKUP_AGE_IDENTITY" -o "$dump" "$tmp/$target" ;;
esac
# Refuse a file pg_restore can't read before anything is dropped.
pg_restore --list "$dump" > /dev/null

safety="pre-restore-${PGDATABASE}-$(date -u +%Y%m%dT%H%M%SZ).dump"
pg_dump --format=custom --compress=9 --no-owner --no-privileges --file "$tmp/$safety"
rclone copyto --s3-no-check-bucket "$tmp/$safety" "$BACKUP_REMOTE/$safety"
echo "restore: current state saved as $safety"

# Connect to the maintenance database: a database can't be dropped from inside itself.
dropdb --if-exists --force --maintenance-db=postgres "$PGDATABASE"
createdb --template=template0 --maintenance-db=postgres "$PGDATABASE"
pg_restore --single-transaction --exit-on-error --no-owner --no-privileges --dbname "$PGDATABASE" "$dump"
echo "restore: OK $target in $(( $(date +%s) - start ))s (state before the restore: $safety)"
