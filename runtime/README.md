# Runtime source snapshot

This directory contains a **private, source-pinned snapshot** of portable Neyra runtime overrides and product CLI code. It is not a standalone runtime distribution.

## Contents

- `overrides/` — Python modules layered into a base Neyra runtime during client image build.
- `client-edition/` — client-edition CLI layer.
- `SOURCE-MANIFEST.sha256` — SHA-256 manifest generated after import.

## Explicit exclusions

The snapshot excludes images, base-runtime binaries, `.env` files, provider credentials, OAuth/cookies, sessions, databases, client home, knowledge, memories, logs, backups and generated state.

## Build boundary

The current live deployment builds these overrides on top of a separate base image. This repository does not claim that the base image is open source or redistributable. A reproducible public build requires a separately approved base-runtime source and license decision.
