#!/usr/bin/env python3
from __future__ import annotations
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = (
    'deploy/docker-compose.yml',
    'deploy/deploy.env.example',
    'client-home-template/.env.example',
    'client-home-template/README.md',
    'scripts/install.sh',
    'scripts/doctor.sh',
    'docs/deployment.md',
    'docs/operator-runbook.md',
    'docs/client-installation-plan.md',
)


def require_text(path: str, snippets: tuple[str, ...]) -> list[str]:
    text = (ROOT / path).read_text()
    return [f'{path}: missing {snippet!r}' for snippet in snippets if snippet not in text]


def main() -> int:
    missing = [path for path in REQUIRED if not (ROOT / path).is_file()]
    errors: list[str] = []
    errors.extend(require_text('deploy/docker-compose.yml', ('no-new-privileges:true', 'healthcheck:', 'client-net')))
    errors.extend(require_text('scripts/install.sh', ('Refusing to overwrite non-empty unmanaged directory', 'mode 0600', 'docker compose', '--skip-pull', 'docker image inspect', 'wait_for_healthy')))
    errors.extend(require_text('scripts/doctor.sh', ('gateway status', 'FAIL:', 'PASS:')))
    errors.extend(require_text('docs/deployment.md', ('read-only SSH deploy key', 'never copied back to GitHub')))
    if missing or errors:
        if missing:
            print('Missing deployment files:', ', '.join(missing))
        print('\n'.join(errors))
        return 1
    print('PASS: deployment-kit structure and safety contracts are valid.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
