# Client handover

The client receives an isolated private deployment repository, an approved release tag, a server-specific deployment guide and a support contact path.

The client does not receive another customer's data, credentials, memory, knowledge, Telegram session, webhook, backup, IP address or history.

Before handover, the operator records:

- exact Git tag and Docker image digest;
- server owner and access boundary;
- verified `doctor --full` result;
- Telegram acceptance result for the client channel;
- configured agent packages and their versions;
- backup and rollback method;
- support and update window.

Handover is accepted only after the client can use the intended channel and the operator has evidence that the deployed environment is isolated from all other client environments.
