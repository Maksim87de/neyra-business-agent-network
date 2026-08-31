# Шаблон persistent home клиента

Эта директория инициализирует пустой persistent home в `/opt/neyra-client/home`. В ней нет клиентских знаний, памяти, сессий, логов, OAuth state, Telegram state, model credentials или документов.

При первой установке копируется весь шаблон, включая корневые `SOUL.md`, `AGENTS.md` и `knowledge/specialist-registry.json`. Реестр задаёт ровно два изолированных профиля: `legal` / Юрист и `finance` / Финансист. Их runtime packages устанавливаются из `agents/`; собственные Telegram polling gateway не запускаются. Пользовательские сообщения принимает единый центральный gateway Нэйры, а профильные задачи проходят через встроенный Kanban и возвращаются только с evidence.
