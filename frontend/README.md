# Dashboard localization source

This directory contains the portable dashboard localization layer:

- `web/` — dashboard source used for localization and branding work;
- `sitecustomize.py` — runtime localization hook;
- `skills_ru.json` — Russian skill display map;
- `SOURCE-MANIFEST.sha256` — SHA-256 manifest generated after import.

Generated `web_dist` artifacts and their historical backup copies are deliberately excluded. Build dependencies and the upstream dashboard provenance must be recorded before this source is distributed outside the private repository.
