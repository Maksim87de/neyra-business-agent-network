# Architecture

1. Orchestrator converts a request into a task envelope.
2. Specialist receives only sources and operations named in it.
3. Specialist returns a result with evidence.
4. Orchestrator validates evidence before presenting a result.

Client state, data and credentials belong to isolated deployments, not to this repository.
