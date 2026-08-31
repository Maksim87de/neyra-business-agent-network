# Provenance register

## Imported private foundation snapshot

| Layer | Repository path | Imported source class | Public distribution status |
|---|---|---|---|
| Runtime overrides | `runtime/overrides/` | Python override source used by the Neyra client runtime | **Private only: provenance review pending** |
| Client edition CLI | `runtime/client-edition/cli.py` | Product-specific CLI source | **Private only: provenance review pending** |
| Dashboard localization | `frontend/` | Localization hooks, skills translation map and dashboard source | **Private only: provenance review pending** |
| Agent packs | `agents/` | Newly created portable product manifests, policies and contracts | May be reviewed for public distribution separately |

The snapshot was imported on `2026-08-31T02:08:59Z` from approved operator-accessible build sources after excluding client home, runtime state, credentials, secrets, tokens, sessions, databases, logs, backups and generated dashboard distributions.

## Evidence recorded

- `runtime/SOURCE-MANIFEST.sha256` and `frontend/SOURCE-MANIFEST.sha256` pin the imported file content.
- The source roots were not Git worktrees and did not include a license or notice file at inspection time.
- A filename/content scan found no target client identifiers and no matches for the baseline patterns for private keys, GitHub tokens, AWS keys or Telegram bot tokens.

## Distribution rule

No imported runtime or frontend source may move from this private repository to a public repository, release archive, package registry or client delivery bundle until every included component has a documented origin, applicable license and required attribution. A code change made inside this repository does not establish ownership of an upstream or derivative component.
