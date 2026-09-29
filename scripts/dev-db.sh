#!/usr/bin/env bash
# Creates the per-engineer dev databases in the shared dev Postgres.
# Usage (from store/): bash scripts/dev-db.sh
# Idempotent: existing databases are left untouched.
set -euo pipefail

COMPOSE_FILE="$(dirname "$0")/../docker-compose.dev.yml"

for db in technest_e1 technest_e2 technest_e3 technest_e4; do
  exists=$(docker compose -f "$COMPOSE_FILE" exec -T postgres \
    psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${db}'")
  if [ "$exists" = "1" ]; then
    echo "exists:  ${db}"
  else
    docker compose -f "$COMPOSE_FILE" exec -T postgres \
      psql -U postgres -c "CREATE DATABASE ${db}" >/dev/null
    echo "created: ${db}"
  fi
done
