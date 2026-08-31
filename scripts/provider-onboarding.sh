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
: "${NEYRA_PROVIDER_AUTH_MODE:?Set NEYRA_PROVIDER_AUTH_MODE to native, env or custom in the client-local .env}"
[[ "$NEYRA_PROVIDER" != REPLACE_* ]] || fail 'Set a real NEYRA_PROVIDER in the client-local .env.'
[[ "$NEYRA_MODEL" != REPLACE_* ]] || fail 'Set a real NEYRA_MODEL in the client-local .env.'
[[ "$NEYRA_PROVIDER_AUTH_MODE" =~ ^(native|env|custom)$ ]] || fail 'NEYRA_PROVIDER_AUTH_MODE must be native, env or custom.'
[[ "$NEYRA_PROVIDER" =~ ^[A-Za-z0-9._:-]+$ ]] || fail 'NEYRA_PROVIDER contains unsupported characters.'
[[ "$NEYRA_MODEL" =~ ^[A-Za-z0-9._:/@+-]+$ ]] || fail 'NEYRA_MODEL contains unsupported characters.'

export NEYRA_HOME NEYRA_CLIENT_IMAGE NEYRA_UID NEYRA_GID NEYRA_DISPLAY_LANGUAGE NEYRA_TIMEZONE NEYRA_PIDS_LIMIT NEYRA_MEM_LIMIT
export COMPOSE_PROJECT_NAME="${NEYRA_COMPOSE_PROJECT:-neyra-client}"
CID="$(docker compose -f "$DEPLOY_DIR/docker-compose.yml" ps -q neyra)"
[[ -n "$CID" ]] || fail 'Neyra container is not running.'
BIN=/opt/neyra/.venv/bin/neyra

case "$NEYRA_PROVIDER_AUTH_MODE" in
  native)
    AUTH_STATUS="$(docker exec -it "$CID" "$BIN" auth status "$NEYRA_PROVIDER" 2>&1 || true)"
    if ! grep -qiE 'logged in|authorized' <<<"$AUTH_STATUS"; then
      printf '\nProvider is not authorized. Complete the provider-native flow inside this client container.\n'
      docker exec -it "$CID" "$BIN" auth add "$NEYRA_PROVIDER"
    fi
    AUTH_STATUS="$(docker exec "$CID" "$BIN" auth status "$NEYRA_PROVIDER" 2>&1 || true)"
    grep -qiE 'logged in|authorized' <<<"$AUTH_STATUS" || fail "Provider $NEYRA_PROVIDER did not create an active native auth record."
    ;;
  env)
    : "${NEYRA_PROVIDER_KEY_ENV:?Set NEYRA_PROVIDER_KEY_ENV to the client-local API-key variable name.}"
    [[ "$NEYRA_PROVIDER_KEY_ENV" =~ ^[A-Z][A-Z0-9_]*$ ]] || fail 'NEYRA_PROVIDER_KEY_ENV must be an uppercase environment-variable name.'
    docker exec "$CID" /bin/sh -c 'test -n "$(printenv "$1")"' -- "$NEYRA_PROVIDER_KEY_ENV" \
      || fail "The client-local secret variable $NEYRA_PROVIDER_KEY_ENV is absent or empty in the container."
    pass "Client-local API credential variable $NEYRA_PROVIDER_KEY_ENV is available; its value was not read."
    ;;
  custom)
    pass 'Custom provider selected. Its endpoint and credential configuration remain client-local; functional acceptance is the authorization proof.'
    ;;
esac

CONFIG_TEMPLATE="$NEYRA_HOME/config.yaml.example"
CONFIG_FILE="$NEYRA_HOME/config.yaml"
[[ -f "$CONFIG_TEMPLATE" ]] || fail "Missing $CONFIG_TEMPLATE"
python3 - "$CONFIG_TEMPLATE" "$CONFIG_FILE" "$NEYRA_PROVIDER" "$NEYRA_MODEL" <<'PY'
from pathlib import Path
import sys

template = Path(sys.argv[1])
target = Path(sys.argv[2])
provider = sys.argv[3]
model = sys.argv[4]
text = template.read_text(encoding='utf-8')
text = text.replace('REPLACE_WITH_PROVIDER', provider).replace('REPLACE_WITH_MODEL', model)
if 'REPLACE_WITH_' in text:
    raise SystemExit('provider config template was not fully populated')
Path(target).write_text(text, encoding='utf-8')
PY
chown "$NEYRA_UID:$NEYRA_GID" "$CONFIG_FILE"
chmod 0640 "$CONFIG_FILE"
docker compose -f "$DEPLOY_DIR/docker-compose.yml" restart neyra >/dev/null
pass "Client-owned provider $NEYRA_PROVIDER and model $NEYRA_MODEL were applied. Run functional acceptance to prove inference."
