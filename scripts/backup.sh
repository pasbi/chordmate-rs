#!/usr/bin/env bash
# Dumps the Chordmate database into FILE (default: chordmate-<date>-<time>.dump in the current directory).
# The Spotify login is left out; log in again after restoring.
#
# Restore (replaces the current contents):
#   docker exec -i chordmate-database pg_restore -U postgres -d postgres --clean --if-exists < FILE
set -euo pipefail

output=$(realpath -m "${1:-chordmate-$(date +%F-%H%M%S).dump}")
cd "$(dirname "$0")/.."

# The one database container of both setups (see docker-compose.yml).
container=chordmate-database
if [[ "$(docker inspect --format '{{.State.Running}}' "$container" 2> /dev/null)" != "true" ]]; then
  echo "The database isn't running. Start it with scripts/dev.sh or scripts/prod.sh." >&2
  exit 1
fi

docker exec "$container" \
  pg_dump -U postgres -Fc --exclude-table-data=spotify_token postgres > "$output.partial"
mv "$output.partial" "$output"
echo "Backed up the database to $output"
