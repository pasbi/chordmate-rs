#!/usr/bin/env bash
# Builds and runs the production setup (database, migrations, backend, frontend at
# http://localhost:8080) in the foreground. The PC doesn't go to sleep while it runs. Ctrl+C stops
# the containers and removes them (the database volume stays), so that no stopped container is
# left behind with its old configuration, and allows sleep again.
set -euo pipefail

# The script re-runs itself under systemd-inhibit, so that the sleep lock lasts until the
# containers are removed. It must stay in the foreground: with `up -d`, compose would return at
# once and the sleep lock would end with it.
if [[ -z "${CHORDMATE_SLEEP_INHIBITED:-}" ]]; then
  export CHORDMATE_SLEEP_INHIBITED=1
  exec systemd-inhibit --what=sleep --who=ChordMate --why="ChordMate is running" "$0" "$@"
fi

cd "$(dirname "$0")/.."

trap 'docker compose --profile prod down' EXIT
trap 'exit 130' INT TERM

docker compose --profile prod up --build
