# Нэйра — сеть бизнес-агентов

Устанавливаемая агентная бизнес-система: центральный оператор Нэйра маршрутизирует задачи изолированным специалистам и принимает результат только с evidence.

> **Статус:** публичный тестовый выпуск. Репозиторий содержит только переносимые исходники, демо-данные и контракты. Клиентские контуры, секреты и рабочие данные сюда не входят.

## Установка

На чистом Ubuntu/Debian VPS с Docker Engine и Docker Compose v2:

```bash
git clone https://github.com/Maksim87de/neyra-business-agent-network.git
cd neyra-business-agent-network
sudo ./scripts/install.sh --client-id my-company
```

Команда скачивает публичный тестовый образ, создаёт отдельный persistent home и запускает gateway. Затем владелец контура подключает собственную модель и провайдера локально — ключи, OAuth, сессии и Telegram token в GitHub не передаются.

## Состав сети

| Компонент | Роль | Результат |
|---|---|---|
| Нэйра | Принимает задачу, проверяет границы и выбирает исполнителя | task envelope и проверенный итог |
| Юрист (`legal`) | Разбирает юридические документы и риски в разрешённой юрисдикции | заключение с источниками, ограничениями и evidence |
| Финансист (`finance`) | Работает с финансовыми моделями, таблицами и платёжными сценариями | расчёт, файлы и проверяемый вывод |
| Shared contracts | Определяют форматы task, handoff, decision, risk и evidence | совместимость агентов без передачи лишних данных |

## Архитектура

```text
Telegram / Web / API
        │
        ▼
 Нэйра
        │
 ┌──────┼──────────────┐
 ▼      ▼              ▼
Юрист  Финансист
        │
        ▼
Shared contracts → evidence → handoff → verified result
```

Подробнее: [архитектура](docs/architecture.md), [модель безопасности](docs/security-model.md), [правила публикации](docs/publishing-gate.md).

## Модель и провайдер принадлежат клиенту

Каждый контур подключает свой provider и model: например Codex, Claude, Google/Gemini, Kimi, OpenRouter или совместимый клиентский gateway. Аккаунт, лимиты и биллинг остаются у клиента; между контурами не переносятся OAuth, ключи и `auth.json`. Подключение проходит отдельный [provider onboarding](docs/provider-onboarding.md) и завершается только реальным model smoke.

## Репозиторий

- `runtime/` — private source snapshot runtime overrides и product CLI с SHA-256 manifest.
- `frontend/` — private source snapshot dashboard localization без generated distributions.
- `agents/` — переносимые описания ролей, policies и capability manifests.
- `shared/schemas/` — JSON Schema для межагентного обмена.
- `demo/` — только синтетические примеры.
- `docs/` — архитектура, безопасность, provenance и publishing gate.
- `tests/` — contract и integration fixtures.

Статус импортированного кода и условия возможной будущей публикации зафиксированы в [provenance register](docs/provenance.md).

## Локальная проверка

```bash
make check
# если GNU Make ещё не установлен:
python3 scripts/validate_contracts.py
```

Команда валидирует JSON-контракты и проверяет, что обязательные файлы присутствуют. Runtime и production deployment будут добавляться отдельными проверяемыми изменениями.

## Публичный тестовый выпуск

Установочный образ: `ghcr.io/maksim87de/neyra-business-agent-network:v0.1.0-test`. Перед клиентским использованием выполните [provider onboarding](docs/provider-onboarding.md) и реальный model smoke.
