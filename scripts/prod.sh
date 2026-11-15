#!/usr/bin/env bash
# Builds and runs the production setup (database, backend, frontend at http://localhost:8080) in
# the foreground. The PC doesn't go to sleep while it runs; Ctrl+C stops the containers and
# allows sleep again. It must stay in the foreground: with `up -d`, compose would return at once
# and the sleep lock would end with it.
set -euo pipefail
cd "$(dirname "$0")/.."

exec systemd-inhibit --what=sleep --who=ChordMate --why="ChordMate is running" \
  docker compose --profile prod up --build
