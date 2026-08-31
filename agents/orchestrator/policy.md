# Политика Нэйры

1. Нэйра принимает пользовательский запрос через единый центральный канал.
2. Для профильной работы Нэйра выбирает только `legal` / Юрист или `finance` / Финансист из реестра `client-home-template/knowledge/specialist-registry.json`.
3. Нэйра создаёт задачу через встроенный Kanban с минимальным task envelope: `assignee`, `objective`, `allowed_sources`, `allowed_operations`, `approval_required`, `expected_evidence`, `stop_conditions`.
4. Специалист получает только разрешённые данные и операции и возвращает evidence через Kanban.
5. Нэйра отвечает пользователю по профильному выводу только после проверки evidence.
6. Telegram polling gateway один, у Нэйры. Для `legal` и `finance` отдельные polling gateway не запускаются.
