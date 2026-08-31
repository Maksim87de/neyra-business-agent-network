"""Packaged local catalog for curated model picker lists.

The catalog is shipped with the Neyra Business Agent Network image. It never
fetches a manifest from GitHub or another external repository at runtime.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

_CATALOG_FILENAME = "model_catalog.json"
_SUPPORTED_SCHEMA_VERSION = 1
_catalog_cache: dict[str, Any] | None = None


def _catalog_path() -> Path:
    return Path(__file__).with_name(_CATALOG_FILENAME)


def _validate_catalog(data: Any) -> bool:
    if not isinstance(data, dict) or data.get("version") != _SUPPORTED_SCHEMA_VERSION:
        return False
    providers = data.get("providers")
    if not isinstance(providers, dict):
        return False
    for provider in providers.values():
        if not isinstance(provider, dict) or not isinstance(provider.get("models"), list):
            return False
        for model in provider["models"]:
            if not isinstance(model, dict) or not isinstance(model.get("id"), str):
                return False
    return True


def get_catalog(*, force_refresh: bool = False) -> dict[str, Any]:
    """Read the model catalog packaged in this image.

    ``force_refresh`` is retained for CLI compatibility and has no network
    behaviour. It only reloads the local file.
    """
    global _catalog_cache
    if _catalog_cache is not None and not force_refresh:
        return _catalog_cache
    try:
        data = json.loads(_catalog_path().read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    if not _validate_catalog(data):
        return {}
    _catalog_cache = data
    return data


def _provider_models(provider: str) -> list[dict[str, Any]]:
    catalog = get_catalog()
    block = catalog.get("providers", {}).get(provider)
    if not isinstance(block, dict):
        return []
    models = block.get("models")
    return models if isinstance(models, list) else []


def get_curated_openrouter_models() -> list[tuple[str, str]] | None:
    models = [
        (model["id"].strip(), str(model.get("description") or ""))
        for model in _provider_models("openrouter")
        if isinstance(model.get("id"), str) and model["id"].strip()
    ]
    return models or None


def get_curated_nous_models() -> list[str] | None:
    models = [
        model["id"].strip()
        for model in _provider_models("nous")
        if isinstance(model.get("id"), str) and model["id"].strip()
    ]
    return models or None


def reset_cache() -> None:
    global _catalog_cache
    _catalog_cache = None
