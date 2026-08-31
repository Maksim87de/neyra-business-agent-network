#!/usr/bin/env bash
# Build a private candidate image from a pinned base runtime. It does not push
# and does not create a release manifest; publishing needs a registry digest
# and clean-contour acceptance.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_IMAGE="${1:-}"
OUTPUT_IMAGE="${2:-}"

fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }
[[ "$BASE_IMAGE" == *@sha256:* || "$BASE_IMAGE" == sha256:* ]] || fail 'Base image must be an immutable digest reference.'
[[ -n "$OUTPUT_IMAGE" ]] || fail 'Usage: build-image.sh <base-image@sha256:...> <candidate-image:tag>'

docker image inspect "$BASE_IMAGE" >/dev/null 2>&1 || fail 'Pinned base image is not available locally.'
docker build --pull=false --file "$ROOT/docker/Dockerfile" --build-arg "BASE_IMAGE=$BASE_IMAGE" --tag "$OUTPUT_IMAGE" "$ROOT"
docker image inspect "$OUTPUT_IMAGE" --format 'PASS: candidate image id={{.Id}}'
