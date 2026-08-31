"""Content-safe runtime telemetry for prompts and provider tool payloads.

Only deterministic fingerprints, lengths, tool names, and lifecycle metadata are
logged. Prompt text and tool arguments are deliberately never attached to a log
record.
"""

from __future__ import annotations

import hashlib
import json
import logging
from typing import Any

logger = logging.getLogger(__name__)


def _emit_safe_event(extra: dict[str, Any]) -> None:
    """Persist safe structured fields even when the log formatter ignores extras."""
    serialized = json.dumps(
        extra,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    logger.info("runtime_observability %s", serialized, extra=extra)


def prompt_fingerprint(prompt: str | None) -> str:
    """Return a deterministic short SHA-256 fingerprint for prompt text."""
    value = prompt if isinstance(prompt, str) else ""
    return hashlib.sha256(value.encode("utf-8", errors="surrogatepass")).hexdigest()[:16]


def content_hash(content: str | None) -> str:
    """Return a full SHA-256 hash for content provenance and audit trails."""
    value = content if isinstance(content, str) else ""
    return hashlib.sha256(value.encode("utf-8", errors="surrogatepass")).hexdigest()


def log_prompt_event(
    event: str,
    prompt: str | None,
    *,
    base_prompt: str | None = None,
    ephemeral_prompt: str | None = None,
    **fields: Any,
) -> None:
    """Emit structured prompt lifecycle telemetry without prompt content."""
    value = prompt if isinstance(prompt, str) else ""
    extra = {
        "event": event,
        "prompt_fingerprint": prompt_fingerprint(value),
        "prompt_chars": len(value),
        "prompt_present": bool(value),
    }
    if base_prompt is not None:
        extra["base_fingerprint"] = prompt_fingerprint(base_prompt)
        extra["base_chars"] = len(base_prompt)
    if ephemeral_prompt is not None:
        extra["ephemeral_fingerprint"] = prompt_fingerprint(ephemeral_prompt)
        extra["ephemeral_chars"] = len(ephemeral_prompt)
    extra["ephemeral_present"] = bool(ephemeral_prompt)
    extra.update(fields)
    _emit_safe_event(extra)


def _content_text(content: Any) -> str:
    """Extract provider-visible text from a string or structured text blocks."""
    if isinstance(content, str):
        return content
    if not isinstance(content, list):
        return ""

    parts: list[str] = []
    for block in content:
        if isinstance(block, str):
            parts.append(block)
            continue
        if not isinstance(block, dict):
            continue
        value = block.get("text")
        if not isinstance(value, str):
            value = block.get("content")
        if isinstance(value, str):
            parts.append(value)
    return "".join(parts)


def prompt_from_payload(payload: Any) -> str:
    """Extract the final provider-facing system/developer prompt from kwargs."""
    if not isinstance(payload, dict):
        return ""

    instructions = payload.get("instructions")
    if isinstance(instructions, str):
        return instructions

    if "system" in payload:
        return _content_text(payload.get("system"))

    messages = payload.get("messages")
    if isinstance(messages, list):
        parts: list[str] = []
        for message in messages:
            if not isinstance(message, dict):
                continue
            if message.get("role") not in {"system", "developer"}:
                break
            parts.append(_content_text(message.get("content")))
        return "".join(parts)
    return ""


def _tool_names(tool_definitions: Any) -> set[str]:
    """Extract names from registry sets and provider-specific tool schemas."""
    if not isinstance(tool_definitions, (list, tuple, set, frozenset)):
        return set()

    names: set[str] = set()
    for tool in tool_definitions:
        if isinstance(tool, str) and tool:
            names.add(tool)
            continue
        if not isinstance(tool, dict):
            continue
        function = tool.get("function")
        tool_spec = tool.get("toolSpec")
        candidates = (
            function.get("name") if isinstance(function, dict) else None,
            tool_spec.get("name") if isinstance(tool_spec, dict) else None,
            tool.get("name"),
        )
        name = next((value for value in candidates if isinstance(value, str) and value), None)
        if name:
            names.add(name)
    return names


def _normalize_exposed_names(
    exposed_names: set[str],
    resolved_names: set[str],
    *,
    api_mode: str,
    anthropic_oauth: bool,
) -> set[str]:
    """Map provider-only tool aliases back to their runtime registry names."""
    if api_mode != "anthropic_messages" or not anthropic_oauth:
        return exposed_names

    normalized: set[str] = set()
    for name in exposed_names:
        if name in resolved_names:
            normalized.add(name)
        elif name.startswith("mcp_") and name[4:] in resolved_names:
            normalized.add(name[4:])
        else:
            normalized.add(name)
    return normalized


def log_tool_payload_event(
    resolved_tools: Any,
    payload: Any,
    *,
    api_mode: str,
    expected_tools: Any = None,
    event: str = "tool_payload.dispatched",
    anthropic_oauth: bool = False,
    **fields: Any,
) -> None:
    """Report the tool surface at the exact provider dispatch boundary."""
    expected_names = _tool_names(expected_tools if expected_tools is not None else resolved_tools)
    resolved_names = _tool_names(resolved_tools)
    payload_tools: Any = None
    if isinstance(payload, dict):
        payload_tools = payload.get("tools")
        tool_config = payload.get("toolConfig")
        if payload_tools is None and isinstance(tool_config, dict):
            payload_tools = tool_config.get("tools")
    raw_exposed_names = _tool_names(payload_tools)
    exposed_names = _normalize_exposed_names(
        raw_exposed_names,
        resolved_names,
        api_mode=api_mode,
        anthropic_oauth=anthropic_oauth,
    )
    tool_control_fields = sorted(
        key
        for key in ("tool_choice", "parallel_tool_calls")
        if isinstance(payload, dict) and key in payload
    )
    extra = {
        "event": event,
        "api_mode": api_mode,
        "expected_tools": sorted(expected_names),
        "resolved_tools": sorted(resolved_names),
        "exposed_tools": sorted(exposed_names),
        "provider_tool_names": sorted(raw_exposed_names),
        "missing_tools": sorted(expected_names - resolved_names),
        "transport_dropped_tools": sorted(resolved_names - exposed_names),
        "unexpected_exposed_tools": sorted(exposed_names - resolved_names),
        "tool_control_fields": tool_control_fields,
    }
    extra.update(fields)
    _emit_safe_event(extra)


def log_tool_call_event(
    *,
    tool_name: str,
    duration_ms: int,
    succeeded: bool,
    **fields: Any,
) -> None:
    """Emit one content-safe event per completed dispatch for metrics aggregation."""
    extra = {
        "event": "tool_call.completed",
        "tool_name": tool_name,
        "duration_ms": max(0, int(duration_ms)),
        "succeeded": bool(succeeded),
    }
    extra.update(fields)
    _emit_safe_event(extra)


def log_runtime_outcome_event(
    *,
    outcome: str,
    confirmed: bool,
    **fields: Any,
) -> None:
    """Record user-outcome evidence separately from tool transport success."""
    extra = {"event": "user_outcome", "outcome": outcome, "confirmed": bool(confirmed)}
    extra.update(fields)
    _emit_safe_event(extra)


def log_tool_result_transform_event(
    *,
    tool_name: str,
    plugin_name: str,
    original_result: str,
    final_result: str,
    applied: bool,
    mode: str,
    reason: str = "",
    **fields: Any,
) -> None:
    """Log a content-safe, append-only audit event for tool-result transformation."""
    extra = {
        "event": "tool_result.transform",
        "tool_name": tool_name,
        "plugin_name": plugin_name,
        "original_result_hash": content_hash(original_result),
        "final_result_hash": content_hash(final_result),
        "original_result_chars": len(original_result),
        "final_result_chars": len(final_result),
        "applied": applied,
        "mode": mode,
        "reason": reason,
    }
    extra.update(fields)
    _emit_safe_event(extra)


__all__ = [
    "log_prompt_event",
    "log_tool_payload_event",
    "log_tool_call_event",
    "log_runtime_outcome_event",
    "log_tool_result_transform_event",
    "content_hash",
    "prompt_fingerprint",
    "prompt_from_payload",
]
