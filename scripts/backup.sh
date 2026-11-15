#!/usr/bin/env bash
# Dumps the Chordmate database into FILE (default: chordmate-<date>-<time>.dump in the current directory).
# The Spotify login is left out; log in again after restoring.
#
# Restore (replaces the current contents):
#   docker compose exec -T <database service> pg_restore -U postgres -d postgres --clean --if-exists < FILE
set -euo pipefail

output=$(realpath -m "${1:-chordmate-$(date +%F-%H%M%S).dump}")
cd "$(dirname "$0")/.."

service=$(docker compose --profile dev --profile prod ps --services --status running | grep '^database-' || true)
if [[ -z "$service" ]]; then
  echo "No database is running. Start it with: docker compose --profile dev up" >&2
  exit 1
fi

docker compose exec -T "$service" \
  pg_dump -U postgres -Fc --exclude-table-data=spotify_token postgres > "$output.partial"
mv "$output.partial" "$output"
echo "Backed up $service to $output"
