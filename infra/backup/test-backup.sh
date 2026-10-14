#!/usr/bin/env bash
# Tests backup.sh and restore.sh against stand-ins for pg_dump, pg_restore, dropdb, createdb,
# rclone, curl and age that record their calls. Run: bash infra/backup/test-backup.sh (also in CI).
# The real thing is proven by the restore drill in DEPLOY.md, not here.
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
fails=0

check() { # check "what" "expected" "actual"
  if [ "$2" = "$3" ]; then echo "ok   - $1"; else echo "FAIL - $1: expected '$2', got '$3'"; fails=$((fails + 1)); fi
}

# setup <failing command or "none">: a scratch dir with fake tools; the named one exits 1.
setup() {
  work="$(mktemp -d)"
  mkdir -p "$work/bin" "$work/state" "$work/remote"
  for tool in pg_dump pg_restore dropdb createdb rclone curl age; do
    cat > "$work/bin/$tool" <<EOF
#!/usr/bin/env bash
echo "$tool \$*" >> "$work/calls"
[ "$tool" = "$1" ] && exit 1
case "$tool" in
  pg_dump) for a in "\$@"; do case "\$prev" in --file) echo dump > "\$a" ;; esac; prev="\$a"; done ;;
  age) cat > /dev/null; for a in "\$@"; do case "\$prev" in -o|--output) echo enc > "\$a" ;; esac; prev="\$a"; done ;;
  rclone) case "\$1" in
      lsf) ls "$work/remote" ;;
      copyto) case "\$2" in --s3-no-check-bucket) cp "\$3" "$work/remote/\$(basename "\$4")" ;; *) echo dump > "\$3" ;; esac ;;
    esac ;;
esac
exit 0
EOF
    chmod +x "$work/bin/$tool"
  done
  export PATH="$work/bin:$PATH" BACKUP_REMOTE="r2:bucket/db" PGDATABASE="technest" \
    BACKUP_STATE_DIR="$work/state" BACKUP_HEARTBEAT_URL="https://hc.example/ping/abc"
  unset BACKUP_AGE_RECIPIENT BACKUP_AGE_IDENTITY
}
calls() { grep -c -- "$1" "$work/calls" 2>/dev/null || true; }
order() { grep -oE "^($1)" "$work/calls" | tr '\n' ' ' | sed 's/ $//'; }

echo "# backup.sh"
setup none
bash "$here/backup.sh" > "$work/out" 2>&1; status=$?
check "backup: exit code" "0" "$status"
check "backup: dump is checked with pg_restore --list" "1" "$(calls 'pg_restore --list')"
check "backup: uploaded" "1" "$(ls "$work/remote" | grep -c '^technest-.*\.dump$')"
check "backup: last_success written to the state dir" "1" "$([ -s "$work/state/last_success" ] && echo 1 || echo 0)"
check "backup: heartbeat pinged" "1" "$(calls 'curl .*https://hc.example/ping/abc$')"
check "backup: no failure ping" "0" "$(calls '/fail')"

setup pg_dump
bash "$here/backup.sh" > "$work/out" 2>&1; status=$?
check "dump fails: exit code is not 0" "1" "$([ "$status" -ne 0 ] && echo 1 || echo 0)"
check "dump fails: nothing uploaded" "0" "$(ls "$work/remote" | wc -l | tr -d ' ')"
check "dump fails: last_success not written" "0" "$([ -e "$work/state/last_success" ] && echo 1 || echo 0)"
check "dump fails: failure pinged" "1" "$(calls 'curl .*https://hc.example/ping/abc/fail$')"

setup rclone
bash "$here/backup.sh" > "$work/out" 2>&1; status=$?
check "upload fails: exit code is not 0" "1" "$([ "$status" -ne 0 ] && echo 1 || echo 0)"
check "upload fails: failure pinged" "1" "$(calls '/fail')"

setup none
export BACKUP_AGE_RECIPIENT="age1examplepublickey"
bash "$here/backup.sh" > "$work/out" 2>&1; status=$?
check "encrypted: exit code" "0" "$status"
check "encrypted: only the encrypted file is uploaded" "1" "$(ls "$work/remote" | grep -c '\.dump\.age$')"
check "encrypted: no plain dump is uploaded" "0" "$(ls "$work/remote" | grep -c '\.dump$')"

echo "# restore.sh"
setup none
echo dump > "$work/remote/technest-20261001T000000Z.dump"
echo dump > "$work/remote/technest-20261002T000000Z.dump"
bash "$here/restore.sh" latest > "$work/out" 2>&1; status=$?
check "restore without --yes: refused" "2" "$status"
check "restore without --yes: nothing dropped" "0" "$(calls '^dropdb')"

setup none
echo dump > "$work/remote/technest-20261001T000000Z.dump"
echo dump > "$work/remote/technest-20261002T000000Z.dump"
bash "$here/restore.sh" latest --yes > "$work/out" 2>&1; status=$?
check "restore: exit code" "0" "$status"
check "restore: the newest dump is restored" "1" "$(calls 'rclone copyto r2:bucket/db/technest-20261002T000000Z.dump')"
check "restore: safety dump, then drop, create, restore" "pg_dump dropdb createdb pg_restore" \
  "$(grep -vE 'pg_restore --list' "$work/calls" | grep -oE '^(pg_dump|dropdb|createdb|pg_restore)' | tr '\n' ' ' | sed 's/ $//')"
check "restore: the safety dump is uploaded" "1" "$(ls "$work/remote" | grep -c '^pre-restore-technest-.*\.dump$')"
check "restore: clean database from template0" "1" "$(calls 'createdb .*--template=template0')"
check "restore: one transaction, stop on the first error" "1" "$(calls 'pg_restore .*--single-transaction .*--exit-on-error')"
check "restore: no --clean into a dirty database" "0" "$(calls 'pg_restore .*--clean')"

setup pg_dump
echo dump > "$work/remote/technest-20261002T000000Z.dump"
bash "$here/restore.sh" latest --yes > "$work/out" 2>&1; status=$?
check "safety dump fails: exit code is not 0" "1" "$([ "$status" -ne 0 ] && echo 1 || echo 0)"
check "safety dump fails: the database is not dropped" "0" "$(calls '^dropdb')"

echo "# healthcheck.sh"
setup none
date -u +%s > "$work/state/last_success"
BACKUP_MAX_AGE_SECONDS=7200 bash "$here/healthcheck.sh"; check "healthy right after a backup" "0" "$?"
echo $(( $(date -u +%s) - 8000 )) > "$work/state/last_success"
BACKUP_MAX_AGE_SECONDS=7200 bash "$here/healthcheck.sh"; check "unhealthy when the last backup is too old" "1" "$?"

echo "# entrypoint.sh (PID 1 in the container)"
# A stop signal must end the loop at once, not after Docker's grace period, also while it pauses.
setup none
printf '#!/usr/bin/env bash\necho ran >> "%s/runs"\n' "$work" > "$work/bin/backup.sh"
chmod +x "$work/bin/backup.sh"
BACKUP_BIN="$work/bin" bash "$here/entrypoint.sh" > "$work/out" 2>&1 &
pid=$!
sleep 1
kill -TERM "$pid"
stopped=no
for _ in $(seq 1 20); do kill -0 "$pid" 2>/dev/null || { stopped=yes; break; }; sleep 0.25; done
kill -KILL "$pid" 2>/dev/null
wait "$pid" 2>/dev/null; status=$?
check "stops within 5 s of SIGTERM while pausing" "yes" "$stopped"
check "exits cleanly on SIGTERM" "0" "$([ "$stopped" = yes ] && echo "$status" || echo killed)"
check "says it is stopping" "1" "$(grep -c 'backup: stopping' "$work/out")"

echo
[ "$fails" -eq 0 ] && echo "all backup checks passed" || { echo "$fails check(s) failed"; exit 1; }
