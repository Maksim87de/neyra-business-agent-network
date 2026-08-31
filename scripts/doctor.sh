#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_DIR="$ROOT/deploy"
CONFIG_DIR="${NEYRA_CONFIG_DIR:-/etc/neyra-client}"
DEPLOY_ENV="$CONFIG_DIR/deploy.env"
MODE=full
[[ "${1:-}" == '--quick' ]] && MODE=quick

failures=0
pass() { printf 'PASS: %s\n' "$*"; }
fail() { printf 'FAIL: %s\n' "$*" >&2; failures=$((failures + 1)); }

[[ -f "$DEPLOY_ENV" ]] || { fail "Missing $DEPLOY_ENV"; exit 1; }
# shellcheck disable=SC1090
source "$DEPLOY_ENV"
[[ -n "${NEYRA_HOME:-}" && -d "$NEYRA_HOME" ]] && pass 'Persistent home exists.' || fail 'Persistent home is missing.'
[[ -f "${NEYRA_HOME:-/nonexistent}/.env" ]] && pass 'Runtime environment file exists.' || fail 'Runtime environment file is missing.'
[[ "$(stat -c '%a' "$DEPLOY_ENV" 2>/dev/null || true)" == '600' ]] && pass 'Deployment environment permissions are 0600.' || fail 'Deployment environment must have mode 0600.'
[[ "$(stat -c '%a' "${NEYRA_HOME:-/nonexistent}/.env" 2>/dev/null || true)" == '600' ]] && pass 'Runtime environment permissions are 0600.' || fail 'Runtime environment must have mode 0600.'

export NEYRA_CLIENT_IMAGE NEYRA_UID NEYRA_GID NEYRA_DISPLAY_LANGUAGE
export NEYRA_TIMEZONE NEYRA_PIDS_LIMIT NEYRA_MEM_LIMIT
export COMPOSE_PROJECT_NAME="${NEYRA_COMPOSE_PROJECT:-neyra-client}"
if docker compose -f "$DEPLOY_DIR/docker-compose.yml" config -q; then pass 'Compose configuration is valid.'; else fail 'Compose configuration is invalid.'; fi
CID="$(docker compose -f "$DEPLOY_DIR/docker-compose.yml" ps -q neyra 2>/dev/null || true)"
[[ -n "$CID" ]] || { fail 'Neyra container is not running.'; exit 1; }
STATUS="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$CID")"
[[ "$STATUS" == 'healthy' ]] && pass 'Neyra container healthcheck is healthy.' || fail "Neyra container state is $STATUS."
if docker exec "$CID" /opt/neyra/.venv/bin/neyra gateway status >/dev/null 2>&1; then pass 'Gateway status command succeeded.'; else fail 'Gateway status command failed.'; fi

if [[ "$MODE" == full ]]; then
  if "$ROOT/scripts/acceptance.sh" --functional; then
    pass 'Internal functional acceptance passed.'
  else
    fail 'Internal functional acceptance failed.'
  fi
  printf 'WARN: Release admission still requires recorded synthetic specialist, knowledge, restart, rollback, isolation and real Telegram user-path evidence.\n'
fi
(( failures == 0 )) || exit 1
