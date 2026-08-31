# Security and isolation model

## Default deny
An agent receives no source, tool or external action unless it is named in the task envelope and allowed by its profile.

## Data separation
Each client deployment uses its own runtime, storage, secrets, channels and webhooks. This repository contains neither production state nor a path to it.

## Human checkpoints
External, financial, irreversible and legally material actions require owner approval. Evidence is required for every completion claim.
