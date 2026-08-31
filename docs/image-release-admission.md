# Client image release admission

The current working reference uses a local `neyra-client` image. It cannot be distributed to a client merely because it runs on an operator host. Before any image is pushed to GHCR or used in a client deployment, the release owner records and verifies:

1. **Source boundary:** base runtime, overrides, bundled packages and fonts have a recorded owner, version and distribution permission.
2. **Build recipe:** a clean build recipe or an approved reproducible import procedure identifies the exact image digest.
3. **Data boundary:** the image contains no persistent home, `.env`, sessions, memories, knowledge, client documents, logs, OAuth state, cookies, SSH material or database files.
4. **Security scan:** image package inventory and vulnerability scan are attached to the release evidence; high-severity findings are triaged before release.
5. **Functional smoke:** the image starts with an empty synthetic home and passes `neyra gateway status`.
6. **Registry policy:** the GHCR package is private, tied to the approved repository, versioned by immutable release tag/digest and writable only by the release workflow or designated maintainers.
7. **Rollback:** the previous image digest remains available while the new release is accepted on staging.

The first distributable image is released only after this gate and the clean-VPS acceptance from `docs/client-installation-plan.md` both pass.
