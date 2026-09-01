# Neyra Business Agent Network

An installable multi-agent foundation for Russian-speaking business operations.

**Neyra** is the central operator. It receives requests through one client channel, routes scoped work to isolated specialists, checks evidence, and returns one verified response. The first release includes two registered specialist profiles:

| Profile | Role | Output |
|---|---|---|
| **Neyra** | Central operator and acceptance layer | scoped task, verified response, approval gate |
| **Legal** (`legal`) | Authorized document review and legal-risk analysis | structured review with sources, assumptions, risks, and evidence |
| **Finance** (`finance`) | Financial models, reconciliations, and management reporting | reproducible calculation with source data, assumptions, and evidence |

## Architecture

```text
Telegram / Web / API
        |
        v
Neyra — central operator
        |
        +-- Legal (`legal`)
        +-- Finance (`finance`)
        |
        v
Shared contracts -> evidence -> handoff -> verified response
```

The central gateway is the only Telegram polling endpoint. Legal and Finance are isolated runtime profiles, not separate bots: they do not share Telegram credentials, sessions, memories, or client documents.

## What the system enforces

- **Explicit routing.** Specialists receive only a bounded task envelope with approved sources, allowed operations, expected evidence, and stop conditions.
- **Evidence before completion.** Neyra does not present a specialist task as complete without a structured result and evidence.
- **Approval gates.** Legal, financial, external, and irreversible actions require owner approval.
- **Client isolation.** Provider accounts, OAuth state, API keys, documents, sessions, and Telegram credentials remain inside each client deployment.
- **Russian-first operation.** The installed agent, onboarding instructions, and primary user interaction are localized for Russian-speaking teams.

## Install the test release

Use a clean Ubuntu or Debian VPS with Docker Engine and Docker Compose v2:

```bash
git clone https://github.com/Maksim87de/neyra-business-agent-network.git
cd neyra-business-agent-network
sudo ./scripts/install.sh --client-id my-company
```

The installer creates a protected persistent home, seeds Neyra plus the Legal and Finance profiles, and starts the central gateway. Provider configuration, OAuth state, model credentials, and Telegram tokens are added locally during onboarding and are never committed to GitHub.

> **Release status:** `v0.1.0` is a public installation release. Complete provider onboarding and run a real model and Telegram smoke test before inviting end users.

## Validate a checkout

```bash
make check
# If GNU Make is unavailable:
python3 scripts/validate_contracts.py
```

The checks validate portable repository contracts, the installation flow, the specialist registry, release composition, and the local model catalog.

## Repository layout

- `runtime/` — runtime overrides and product CLI integration.
- `frontend/` — dashboard localization and UI sources.
- `agents/` — portable specialist profiles, policies, and capability manifests.
- `shared/schemas/` — contracts for tasks, handoffs, decisions, risks, and evidence.
- `client-home-template/` — clean deployment template with Neyra, Legal, and Finance registration.
- `docs/` — architecture, security model, provider onboarding, and release acceptance.
- `tests/` — contract and installation fixtures.

## Security boundary

This repository contains portable source code, synthetic examples, and deployment contracts only. It must not contain client secrets, OAuth state, Telegram tokens, real documents, sessions, memories, IP addresses, backups, or production configuration.

## Links

- **Repository:** https://github.com/Maksim87de/neyra-business-agent-network
- **Release:** https://github.com/Maksim87de/neyra-business-agent-network/releases/tag/v0.1.0
