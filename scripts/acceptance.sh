#!/usr/bin/env bash
# Read-only functional acceptance. It never provisions credentials or sends external messages.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_DIR="$ROOT/deploy"
CONFIG_DIR="${NEYRA_CONFIG_DIR:-/etc/neyra-client}"
DEPLOY_ENV="$CONFIG_DIR/deploy.env"
MODE="${1:---base}"

failures=0
pass() { printf 'PASS: %s\n' "$*"; }
fail() { printf 'FAIL: %s\n' "$*" >&2; failures=$((failures + 1)); }
warn() { printf 'WARN: %s\n' "$*"; }

[[ -f "$DEPLOY_ENV" ]] || { fail "Missing $DEPLOY_ENV"; exit 1; }
# shellcheck disable=SC1090
source "$DEPLOY_ENV"
[[ -f "$NEYRA_HOME/.env" ]] || { fail "Missing $NEYRA_HOME/.env"; exit 1; }
# shellcheck disable=SC1090
source "$NEYRA_HOME/.env"
export NEYRA_HOME NEYRA_CLIENT_IMAGE NEYRA_UID NEYRA_GID NEYRA_DISPLAY_LANGUAGE NEYRA_TIMEZONE NEYRA_PIDS_LIMIT NEYRA_MEM_LIMIT
export COMPOSE_PROJECT_NAME="${NEYRA_COMPOSE_PROJECT:-neyra-client}"
CID="$(docker compose -f "$DEPLOY_DIR/docker-compose.yml" ps -q neyra 2>/dev/null || true)"
[[ -n "$CID" ]] || { fail 'Neyra container is not running.'; exit 1; }
STATUS="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$CID")"
[[ "$STATUS" == healthy ]] && pass 'Container healthcheck is healthy.' || fail "Container state is $STATUS."
docker exec "$CID" /opt/neyra/.venv/bin/neyra gateway status >/dev/null 2>&1 && pass 'Gateway status succeeded.' || fail 'Gateway status failed.'

if [[ "$MODE" == --base ]]; then
  (( failures == 0 )) || exit 1
  exit 0
fi

if [[ -z "${NEYRA_PROVIDER:-}" || "$NEYRA_PROVIDER" == REPLACE_* ]]; then
  fail 'Provider onboarding is incomplete: set NEYRA_PROVIDER in client-local .env.'
else
  case "${NEYRA_PROVIDER_AUTH_MODE:-}" in
    native)
      if AUTH_STATUS="$(docker exec "$CID" /opt/neyra/.venv/bin/neyra auth status "$NEYRA_PROVIDER" 2>&1 || true)"; grep -qiE 'logged in|authorized' <<<"$AUTH_STATUS"; then
        pass "Provider $NEYRA_PROVIDER has an active native auth record."
      else
        fail "Provider $NEYRA_PROVIDER is not authorized."
      fi
      ;;
    env)
      if [[ "${NEYRA_PROVIDER_KEY_ENV:-}" =~ ^[A-Z][A-Z0-9_]*$ ]] && docker exec "$CID" /bin/sh -c 'test -n "$(printenv "$1")"' -- "$NEYRA_PROVIDER_KEY_ENV"; then
        pass "Client-local API credential variable $NEYRA_PROVIDER_KEY_ENV is present; its value was not read."
      else
        fail 'Client-local API credential is not available to the container.'
      fi
      ;;
    custom)
      pass 'Custom provider configuration will be proved by the direct model smoke.'
      ;;
    *) fail 'Provider onboarding is incomplete: set NEYRA_PROVIDER_AUTH_MODE to native, env or custom.' ;;
  esac
fi

if [[ -z "${NEYRA_MODEL:-}" || "$NEYRA_MODEL" == REPLACE_* ]]; then
  fail 'Model onboarding is incomplete: set NEYRA_MODEL in client-local .env.'
elif [[ -n "${NEYRA_PROVIDER:-}" && "$NEYRA_PROVIDER" != REPLACE_* ]]; then
  output="$(timeout 120 docker exec "$CID" /opt/neyra/.venv/bin/neyra -z 'Reply with exactly: NEYRA_MODEL_SMOKE_OK' --provider "$NEYRA_PROVIDER" -m "$NEYRA_MODEL" 2>&1 || true)"
  grep -qx 'NEYRA_MODEL_SMOKE_OK' <<<"$output" && pass 'Direct model smoke returned the expected response.' || fail 'Direct model smoke did not return the expected response.'
fi

[[ -n "${TELEGRAM_ALLOWED_USERS:-}" ]] && pass 'Telegram allowlist is configured.' || warn 'Telegram is not configured for this client release.'
[[ -d "$NEYRA_HOME/profiles/legal" ]] && pass 'Legal runtime package is installed.' || fail 'Legal runtime package is missing.'
[[ -d "$NEYRA_HOME/profiles/finance" ]] && pass 'Finance runtime package is installed.' || fail 'Finance runtime package is missing.'
[[ -d "$NEYRA_HOME/knowledge" ]] && pass 'Knowledge root is present.' || fail 'Knowledge root is missing.'

(( failures == 0 )) || exit 1
