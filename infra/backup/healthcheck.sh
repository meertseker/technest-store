#!/usr/bin/env bash
# Unhealthy when the last successful backup is older than 26 hours, or when none has
# succeeded in the first 26 hours after the container started.
set -eu
limit=93600
now=$(date -u +%s)
if [ -f /var/lib/backup/last_success ]; then
  [ $(( now - $(cat /var/lib/backup/last_success) )) -lt $limit ]
else
  [ $(( now - $(cat /tmp/started 2>/dev/null || echo "$now") )) -lt $limit ]
fi
