# Persistent client home template

This directory seeds an empty persistent home at `/opt/neyra-client/home`.

It intentionally contains no client identity, prompts, memories, knowledge, sessions, logs, OAuth state, Telegram state, model credentials or documents. The initial Neyra configuration is created only on the target server by the approved release onboarding flow.

`profiles/` is reserved for isolated specialist homes. The legal and finance packages in `agents/` define the portable contracts and policies. Their runtime configuration is installed only after the base runtime release and onboarding are verified.
