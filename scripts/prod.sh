#!/usr/bin/env bash
# Builds and runs the production setup (database, migrations, backend, frontend at
# http://localhost:8080) and shows its logs. The PC doesn't go to sleep while it runs. Ctrl+C
# removes the containers (the database volume stays; the database itself only if dev.sh doesn't
# use it), and allows sleep again.
set -euo pipefail

# The script re-runs itself under systemd-inhibit, so that the sleep lock lasts until the
# containers are removed. It stays in the foreground, following the logs.
if [[ -z "${CHORDMATE_SLEEP_INHIBITED:-}" ]]; then
  export CHORDMATE_SLEEP_INHIBITED=1
  exec systemd-inhibit --what=sleep --who=ChordMate --why="ChordMate is running" "$0" "$@"
fi

cd "$(dirname "$0")/.."
source scripts/compose.sh

trap 'remove_setup prod "backend frontend migrate" dev pgadmin' EXIT
trap 'exit 130' INT TERM

# Detached, then following the logs: Ctrl+C on an attached `up` would stop every container it
# started, the shared database too. --remove-orphans: containers of services no longer in
# docker-compose.yml go first, such as a database container from before the setups shared one.
docker compose --profile prod up --build --detach --wait --remove-orphans
docker compose --profile prod logs --follow --since 0s backend frontend
