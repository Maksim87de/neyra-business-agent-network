#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/bin"
cat >"$TMP/bin/docker" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
if [[ "$1" == compose ]]; then
  if [[ " $* " == *' ps -q neyra '* ]]; then
    printf 'synthetic-neyra\n'
  fi
  exit 0
fi
if [[ "$1" == exec ]]; then
  if [[ " $* " == *' auth status '* ]]; then
    printf 'logged in\n'
  fi
  exit 0
fi
exit 0
EOF
chmod +x "$TMP/bin/docker"
export PATH="$TMP/bin:$PATH"
export NEYRA_CONFIG_DIR="$TMP/etc"
export NEYRA_HOME_DIR="$TMP/home"

FIRST_LOG="$TMP/first-install.log"
if "$ROOT/scripts/install.sh" --prepare-only >"$FIRST_LOG" 2>&1; then
  echo 'expected initial installer configuration checkpoint to stop' >&2
  exit 1
fi
if [[ ! -f "$TMP/etc/deploy.env" ]]; then
  cat "$FIRST_LOG" >&2
  exit 1
fi
[[ "$(stat -c '%a' "$TMP/etc/deploy.env")" == 600 ]]
sed -i 's|ghcr.io/maksim87de/neyra-business-agent-network:v0.1.0-test|registry.example/neyra@sha256:test|' "$TMP/etc/deploy.env"
"$ROOT/scripts/install.sh" --prepare-only --client-id synthetic-client >/dev/null
[[ -f "$TMP/home/.env" ]]
[[ "$(stat -c '%a' "$TMP/home/.env")" == 600 ]]
[[ -f "$TMP/home/config.yaml.example" ]]
[[ -f "$TMP/home/SOUL.md" ]]
[[ -f "$TMP/home/AGENTS.md" ]]
[[ -f "$TMP/home/knowledge/specialist-registry.json" ]]
python3 - "$TMP/home/knowledge/specialist-registry.json" <<'PYREG'
import json, sys
registry = json.load(open(sys.argv[1]))
assert registry["central_agent"] == {"profile":"default", "display_name":"Нэйра", "telegram_gateway":"central-only"}
assert registry["specialists"] == [{"profile":"legal", "display_name":"Юрист", "kanban_assignee":"legal"}, {"profile":"finance", "display_name":"Финансист", "kanban_assignee":"finance"}]
PYREG
[[ -f "$TMP/home/profiles/legal/SOUL.md" ]]
[[ -f "$TMP/home/profiles/legal/AGENTS.md" ]]
[[ -f "$TMP/home/profiles/legal/skills/legal-triage/SKILL.md" ]]
[[ -f "$TMP/home/profiles/finance/SOUL.md" ]]
[[ -f "$TMP/home/profiles/finance/AGENTS.md" ]]
[[ -f "$TMP/home/profiles/finance/skills/financial-triage/SKILL.md" ]]
[[ -d "$TMP/home/knowledge" ]]
sed -i 's|REPLACE_WITH_CLIENT_SLUG|synthetic-client|' "$TMP/home/.env"
sed -i 's|REPLACE_WITH_PROVIDER|openai-codex|' "$TMP/home/.env"
sed -i 's|REPLACE_WITH_MODEL|gpt-5.6-terra|' "$TMP/home/.env"
sed -i 's|REPLACE_WITH_NATIVE_ENV_OR_CUSTOM|native|' "$TMP/home/.env"
"$ROOT/scripts/install.sh" --prepare-only >/dev/null
[[ -f "$TMP/home/.neyra-client-managed" ]]
"$ROOT/scripts/provider-onboarding.sh" >/dev/null
grep -Fx '  provider: openai-codex' "$TMP/home/config.yaml" >/dev/null
grep -Fx '  default: gpt-5.6-terra' "$TMP/home/config.yaml" >/dev/null
echo 'PASS: installer checkpoints, specialist profiles and protected persistent-home setup are valid.'
