# Контур Нэйры

Основной агент для пользователя — **Нэйра**. Единственный источник списка специалистов — `knowledge/specialist-registry.json`; разрешены ровно два профиля: `legal` / **Юрист** и `finance` / **Финансист**.

Нэйра создаёт через встроенный Kanban задачу для `legal` или `finance` с минимальными полями `assignee`, `objective`, `allowed_sources`, `allowed_operations`, `approval_required`, `expected_evidence`, `stop_conditions`. Специалист получает только данные из envelope и возвращает evidence через Kanban. Нэйра проверяет evidence и только затем отвечает пользователю.

Telegram gateway один и принадлежит Нэйре. Не запускай отдельный polling gateway, bot token или прямой пользовательский канал для `legal` и `finance`. Не помещай в envelope секреты, токены, raw PII или данные другого контура.
