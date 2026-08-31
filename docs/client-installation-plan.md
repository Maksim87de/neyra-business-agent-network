# План выпуска устанавливаемой клиентской Нэйры

**Статус:** active

**Цель:** превратить private source foundation в воспроизводимый deployment-kit, который разворачивает из GitHub отдельный клиентский контур: свой сервер, данные, секреты, Telegram-канал и изолированные профили Нэйры, Юриста и Финансиста.

## Исходная граница

- Рабочий контур `neyraclient.service` остаётся эталоном для изучения и приёмки, но никогда не становится шаблоном через прямое копирование `client-home`.
- В product repository хранятся только переносимые исходники, шаблоны, тестовые fixtures и документация.
- Клиентские данные, `.env`, токены, OAuth, Telegram sessions, память, knowledge, логи, базы, IP, домены и production-конфигурация не входят в Git.
- Установка выполняется на отдельном сервере клиента. Секреты вводятся на этом сервере или через выбранный секретный менеджер; они не передаются через GitHub issues, чат или аргументы командной строки.

## Модель выдачи

Основной product repository остаётся private. Для каждого получателя создаётся отдельный клиентский deployment repository из утверждённого private template либо выдаётся read-only доступ к tagged release. Это даёт отдельную историю, secrets и настройки клиента и не смешивает его с другими контурами.

| Слой | Где живёт | Что содержит |
|---|---|---|
| Product source | `Maksim87de/neyra-business-agent-network` | runtime, agent templates, contracts, installer, tests, документация |
| Client deployment repository | отдельный private repo клиента | выбранная release-версия, non-secret config, client-specific deploy instructions |
| Client server | отдельный VPS клиента | `.env`, persistent homes, sessions, базы, логи, Docker volumes |
| GitHub access | GitHub collaborator или per-server read-only deploy key | доступ только к нужному private repository |

Не использовать personal access token в `curl | sudo bash`: он попадает в shell history, process environment или логи. Для private installation использовать обычный `git clone` по SSH с read-only deploy key либо GitHub App installation token, созданный на самом сервере с минимальными правами.

## Результат v0.1.0-client-install

Клиентский технарь на чистом Ubuntu/Debian VPS проходит один документированный путь:

```bash
# 1. получить repository access и read-only deploy key
# 2. clone выбранного client deployment repository
# 3. заполнить secrets локально в .env
sudo ./scripts/install.sh
sudo ./scripts/doctor.sh --full
```

После этого проверяются: Docker services healthy, gateway отвечает, dashboard доступен только через выбранный безопасный маршрут, Telegram принимает сообщение, центральная Нэйра возвращает ответ, а Legal/Finance выполняют синтетические проверочные сценарии с evidence.

## Семь обязательных поставок

### 1. `deploy/`: воспроизводимый Docker deployment

**Состав:**

- `deploy/docker-compose.yml`;
- `deploy/Dockerfile.client-runtime`;
- `deploy/nginx/` или иной reverse-proxy слой только при необходимости;
- `deploy/config/` с non-secret defaults;
- pinned image tags/digests и healthchecks;
- CPU/RAM/disk limits, `no-new-privileges`, внутренние сети, bind только на loopback до явного включения proxy.

**Критерий приёмки:** `docker compose config` проходит на чистом checkout; `docker compose up -d` создаёт только ожидаемые сервисы; healthcheck показывает `healthy`.

### 2. `scripts/install.sh`: идемпотентная установка

**Состав:**

- preflight: supported OS, root/sudo, disk, RAM, Docker, Compose, Git, свободные порты;
- создание `/opt/neyra-client` и защищённых persistent directories;
- проверка, что repository уже клонирован через безопасный private-access route;
- создание `.env` с правами `0600` из `.env.example` без вывода значений;
- build/pull pinned image, `docker compose up -d`;
- rollback/stop condition: при ошибке installer не удаляет прежний работающий persistent home и печатает точный этап ошибки.

**Критерий приёмки:** повторный запуск не ломает действующую установку; installation log не содержит secret values; ошибка до запуска не оставляет частично созданный production service.

### 3. Config templates и секретная граница

**Состав:**

- `.env.example` с именами переменных и комментариями, без значений;
- `config.example.yaml` и profile templates;
- `client-home-template/` с пустыми разрешёнными каталогами и profile skeletons;
- schema validation для обязательных параметров;
- документ: откуда получить каждый credential, кто его вводит и как заменить/отозвать.

**Критерий приёмки:** installer отказывается стартовать при пустом обязательном параметре; `git ls-files` и secret scan не находят secrets, sessions, real client values или generated state.

### 4. Agent packages: Нэйра, Юрист, Финансист

**Состав:**

- `agents/orchestrator`, `agents/legal`, `agents/finance` как versioned packages;
- `profile.yaml`, capability manifests, policy, allowed tools/data, stop conditions;
- contracts `task`, `handoff`, `risk`, `decision`, `evidence`;
- только переносимые skills с зафиксированным происхождением и distribution terms;
- synthetic fixtures для legal/finance без реальных документов и выписок.

**Критерий приёмки:** central orchestrator направляет legal и finance задачи только в разрешённый профиль; профиль не получает данные, которые не описаны его access contract; каждый результат содержит expected evidence.

### 5. `scripts/doctor.sh`: проверка установленной системы

**Состав:**

- OS, Docker, Compose, volume permissions и свободные порты;
- `docker compose ps` и health endpoints;
- config/schema checks без печати secrets;
- gateway/dashboard probe;
- synthetic end-to-end checks: central response, legal scenario, finance scenario;
- понятные статусы `PASS`, `WARN`, `FAIL` и actionable remediation.

**Критерий приёмки:** чистая установка завершается `PASS`; намеренно выключенный сервис, неверная config и отсутствующий credential дают отдельные понятные `FAIL` с ненулевым exit code.

### 6. Документация и GitHub packaging

**Состав:**

- `README.md`: что это, состав агентной сети, архитектура, supported platform, Quick Start;
- `docs/deployment.md`: сервер → repository access → secrets → install → first response → update → rollback;
- `docs/security-model.md`: границы клиентов, access contracts, secrets, backups, обновления;
- `docs/operator-runbook.md`: restart, logs, healthcheck, recovery;
- `docs/client-handover.md`: что получает клиент, что остаётся у оператора, порядок поддержки;
- `.github/`: issue templates, PR template, CODEOWNERS, CI, Dependabot/release workflow;
- `CHANGELOG.md`, semantic tags и GitHub Releases с checksums/release notes.

**Критерий приёмки:** новый технический исполнитель устанавливает demo по документации без устных уточнений; GitHub Release привязан к проверенному commit/tag и содержит условия обновления/отката.

### 7. End-to-end проверка и release gate

**Состав:**

- disposable clean VPS test matrix: Ubuntu supported version и Debian supported version;
- CI: formatting, schemas, unit/contract tests, Docker build, secret scan, image scan, synthetic integration tests;
- staging install из exact Git tag;
- manual Telegram acceptance с тестовым bot token, созданным только для staging;
- release checklist, rollback test и signed evidence report.

**Критерий приёмки:** новая VM с нуля устанавливает exact release; `doctor --full` проходит; Telegram round-trip и agent-network scenarios проходят; uninstall/reinstall или rollback не теряет тестовую persistent state без явного удаления.

## Порядок выполнения

| Фаза | Результат | Зависимости | Точка остановки |
|---|---|---|---|
| A. Product contract | supported OS, topology, ports, роли, edition boundary, threat model | текущий `neyraclient.service` как reference | не начинаем installer, пока не утверждены supported platform и способ GitHub access |
| B. Clean template | `client-home-template`, config schemas, agent packages, synthetic demo | A | нет client-specific values в tracked files |
| C. Deployment core | Compose, Dockerfile, install, uninstall/rollback contract | B | install не меняет live client service |
| D. Operational safety | doctor, logs, backup/restore policy, update/rollback scripts | C | full doctor не раскрывает secrets |
| E. Documentation and GitHub | guides, templates, releases, branch protection | C-D | нет инструкции с PAT в command line |
| F. Staging acceptance | clean VPS install, real Telegram test, legal/finance E2E | A-E | любой FAIL возвращает работу в соответствующий слой |
| G. Release | signed/tagged `v0.1.0-client-install`, release notes, handover kit | F | клиенту выдаётся только проверенная release-версия |

## Первая рабочая очередь

1. Сравнить current `neyraclient.service` deployment с будущим portable contract и составить допускаемый список переносимых файлов.
2. Зафиксировать supported target: Ubuntu/Debian versions, minimum RAM/disk, ports и внешний access model.
3. Создать `deploy/`, `client-home-template/`, `.env.example`, config schemas и install/doctor skeletons.
4. Перенести только проверяемые build/runtime components в clean deployment layer.
5. Добавить contract/integration tests для маршрутов Orchestrator → Legal/Finance.
6. Написать deployment/runbook/handover docs и GitHub release workflow.
7. Поднять fresh staging VPS, выполнить полный install, real Telegram acceptance и rollback test.
8. После evidence выпустить `v0.1.0-client-install` и применять его только для новых изолированных клиентских контуров.

## Что не входит в первый выпуск

- перенос реальных данных или идентичности текущего клиента;
- multi-tenant shared server для разных клиентов;
- публичный open-source release;
- автоматическое создание внешних DNS, Telegram bots или платёжных аккаунтов без отдельного подтверждения владельца;
- юридические и финансовые советы без предусмотренного профилем evidence и human checkpoint.

## Definition of Done

Версия считается готовой к выдаче человеку только когда одновременно выполнены все условия:

- отдельный private client deployment repository создан из проверенного template/release;
- installer и doctor прошли на чистом server matrix;
- main agent, Legal Agent и Finance Agent прошли synthetic E2E;
- real Telegram message получает подтверждённый ответ;
- secrets, client data и production identity отсутствуют из Git history и artifacts;
- есть documented update, rollback, backup/restore и support handover;
- exact Git tag, Docker image digest и release notes зафиксированы;
- клиентский контур работает на своей инфраструктуре и не зависит от IP или данных центральной Нэйры.
