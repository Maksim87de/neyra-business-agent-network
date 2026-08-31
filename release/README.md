# Release contract

A client release is valid only when this directory contains a completed `release-manifest.json` that validates against `release-manifest.schema.json`.

The committed placeholders deliberately block a release. The release pipeline must replace them from a clean build with:

- exact annotated Git tag and 40-character commit;
- immutable private registry image digest;
- exported list and SHA-256 of bundled skills;
- the three included runtime agents: `orchestrator`, `legal`, `finance`;
- evidence for base runtime, provider/model, Telegram, knowledge, specialist routing, restart, rollback and isolation.

No credential, client data, bot identity, document, session, memory, IP address or backup belongs in this directory.
