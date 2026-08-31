# Deployment guide

## Supported target

The first client release will support a clean Ubuntu or Debian VPS with Docker Engine, Docker Compose v2, Git, at least 4 GB RAM and 20 GB free disk. Each client uses a separate server and a separate private deployment repository.

## Access

1. The operator creates a private client deployment repository from an approved release.
2. The target server receives a repository-scoped read-only SSH deploy key or a minimally scoped GitHub App installation token.
3. Clone the repository on the target server. Do not use a personal access token in a shell command, `curl`, issue, chat or `.env`.

```bash
git clone git@github.com:OWNER/CLIENT-DEPLOYMENT-REPOSITORY.git
cd CLIENT-DEPLOYMENT-REPOSITORY
sudo ./scripts/install.sh
```

The first execution creates `/etc/neyra-client/deploy.env` with mode `0600` and stops. Set `NEYRA_CLIENT_IMAGE` to the approved immutable release image or digest. The second execution creates `/opt/neyra-client/home/.env`, then stops. Set `CLIENT_ID` there and rerun the installer.

For an isolated operator staging test only, an already loaded exact image may be used with `--skip-pull`. This bypasses registry download, not image admission: record its local immutable image ID in the test evidence. Client handover always uses a released registry digest.

## Initial onboarding

After the image, runtime configuration and profile package are released, the client selects its own provider, model and auth mode in its local `.env`. Provider onboarding is performed locally on the target server:

```bash
sudo ./scripts/provider-onboarding.sh
sudo ./scripts/acceptance.sh --functional
```

Native auth is executed through the provider's own Neyra flow. API keys are written through an approved secret path directly into the client-local `.env`; the onboarding scripts only test their presence and never print values. See [provider onboarding](provider-onboarding.md) for Codex, Claude, Google, Kimi, OpenRouter and custom-provider routes.

## Health check

```bash
sudo ./scripts/doctor.sh --quick
sudo ./scripts/doctor.sh --full
```

`--full` is accepted only after the release includes synthetic Orchestrator → Legal/Finance scenarios and a verified Telegram round-trip.

## Updates and rollback

A client only updates to a named Git tag and image digest from a release note. Before updating, snapshot the client persistent home using the approved backup procedure. Rollback means restoring the prior image digest and tested persistent-state snapshot; it never means deleting the current home directory.
