# A release is always derived from a verified immutable Neyra client runtime.
ARG BASE_IMAGE
FROM ${BASE_IMAGE}

# Only reviewed, versioned product overrides enter the derived image. Client
# identity, auth, memory, sessions, skills state and knowledge are persistent
# runtime data mounted at /opt/data and are excluded by .dockerignore.
COPY runtime/overrides/agent/ /opt/neyra/agent/
COPY runtime/overrides/gateway/ /opt/neyra/gateway/
COPY runtime/overrides/neyra_cli/ /opt/neyra/neyra_cli/
COPY runtime/overrides/tools/ /opt/neyra/tools/
COPY runtime/overrides/model_tools.py /opt/neyra/model_tools.py
COPY runtime/overrides/toolsets.py /opt/neyra/toolsets.py
COPY runtime/client-edition/cli.py /opt/neyra/neyra_cli/client_edition.py

LABEL org.opencontainers.image.title="Neyra Business Agent Network" \
      org.opencontainers.image.source="https://github.com/Maksim87de/neyra-business-agent-network" \
      org.neyra.distribution="private"
