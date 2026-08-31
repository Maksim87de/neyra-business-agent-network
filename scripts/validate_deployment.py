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
    'docs/provider-onboarding.md',
    'docs/knowledge-onboarding.md',
    'docs/release-acceptance.md',
    'docs/private-image-release.md',
    'scripts/provider-onboarding.sh',
    'scripts/acceptance.sh',
    'scripts/build-image.sh',
    'docker/Dockerfile',
    'docker/.dockerignore',
)


def require_text(path: str, snippets: tuple[str, ...]) -> list[str]:
    text = (ROOT / path).read_text()
    return [f'{path}: missing {snippet!r}' for snippet in snippets if snippet not in text]


def main() -> int:
    missing = [path for path in REQUIRED if not (ROOT / path).is_file()]
    errors: list[str] = []
    errors.extend(require_text('deploy/docker-compose.yml', ('command: ["gateway", "run"]', 'no-new-privileges:true', 'healthcheck:', 'client-net')))
    errors.extend(require_text('scripts/install.sh', ('Refusing to overwrite non-empty unmanaged directory', 'mode 0600', 'docker compose', '--skip-pull', 'docker image inspect', 'wait_for_healthy', 'legal finance', 'NEYRA_PROVIDER and NEYRA_MODEL')))
    errors.extend(require_text('scripts/doctor.sh', ('gateway status', 'acceptance.sh', 'COMPOSE_PROJECT_NAME', 'FAIL:', 'PASS:')))
    errors.extend(require_text('scripts/provider-onboarding.sh', ('NEYRA_PROVIDER', 'NEYRA_MODEL', 'auth status', 'login')))
    errors.extend(require_text('scripts/acceptance.sh', ('NEYRA_MODEL_SMOKE_OK', 'auth status', 'Legal runtime package', 'Finance runtime package', 'Knowledge root')))
    errors.extend(require_text('scripts/build-image.sh', ('immutable digest reference', 'docker build', 'does not push')))
    errors.extend(require_text('docker/Dockerfile', ('ARG BASE_IMAGE', 'FROM ${BASE_IMAGE}', '/opt/neyra/agent/', '/opt/neyra/neyra_cli/')))
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
