# Operator runbook

## Routine checks

```bash
sudo ./scripts/doctor.sh --quick
docker compose -f deploy/docker-compose.yml ps
docker compose -f deploy/docker-compose.yml logs --tail=200 neyra
```

Do not paste `.env` contents, session data, logs with client messages or provider credentials into a ticket or GitHub issue.

## Restart

```bash
docker compose -f deploy/docker-compose.yml up -d --remove-orphans
sudo ./scripts/doctor.sh --quick
```

Restart only affects containers. Persistent client state remains under `/opt/neyra-client/home`.

## Stop condition

Stop the change and restore the last tested image digest and persistent-home snapshot if any of these occurs: healthcheck failure after update, inability to validate gateway status, unplanned external exposure, client data in Git, or evidence that an agent crossed its access contract.

## Backup and restore

The release must provide a tested encrypted backup procedure before client handover. Backup scope includes the persistent home and required deployment configuration, excluding repository source. Restore is tested on an isolated staging host before it is offered as an operational procedure.
