# Source admission policy

A file may enter this repository only when it passes all gates below.

1. **Portability:** it does not require a client home, live server path, production secret, session, database or runtime state.
2. **Isolation:** it cannot carry another client’s data, identity, Telegram channel or integration configuration.
3. **Provenance:** its origin and distribution terms are known. Until then it is labelled `private-only: provenance pending`.
4. **Technical review:** it is source code or a source manifest; caches, compiled distributions, archives, virtual environments and backups are excluded.
5. **Security review:** a scan reports no real credential pattern, private key, token, client identifier, IP/domain route or personal data.
6. **Verification:** a checksum manifest is regenerated after every import or cleanup.

An allowlisted source snapshot is not automatically a deployable release. Runtime build, inference setup, channels and client data stay separate acceptance layers.
