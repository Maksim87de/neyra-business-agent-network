#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_DIR="$ROOT/deploy"
CONFIG_DIR="${NEYRA_CONFIG_DIR:-/etc/neyra-client}"
HOME_DIR="${NEYRA_HOME_DIR:-/opt/neyra-client/home}"
DEPLOY_ENV="$CONFIG_DIR/deploy.env"
START=1
PULL=1

usage() {
  cat <<'EOF'
Usage: sudo ./scripts/install.sh [--prepare-only] [--skip-pull]

Run from an approved private deployment checkout. This script creates protected
host directories and starts only an approved image configured in deploy.env.
It never downloads source with a personal access token and never writes secrets
to Git.

--skip-pull is only for an isolated staging host where the exact approved image
is already present locally. A client release must normally pull its immutable
image digest from the approved registry.
EOF
}

fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }
info() { printf 'INFO: %s\n' "$*"; }

wait_for_healthy() {
  local cid status deadline
  cid="$(docker compose -f "$DEPLOY_DIR/docker-compose.yml" ps -q neyra)"
  [[ -n "$cid" ]] || fail 'Neyra container was not created.'
  deadline=$((SECONDS + 90))
  while (( SECONDS < deadline )); do
    status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$cid")"
    case "$status" in
      healthy)
        info 'Neyra container healthcheck is healthy.'
        return 0
        ;;
      exited|dead)
        fail "Neyra container stopped before becoming healthy (state: $status)."
        ;;
    esac
    sleep 2
  done
  fail "Timed out waiting for Neyra container healthcheck (last state: $status)."
}

while (($#)); do
  case "$1" in
    --prepare-only) START=0 ;;
    --skip-pull) PULL=0 ;;
    -h|--help) usage; exit 0 ;;
    *) fail "Unknown option: $1" ;;
  esac
  shift
done

if [[ ${EUID} -ne 0 && ( "$CONFIG_DIR" == /etc/* || "$HOME_DIR" == /opt/* ) ]]; then
  fail 'Run with sudo for the standard /etc and /opt client paths.'
fi
[[ -f "$DEPLOY_DIR/docker-compose.yml" ]] || fail 'deploy/docker-compose.yml is missing.'
command -v docker >/dev/null || fail 'Docker is required. Install Docker Engine and Docker Compose v2, then retry.'
docker compose version >/dev/null 2>&1 || fail 'Docker Compose v2 is required.'

install -d -m 0750 "$CONFIG_DIR"
if [[ ! -f "$DEPLOY_ENV" ]]; then
  install -m 0600 "$DEPLOY_DIR/deploy.env.example" "$DEPLOY_ENV"
  # Keep an explicitly selected non-default home consistent with the generated
  # host-only config. Normal installations retain the documented default path.
  if [[ "$HOME_DIR" != '/opt/neyra-client/home' ]]; then
    python3 - "$DEPLOY_ENV" "$HOME_DIR" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
home = sys.argv[2]
text = path.read_text()
needle = 'NEYRA_HOME=/opt/neyra-client/home\n'
if needle not in text:
    raise SystemExit('deploy.env template has no expected NEYRA_HOME entry')
path.write_text(text.replace(needle, f'NEYRA_HOME={home}\n', 1))
PY
  fi
  fail "Created $DEPLOY_ENV. Set NEYRA_CLIENT_IMAGE to an approved release image, then run again."
fi
chmod 0600 "$DEPLOY_ENV"
# shellcheck disable=SC1090
source "$DEPLOY_ENV"
[[ -n "${NEYRA_CLIENT_IMAGE:-}" && "$NEYRA_CLIENT_IMAGE" != 'REPLACE_WITH_APPROVED_IMAGE' ]] || fail 'NEYRA_CLIENT_IMAGE must reference an approved immutable client release.'
[[ "${NEYRA_HOME:-}" == "$HOME_DIR" ]] || fail "NEYRA_HOME in deploy.env must be $HOME_DIR for this installer."

if [[ -d "$HOME_DIR" && -e "$HOME_DIR/.neyra-client-managed" ]]; then
  info "Using existing managed persistent home: $HOME_DIR"
elif [[ -d "$HOME_DIR" && -n "$(find "$HOME_DIR" -mindepth 1 -maxdepth 1 -print -quit)" ]]; then
  fail "Refusing to overwrite non-empty unmanaged directory: $HOME_DIR"
else
  install -d -m 0750 "$HOME_DIR"
  tar -C "$ROOT/client-home-template" -cf - . | tar -C "$HOME_DIR" -xf -
  install -m 0600 "$ROOT/client-home-template/.env.example" "$HOME_DIR/.env"
  install -m 0640 "$ROOT/client-home-template/config.yaml.example" "$HOME_DIR/config.yaml.example"

  # A release always seeds its portable specialist profiles into a new client
  # home. They receive no sessions, memories, credentials, client documents or
  # state from another contour; only reviewed profile instructions and skills.
  for agent in legal finance; do
    install -d -m 0750 "$HOME_DIR/profiles/$agent"
    tar -C "$ROOT/agents/$agent/runtime" -cf - . | tar -C "$HOME_DIR/profiles/$agent" -xf -
    install -d -m 0750 "$HOME_DIR/profiles/$agent/skills"
    tar -C "$ROOT/agents/$agent/skills" -cf - . | tar -C "$HOME_DIR/profiles/$agent/skills" -xf -
  done
  install -d -m 0750 "$HOME_DIR/knowledge"
  touch "$HOME_DIR/.neyra-client-managed"
  chmod 0600 "$HOME_DIR/.env"
  info "Created persistent home with isolated legal and finance runtime packages. Set CLIENT_ID, provider, model and auth mode in $HOME_DIR/.env."
fi

if grep -q '^CLIENT_ID=REPLACE_WITH_CLIENT_SLUG$' "$HOME_DIR/.env"; then
  fail "Set CLIENT_ID in $HOME_DIR/.env; the file remains local with mode 0600."
fi

export NEYRA_HOME="$HOME_DIR"
export NEYRA_CLIENT_IMAGE
export COMPOSE_PROJECT_NAME="${NEYRA_COMPOSE_PROJECT:-neyra-client}"
export NEYRA_UID="${NEYRA_UID:-10000}"
export NEYRA_GID="${NEYRA_GID:-10000}"
export NEYRA_DISPLAY_LANGUAGE="${NEYRA_DISPLAY_LANGUAGE:-ru}"
export NEYRA_TIMEZONE="${NEYRA_TIMEZONE:-UTC}"
export NEYRA_PIDS_LIMIT="${NEYRA_PIDS_LIMIT:-512}"
export NEYRA_MEM_LIMIT="${NEYRA_MEM_LIMIT:-4g}"

docker compose -f "$DEPLOY_DIR/docker-compose.yml" config -q
info 'Compose configuration is valid.'
if (( START == 0 )); then
  info 'Preparation complete; no containers were started.'
  exit 0
fi

if (( PULL == 1 )); then
  docker compose -f "$DEPLOY_DIR/docker-compose.yml" pull
else
  docker image inspect "$NEYRA_CLIENT_IMAGE" >/dev/null 2>&1 || fail "--skip-pull requires NEYRA_CLIENT_IMAGE to exist locally."
  info 'Using a preloaded staging image; registry pull was skipped.'
fi
# The runtime process runs as the configured unprivileged UID and must be able
# to read its local environment and write its own client home.
chown -R "$NEYRA_UID:$NEYRA_GID" "$HOME_DIR"
docker compose -f "$DEPLOY_DIR/docker-compose.yml" up -d --remove-orphans
wait_for_healthy
"$ROOT/scripts/doctor.sh" --quick
info 'Container started. Complete approved Neyra onboarding on this server before inviting end users.'
