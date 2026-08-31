# Neyra Server Admin Mode

Server Admin Mode is the supported deployment shape for a single-tenant
customer VPS where Neyra is the trusted primary admin agent.

## Runtime Shape

- One container only: `neyra`.
- `network_mode=host`.
- `/root/.neyra` mounted to `/opt/data`.
- `/var/run/docker.sock` mounted for host-admin actions.
- Host root mounted read-only at `/host`.
- `NEYRA_DASHBOARD=1` so the dashboard runs inside the same s6 container.
- Dashboard binds `127.0.0.1:9119`; access it through SSH tunneling.
- The local OpenAI-compatible API server binds `127.0.0.1:8642`; the
  dashboard chat proxies to it through the same session gate.
- Gateway remains UID 10000/no-root.
- Host root actions go through explicit `hostctl` commands.

Do not run a separate dashboard sidecar with the same data volume. In the s6
image, profile reconciliation sees `gateway_state=running` and starts a second
gateway in that sidecar. That creates log-lock fights and can create duplicate
Telegram pollers.

## Required Env File

Create `/root/.neyra/.env` before starting the container:

```dotenv
TELEGRAM_BOT_TOKEN=...
TELEGRAM_ALLOWED_USERS=905698176,1260958591
NEYRA_INFERENCE_PROVIDER=anthropic
NEYRA_INFERENCE_MODEL=claude-opus-4-8
ANTHROPIC_BASE_URL=https://95.181.173.107:8443
ANTHROPIC_API_KEY=...
SSL_CERT_FILE=/opt/data/certs/ca-bundle.pem
API_SERVER_ENABLED=true
API_SERVER_HOST=127.0.0.1
API_SERVER_PORT=8642
API_SERVER_KEY=...
NEYRA_DASHBOARD_CHAT=1
```

For Dario-backed clients, keep the provider forced to `anthropic`. Do not rely
on `provider=auto` when any Codex/OpenAI credential pool file is present; auto
selection can pick `openai-codex` and produce 401s.

`scripts/neyra-server-admin-install.sh` appends the `API_SERVER_*` and
`NEYRA_DASHBOARD_CHAT` defaults when they are absent, including a generated
`API_SERVER_KEY`. Existing values are left in place.

## Install Or Update

For a preloaded image:

```bash
export NEYRA_IMAGE=neyra-agent:0.15.2-neyra2
scripts/neyra-server-admin-install.sh
scripts/neyra-server-admin-smoke.sh
```

For GHCR:

```bash
export NEYRA_IMAGE=ghcr.io/maksim87de/neyra-business-agent-network:0.15.2-neyra2
export NEYRA_PULL=1
scripts/neyra-server-admin-install.sh
scripts/neyra-server-admin-smoke.sh
```

The install script:

- detects the docker socket GID and passes it via `--group-add`;
- installs the host `/usr/local/bin/neyra` wrapper;
- enables the local API server and dashboard chat when missing from `.env`;
- removes legacy split dashboard containers;
- recreates the one `neyra` container with the proven Server Admin Mode flags.

## Operator Access

Open the dashboard from a workstation:

```bash
ssh -L 9119:127.0.0.1:9119 <server>
```

Then open `http://localhost:9119`.

Use the host CLI wrapper:

```bash
neyra chat
neyra status
neyra dashboard
```

Run host-admin commands from inside Neyra through:

```bash
hostctl 'systemctl status docker --no-pager'
```

`docker.sock` is root-equivalent. This is intentional for single-tenant
servers where Neyra is trusted to administer the whole machine.
