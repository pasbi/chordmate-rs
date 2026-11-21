# Sourced by dev.sh and prod.sh. Both setups share one database container (see
# docker-compose.yml), so each removes its own containers when it stops, and the database only
# if the other setup doesn't run.

# Whether the other setup runs: dev.sh runs pgAdmin, prod.sh the backend container.
setup_running() {
  local profile=$1 marker=$2
  docker compose --profile "$profile" ps --status running --services | grep -qx "$marker"
}

# Removes the containers of `profile`; the shared database only if `other_profile`'s marker
# container doesn't run. Removed, not just stopped: a stopped container keeps pointing to the
# network, which may be gone by its next start. The database volume always stays.
remove_setup() {
  local profile=$1 own_services=$2 other_profile=$3 other_marker=$4
  if setup_running "$other_profile" "$other_marker"; then
    # shellcheck disable=SC2086 # a list of service names
    docker compose --profile "$profile" rm --stop --force $own_services
  else
    docker compose --profile "$profile" down --remove-orphans
  fi
}
