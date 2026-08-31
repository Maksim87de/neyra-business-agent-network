#!/usr/bin/env python3
"""Validate the portable central identity and fixed specialist registry."""
from __future__ import annotations
import json
from pathlib import Path

REQUIRED_TEMPLATE = (
    "client-home-template/SOUL.md",
    "client-home-template/AGENTS.md",
    "client-home-template/knowledge/specialist-registry.json",
)
EXPECTED_SPECIALISTS = [
    {"profile": "legal", "display_name": "Юрист", "kanban_assignee": "legal"},
    {"profile": "finance", "display_name": "Финансист", "kanban_assignee": "finance"},
]

def validate(root: Path) -> list[str]:
    errors = [f"missing {path}" for path in REQUIRED_TEMPLATE if not (root / path).is_file()]
    registry_path = root / REQUIRED_TEMPLATE[-1]
    if errors or not registry_path.is_file():
        return errors
    try:
        registry = json.loads(registry_path.read_text())
    except json.JSONDecodeError as exc:
        return [f"invalid specialist registry JSON: {exc}"]
    if registry.get("schema_version") != 1:
        errors.append("specialist registry schema_version must be 1")
    if registry.get("central_agent") != {"profile": "default", "display_name": "Нэйра", "telegram_gateway": "central-only"}:
        errors.append("specialist registry must identify central Нэйра and central-only Telegram gateway")
    if registry.get("specialists") != EXPECTED_SPECIALISTS:
        errors.append("specialist registry must contain exactly legal/Юрист and finance/Финансист")
    for profile in ("legal", "finance"):
        config = root / "agents" / profile / "runtime" / "config.yaml"
        text = config.read_text() if config.is_file() else ""
        if f"name: {profile}" not in text or "autostart: false" not in text:
            errors.append(f"{profile} runtime profile must be registered and non-autostart")
    soul = (root / "client-home-template/SOUL.md").read_text()
    for phrase in ("встроенный Kanban", "evidence", "Telegram gateway"):
        if phrase not in soul:
            errors.append(f"central SOUL.md is missing {phrase!r}")
    return errors

def main() -> int:
    root = Path(__file__).resolve().parents[1]
    errors = validate(root)
    if errors:
        print("\n".join(f"FAIL: {error}" for error in errors)); return 1
    print("PASS: central Нэйра identity and exact legal/finance specialist registry are valid.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
