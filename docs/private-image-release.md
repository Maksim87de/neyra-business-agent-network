# Private image build and publication

## Build boundary

The release image contains only the verified base runtime plus source-controlled overrides. It never contains a client home, `.env`, provider auth, Telegram state, memory, sessions, knowledge, logs or a deploy key.

## Candidate build

```bash
./scripts/build-image.sh \
  'BASE_IMAGE@sha256:...' \
  'ghcr.io/maksim87de/neyra-business-agent-network-candidate:0.1.0-rc.1'
```

A candidate is not a release. Before publishing, verify the image contains no auth artifact, run the clean-contour installer, provision a fresh test provider account or approved test authorization, and complete `docs/release-acceptance.md`.

## Publication

Publish only after GitHub Packages access is approved. Record the registry-returned immutable digest, not a mutable tag, in `release/release-manifest.json`. The client deployment references that digest exactly.
