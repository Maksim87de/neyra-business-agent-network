#!/usr/bin/env bash
# Interactive provider admission for an already installed client contour.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_DIR="$ROOT/deploy"
CONFIG_DIR="${NEYRA_CONFIG_DIR:-/etc/neyra-client}"
DEPLOY_ENV="$CONFIG_DIR/deploy.env"

fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }
pass() { printf 'PASS: %s\n' "$*"; }

[[ -f "$DEPLOY_ENV" ]] || fail "Missing $DEPLOY_ENV"
# shellcheck disable=SC1090
source "$DEPLOY_ENV"
[[ -f "$NEYRA_HOME/.env" ]] || fail "Missing $NEYRA_HOME/.env"
# shellcheck disable=SC1090
source "$NEYRA_HOME/.env"

: "${NEYRA_PROVIDER:?Set NEYRA_PROVIDER in the client-local .env}"
: "${NEYRA_MODEL:?Set NEYRA_MODEL in the client-local .env}"
[[ "$NEYRA_PROVIDER" != REPLACE_* ]] || fail 'Set a real NEYRA_PROVIDER in the client-local .env.'
[[ "$NEYRA_MODEL" != REPLACE_* ]] || fail 'Set a real NEYRA_MODEL in the client-local .env.'

export NEYRA_HOME NEYRA_CLIENT_IMAGE NEYRA_UID NEYRA_GID NEYRA_DISPLAY_LANGUAGE NEYRA_TIMEZONE NEYRA_PIDS_LIMIT NEYRA_MEM_LIMIT
export COMPOSE_PROJECT_NAME="${NEYRA_COMPOSE_PROJECT:-neyra-client}"
CID="$(docker compose -f "$DEPLOY_DIR/docker-compose.yml" ps -q neyra)"
[[ -n "$CID" ]] || fail 'Neyra container is not running.'
BIN=/opt/neyra/.venv/bin/neyra

AUTH_STATUS="$(docker exec -it "$CID" "$BIN" auth status "$NEYRA_PROVIDER" 2>&1 || true)"
if ! grep -qiE 'logged in|authorized' <<<"$AUTH_STATUS"; then
  printf '\nProvider is not authorized. Complete the provider login inside this client container.\n'
  exec docker exec -it "$CID" "$BIN" login "$NEYRA_PROVIDER"
fi
pass "Provider $NEYRA_PROVIDER has an active auth record; run functional acceptance to prove inference."
