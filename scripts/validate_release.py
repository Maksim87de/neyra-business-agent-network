#!/usr/bin/env python3
"""Validate portable release composition without inspecting credentials."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = (
    'release/release-manifest.schema.json',
    'release/skills-manifest.json',
    'release/README.md',
    'scripts/provider-onboarding.sh',
    'scripts/acceptance.sh',
    'docs/provider-onboarding.md',
    'docs/knowledge-onboarding.md',
    'docs/release-acceptance.md',
    'shared/schemas/handoff.schema.json',
    'shared/schemas/knowledge-ingestion.schema.json',
    'agents/legal/runtime/SOUL.md',
    'agents/legal/runtime/AGENTS.md',
    'agents/legal/skills/legal-triage/SKILL.md',
    'agents/finance/runtime/SOUL.md',
    'agents/finance/runtime/AGENTS.md',
    'agents/finance/skills/financial-triage/SKILL.md',
)


def main() -> int:
    errors: list[str] = []
    for rel in REQUIRED:
        if not (ROOT / rel).is_file():
            errors.append(f'missing {rel}')
    for rel in ('release/release-manifest.schema.json', 'release/skills-manifest.json', 'shared/schemas/handoff.schema.json', 'shared/schemas/knowledge-ingestion.schema.json'):
        try:
            json.loads((ROOT / rel).read_text())
        except (OSError, json.JSONDecodeError) as exc:
            errors.append(f'invalid JSON {rel}: {exc}')
    for agent in ('legal', 'finance'):
        runtime = ROOT / 'agents' / agent / 'runtime'
        if not (runtime / 'SOUL.md').is_file() or not (runtime / 'AGENTS.md').is_file():
            errors.append(f'{agent} is not a bootable profile package')
    for rel in ('scripts/provider-onboarding.sh', 'scripts/acceptance.sh'):
        text = (ROOT / rel).read_text()
        for expected in ('NEYRA_PROVIDER', 'NEYRA_MODEL', 'NEYRA_PROVIDER_AUTH_MODE'):
            if expected not in text:
                errors.append(f'{rel}: missing provider admission control {expected!r}')
    skills = json.loads((ROOT / 'release/skills-manifest.json').read_text())
    if skills.get('status') != 'release-blocked':
        entries = skills.get('skills')
        if not isinstance(entries, list) or not entries:
            errors.append('skills manifest is marked releasable without entries')
    if errors:
        print('\n'.join(f'FAIL: {error}' for error in errors))
        return 1
    digest = hashlib.sha256((ROOT / 'release/skills-manifest.json').read_bytes()).hexdigest()
    print(f'PASS: release composition is structurally valid; skills-manifest sha256={digest}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
