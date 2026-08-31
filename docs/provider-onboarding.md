# Provider and model onboarding

The runtime installation and inference admission are separate gates. A healthy container or connected Telegram bot does not prove a usable model.

## Supported ownership models

1. **Client-owned provider:** the client authorizes a provider inside its own persistent home and owns usage/billing.
2. **Managed Neyra provider:** a separately approved managed-provider integration supplies scoped usage and billing limits.

Never copy an operator's OAuth/auth file or a provider credential from another contour.

## Operator flow

```bash
sudo ./scripts/install.sh
sudo ./scripts/provider-onboarding.sh
sudo ./scripts/acceptance.sh --functional
```

`provider-onboarding.sh` reads the selected `NEYRA_PROVIDER` and `NEYRA_MODEL` from the client-local `.env`, checks the provider in the running container and opens the provider's native interactive login only if it is missing. It does not print or write credentials to Git.

`acceptance.sh --functional` requires a real provider authorization and a direct inference response with a fixed marker. It reports a missing provider or model as a blocking state, not as a successful installation.
