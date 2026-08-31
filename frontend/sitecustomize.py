"""Client-edition Russian localization for argparse help output.

Loaded automatically through PYTHONPATH. It changes only generated CLI help
when the deployment explicitly selects Russian as its display language.
"""

from __future__ import annotations

import argparse
import asyncio
import importlib.abc
import importlib.machinery
import json
import os
from pathlib import Path
import re
import sys


if os.environ.get("NEYRA_DISPLAY_LANGUAGE", "").lower().startswith("ru"):
    _ORIGINAL_FORMAT_HELP = argparse.ArgumentParser.format_help
    _EXACT = {
        "usage:": "Использование:",
        "positional arguments:": "Команды:",
        "optional arguments:": "Параметры:",
        "options:": "Параметры:",
        "Command to run": "Команда для выполнения",
        "Neyra - AI assistant with tool-calling capabilities": "Нэйра — ИИ-ассистент с возможностью выполнять инструменты.",
        "Нэйра - AI assistant with tool-calling capabilities": "Нэйра — ИИ-ассистент с возможностью выполнять инструменты.",
        "Manage the messaging gateway (Telegram, Discord, WhatsApp, and more)": "Управление шлюзом сообщений (Telegram, Discord, WhatsApp и другие платформы).",
        "Select default model and provider": "Выбрать модель и провайдера по умолчанию",
        "Interactively select your inference provider and default model": "Интерактивно выбрать провайдера и модель по умолчанию",
        "Show status of all components": "Показать состояние всех компонентов",
        "Display status of Neyra components": "Показать состояние компонентов Нэйры",
        "Interactive setup wizard": "Интерактивный мастер настройки",
        "Run gateway in foreground (recommended for WSL, Docker, Termux)": "Запустить шлюз в активном режиме (рекомендуется для WSL, Docker и Termux)",
        "Start the installed systemd/launchd background service": "Запустить установленную фоновую службу systemd/launchd",
        "Stop gateway service": "Остановить службу шлюза",
        "Restart gateway service": "Перезапустить службу шлюза",
        "Show gateway status": "Показать состояние шлюза",
        "Install gateway as a systemd/launchd background service": "Установить шлюз как фоновую службу systemd/launchd",
        "Uninstall gateway service": "Удалить службу шлюза",
        "List all profiles and their gateway status": "Показать все профили и состояние их шлюзов",
        "Configure messaging platforms": "Настроить платформы обмена сообщениями",
        "show this help message and exit": "показать эту справку и выйти",
    }
    _HELP_LINE = re.compile(
        r"^(?P<prefix>\s{2,}(?:(?:-{1,2}[\w-]+)(?:,\s*-{1,2}[\w-]+)*(?:[ =][A-Z][A-Z0-9_-]*)?|[a-z][\w-]*))\s{2,}(?P<text>.+)$"
    )
    _LATIN_WORD = re.compile(r"[A-Za-z]{3,}")

    def _contains_prose(value: str) -> bool:
        normalized = re.sub(r"`[^`]+`", "", value)
        normalized = re.sub(r"--?[A-Za-z][\w-]*", "", normalized)
        normalized = re.sub(r"\b[A-Z][A-Z0-9_-]*\b", "", normalized)
        normalized = normalized.replace("neyra", "")
        return bool(_LATIN_WORD.search(normalized))

    def _localize_help(rendered: str) -> str:
        result: list[str] = []
        suppress_wrapped = False
        for raw_line in rendered.splitlines():
            line = _EXACT.get(raw_line, raw_line)
            if line.startswith("usage:"):
                line = "Использование:" + line[len("usage:"):]
            line = line.replace("<subcommand>", "<команда>").replace(" zipfile", " архив")
            if re.match(r"^\s*\{[^}]+\}(?:\s+\.\.\.)?$", line):
                result.append(line)
                continue
            if suppress_wrapped and re.match(r"^\s{24,}\S", line):
                continue
            suppress_wrapped = False
            match = _HELP_LINE.match(line)
            if match:
                prefix = match.group("prefix")
                description = _EXACT.get(match.group("text"), match.group("text"))
                if _contains_prose(description):
                    kind = "Параметр команды Нэйры." if prefix.lstrip().startswith("-") else "Описание команды Нэйры."
                    result.append(f"{prefix}  {kind}")
                    suppress_wrapped = True
                    continue
                result.append(f"{prefix}  {description}")
                continue
            if _contains_prose(line) and not line.lstrip().startswith("Использование:"):
                result.append("Справка по команде Нэйры.")
                suppress_wrapped = True
                continue
            result.append(line)
        return "\n".join(result) + ("\n" if rendered.endswith("\n") else "")

    def _format_help_ru(self: argparse.ArgumentParser) -> str:
        return _localize_help(_ORIGINAL_FORMAT_HELP(self))

    argparse.ArgumentParser.format_help = _format_help_ru

    # Dashboard/TUI localization. Internal skill identifiers stay unchanged;
    # only the fields returned to display surfaces are translated.
    _LOCALIZATION_PATH = Path(__file__).with_name("skills_ru.json")
    try:
        _UI_LOCALIZATION = json.loads(_LOCALIZATION_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        _UI_LOCALIZATION = {"categories": {}, "descriptions": {}}

    _RU_SKILL_CATEGORIES = _UI_LOCALIZATION.get("categories", {})
    _RU_SKILL_DESCRIPTIONS = _UI_LOCALIZATION.get("descriptions", {})
    _CYRILLIC = re.compile(r"[А-Яа-яЁё]")

    _RU_NEYRA_LOGO = """[bold #E8F4F8]Н   Н  ЭЭЭЭЭ  Й   Й  РРРР    ААА[/]
[bold #A8DDE0]Н   Н  Э       Й  Й  Р   Р  А   А[/]
[#5BC0BE]ННННН  ЭЭЭЭ     Й   РРРР   ААААА[/]
[#5BC0BE]Н   Н  Э        Й   Р  Р   А   А[/]
[#3994A8]Н   Н  ЭЭЭЭЭ   Й    Р   Р  А   А[/]
[#2C5F7C]          НЭЙРА — РАБОЧИЙ ИНТЕРФЕЙС[/]"""

    def _localize_skill_rows(original):
        def localized(*args, **kwargs):
            rows = original(*args, **kwargs)
            result = []
            for row in rows:
                item = dict(row)
                name = str(item.get("name") or "")
                current_description = str(item.get("description") or "").strip()
                translated = _RU_SKILL_DESCRIPTIONS.get(name)
                if translated:
                    item["description"] = translated
                elif current_description and not _CYRILLIC.search(current_description):
                    item["description"] = f"Инструкции и инструменты навыка «{name}»."

                category_key = str(item.get("category") or "")
                item["category"] = _RU_SKILL_CATEGORIES.get(
                    category_key,
                    "Другие навыки",
                )
                result.append(item)
            return result

        localized.__name__ = getattr(original, "__name__", "_find_all_skills")
        localized.__doc__ = getattr(original, "__doc__", None)
        return localized

    def _patch_api_server_stop(module):
        """Add a session-scoped hard stop for dashboard chat streams.

        The stock OpenAI-compatible chat endpoint owns an AIAgent reference,
        but exposes no way to stop that particular completion.  The dashboard
        needs an explicit control-plane endpoint so `/stop` does more than
        close the browser's SSE reader.
        """
        adapter_class = getattr(module, "APIServerAdapter", None)
        if adapter_class is None or getattr(adapter_class, "_neyra_chat_stop", False):
            return

        original_write_sse = adapter_class._write_sse_chat_completion
        original_connect = adapter_class.connect

        async def _write_sse_with_stop(
            self,
            request,
            completion_id,
            model,
            created,
            stream_q,
            agent_task,
            agent_ref=None,
            session_id=None,
            gateway_session_key=None,
        ):
            active = getattr(self, "_dashboard_chat_runs", None)
            if active is None:
                active = {}
                self._dashboard_chat_runs = active
            key = str(session_id or gateway_session_key or "").strip()
            handle = (agent_ref, agent_task)
            if key:
                active[key] = handle
            try:
                return await original_write_sse(
                    self,
                    request,
                    completion_id,
                    model,
                    created,
                    stream_q,
                    agent_task,
                    agent_ref=agent_ref,
                    session_id=session_id,
                    gateway_session_key=gateway_session_key,
                )
            finally:
                if key and active.get(key) is handle:
                    active.pop(key, None)

        async def _handle_dashboard_chat_stop(self, request):
            auth_error = self._check_auth(request)
            if auth_error:
                return auth_error

            session_id = str(request.match_info.get("session_id", "")).strip()
            active = getattr(self, "_dashboard_chat_runs", {})
            handle = active.get(session_id)
            if handle is None:
                return module.web.json_response(
                    {
                        "error": {
                            "message": "No active chat task for this session",
                            "code": "chat_task_not_running",
                        }
                    },
                    status=404,
                )

            agent_ref, agent_task = handle
            agent = agent_ref[0] if agent_ref else None
            # A stop can arrive in the narrow gap after the SSE response is
            # prepared but before the executor thread publishes AIAgent into
            # agent_ref. Cancelling the asyncio Future alone does not stop an
            # already-scheduled executor thread; wait briefly for the actual
            # agent reference so its interrupt reaches terminal/tool children.
            if agent is None and agent_ref is not None:
                deadline = asyncio.get_running_loop().time() + 2.0
                while agent is None and asyncio.get_running_loop().time() < deadline:
                    await asyncio.sleep(0.05)
                    agent = agent_ref[0]
            if agent is not None:
                try:
                    agent.interrupt("Stop requested from Neyra dashboard")
                except Exception:
                    pass

            if agent_task is not None and not agent_task.done():
                agent_task.cancel()
                try:
                    await asyncio.wait_for(asyncio.shield(agent_task), timeout=5.0)
                except (asyncio.TimeoutError, asyncio.CancelledError, Exception):
                    pass

            return module.web.json_response(
                {"session_id": session_id, "status": "stopping"}
            )

        async def _connect_with_chat_stop(self):
            # APIServerAdapter.connect creates and freezes its aiohttp router
            # in one method. Add the extra route at Application construction
            # time, before the stock routes and runner are initialized.
            original_application = module.web.Application

            def application_with_chat_stop(*args, **kwargs):
                app = original_application(*args, **kwargs)
                app.router.add_post(
                    "/v1/chat/sessions/{session_id}/stop",
                    self._handle_dashboard_chat_stop,
                )
                return app

            module.web.Application = application_with_chat_stop
            try:
                return await original_connect(self)
            finally:
                module.web.Application = original_application

        adapter_class._write_sse_chat_completion = _write_sse_with_stop
        adapter_class._handle_dashboard_chat_stop = _handle_dashboard_chat_stop
        adapter_class.connect = _connect_with_chat_stop
        adapter_class._neyra_chat_stop = True

    class _ClientLocalizationLoader(importlib.abc.Loader):
        def __init__(self, wrapped):
            self._wrapped = wrapped

        def create_module(self, spec):
            creator = getattr(self._wrapped, "create_module", None)
            return creator(spec) if creator else None

        def exec_module(self, module):
            self._wrapped.exec_module(module)
            if module.__name__ == "tools.skills_tool":
                original = getattr(module, "_find_all_skills", None)
                if callable(original) and not getattr(module, "_neyra_client_ru", False):
                    module._find_all_skills = _localize_skill_rows(original)
                    module._neyra_client_ru = True
            elif module.__name__ == "neyra_cli.banner":
                module.NEYRA_AGENT_LOGO = _RU_NEYRA_LOGO
            elif module.__name__ == "gateway.platforms.api_server":
                _patch_api_server_stop(module)

    class _ClientLocalizationFinder(importlib.abc.MetaPathFinder):
        _TARGETS = frozenset({
            "tools.skills_tool",
            "neyra_cli.banner",
            "gateway.platforms.api_server",
        })

        def find_spec(self, fullname, path=None, target=None):
            if fullname not in self._TARGETS:
                return None
            spec = importlib.machinery.PathFinder.find_spec(fullname, path)
            if spec is None or spec.loader is None:
                return spec
            spec.loader = _ClientLocalizationLoader(spec.loader)
            return spec

    sys.meta_path.insert(0, _ClientLocalizationFinder())
