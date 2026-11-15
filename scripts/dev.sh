#!/usr/bin/env bash
# Starts the dev database (Docker), the backend and the frontend.
# Keys: r = rebuild and restart the backend, q or Ctrl+C = stop everything.
set -euo pipefail
cd "$(dirname "$0")/.."

source .env
# The backend reads its database settings from these variables.
export DB_HOST=localhost DB_PORT=5432 DB_NAME=postgres DB_USER=postgres
export DB_PASSWORD="$POSTGRES_PASSWORD" CHORDMATE_PORT=3000

backend_pid=""
frontend_pid=""

# Each process runs in its own session, so that stopping it also stops its children
# (cargo → backend binary, npm → vite).
start() {
  setsid bash -c "$1" < /dev/null &
}

stop() {
  if [[ -n "$1" ]]; then
    kill -- "-$1" 2> /dev/null || true
    wait "$1" 2> /dev/null || true
  fi
}

start_backend() {
  start "cd backend && cargo run -q --bin migrate > /dev/null && exec cargo run -q --bin chordmate"
  backend_pid=$!
}

cleanup() {
  stop "$backend_pid"
  stop "$frontend_pid"
  docker compose --profile dev stop
}
trap cleanup EXIT
trap 'exit 130' INT TERM

docker compose --profile dev up -d --wait
start "cd chordmate && exec npm run dev -- --host"
frontend_pid=$!
start_backend

echo "Keys: r = restart backend, q = quit"
while read -rsn1 key; do
  case "$key" in
    r)
      echo "Restarting backend…"
      stop "$backend_pid"
      start_backend
      ;;
    q) break ;;
  esac
done
