# Клиентское подключение модели

Каждый клиентский контур использует **свой** аккаунт провайдера, свои лимиты и биллинг. Нэйра не переносит в него `auth.json`, OAuth, API keys или подписку из центрального либо другого клиентского контура.

Контур поддерживает три способа подключения. Выбор фиксируется локально в `<client-home>/.env` с правами `0600` и никогда не попадает в Git.

| Режим | Когда применять | Доказательство готовности |
|---|---|---|
| `native` | У провайдера есть встроенный flow Нэйры | `neyra auth status` показывает active auth record, затем model smoke |
| `env` | Клиент использует собственный API key | key variable присутствует в контейнере без чтения значения, затем model smoke |
| `custom` | Собственный gateway или совместимый endpoint клиента | проверка endpoint/client-local configuration, затем model smoke |

## Выборы клиента

Ниже приведены проверенные runtime-сurface Нэйры. Подключать можно и другие совместимые endpoints через `custom`; это не обещание совместимости без отдельного smoke.

| Сценарий | `NEYRA_PROVIDER` | Режим | Локальная настройка |
|---|---|---|---|
| ChatGPT / Codex | `openai-codex` | `native` | клиент проходит `neyra auth add openai-codex` в своём контейнере |
| Claude API / OAuth | `anthropic` | `native` | клиент проходит `neyra auth add anthropic` |
| Google AI Studio / Gemini | `google` или `gemini` | `env` | `NEYRA_PROVIDER_KEY_ENV=GOOGLE_API_KEY` либо `GEMINI_API_KEY` |
| Kimi / Moonshot | `kimi-coding` | `env` | `NEYRA_PROVIDER_KEY_ENV=KIMI_API_KEY` |
| OpenRouter | `openrouter` | `env` | `NEYRA_PROVIDER_KEY_ENV=OPENROUTER_API_KEY` |
| Z.AI / GLM | `zai` | `env` | `NEYRA_PROVIDER_KEY_ENV=ZAI_API_KEY` |
| Свой gateway | имя клиентского provider или `custom:<name>` | `custom` | endpoint и credential размещаются только в клиентском home по контракту этого provider |

Идентификатор модели принадлежит выбранному аккаунту и проверяется фактическим ответом. Примеры: `gpt-5.6-terra`, `claude-sonnet-4.6`, `gemini-2.5-flash`, либо модель клиента в OpenRouter/Kimi. Список не заменяет live проверку доступа и тарифного лимита.

## Порядок onboarding

1. Установщик создаёт чистый client home и стартует базовый runtime без провайдера.
2. Владелец контура выбирает provider, model и auth mode в локальном `.env`. API key кладётся через согласованный secret path непосредственно на сервер; в чат, GitHub Issue и команду shell он не вставляется.
3. Оператор запускает:

   ```bash
   sudo ./scripts/provider-onboarding.sh
   sudo ./scripts/acceptance.sh --functional
   ```

4. Скрипт проверяет только наличие client-local auth/key, записывает не секретные `model.provider` и `model.default` в `<client-home>/config.yaml`, перезапускает **только** контейнер этого контура и требует фиксированный inference response.
5. Лишь после model smoke подключается Telegram или другой пользовательский канал и проходит channel round-trip.

## Пример локального `.env` — Kimi

```dotenv
CLIENT_ID=acme
NEYRA_PROVIDER=kimi-coding
NEYRA_MODEL=REPLACE_WITH_CLIENT_KIMI_MODEL
NEYRA_PROVIDER_AUTH_MODE=env
NEYRA_PROVIDER_KEY_ENV=KIMI_API_KEY
KIMI_API_KEY=[stored-through-approved-secret-path]
```

Значение ключа показано только как маркер. Его нельзя копировать в документацию, Git или чат.

## Правила остановки

- `auth status` с `logged out` — блокировка, даже если команда завершилась с кодом `0`.
- Наличие переменной API key доказывает лишь доставку секрета в контейнер, но не доступ к модели.
- Успешный model smoke — единственное доказательство inference readiness.
- Смена provider/model после handover — это клиентское изменение: повторяются provider onboarding, model smoke и channel round-trip.