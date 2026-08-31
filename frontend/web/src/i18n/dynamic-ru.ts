const EXACT_TRANSLATIONS: Record<string, string> = {
  "Other": "Другое",
  "General": "Общие",
  "Model": "Модель",
  "Default model for new sessions": "Модель по умолчанию для новых сессий",
  "Provider": "Провайдер",
  "Providers": "Провайдеры",
  "Tools": "Инструменты",
  "Messaging": "Мессенджеры",
  "Settings": "Настройки",
  "Memory": "Память",
  "Dashboard": "Панель управления",
  "Security": "Безопасность",
  "Sessions": "Сессии",
  "Profiles": "Профили",
  "Plugins": "Плагины",
  "Skills": "Навыки",
  "Logging": "Журналирование",
  "Bedrock": "Amazon Bedrock",
  "Curator": "Куратор",
  "Gateway": "Шлюз",
  "Kanban": "Канбан",
  "Model catalog": "Каталог моделей",
  "Model_catalog": "Каталог моделей",
  "Openrouter": "OpenRouter",
  "Secrets": "Секреты",
  "Tool loop guardrails": "Ограничения цикла инструментов",
  "Tool_loop_guardrails": "Ограничения цикла инструментов",
  "Tool output": "Вывод инструментов",
  "Tool_output": "Вывод инструментов",
  "Updates": "Обновления",
  "Web": "Веб",
  "bundled": "встроенный",
  "user": "пользовательский",
  "project": "проектный",
  "inactive": "неактивен",
  "Enabled": "Включено",
  "Disabled": "Отключено",
  "Item": "Элемент",
  "comma-separated values": "значения через запятую",
};

const FIELD_WORDS: Record<string, string> = {
  model: "модель",
  provider: "провайдер",
  enabled: "включено",
  default: "по умолчанию",
  timeout: "тайм-аут",
  retries: "повторные попытки",
  max: "максимум",
  min: "минимум",
  token: "токен",
  tokens: "токены",
  path: "путь",
  url: "URL",
  host: "хост",
  port: "порт",
  name: "имя",
  description: "описание",
  language: "язык",
  profile: "профиль",
  session: "сессия",
  sessions: "сессии",
  memory: "память",
  context: "контекст",
  engine: "движок",
  tool: "инструмент",
  tools: "инструменты",
  skill: "навык",
  skills: "навыки",
  log: "журнал",
  logs: "журналы",
  level: "уровень",
  mode: "режим",
  limit: "лимит",
  interval: "интервал",
  auto: "автоматически",
  approval: "подтверждение",
  require: "требовать",
  allow: "разрешить",
  show: "показывать",
  hidden: "скрыто",
  directory: "каталог",
  database: "база данных",
  catalog: "каталог",
  routing: "маршрутизация",
  fallback: "резервная модель",
  compression: "сжатие",
  search: "поиск",
  message: "сообщение",
  messages: "сообщения",
  system: "система",
  prompt: "инструкция",
  temperature: "температура",
  bedrock: "Amazon Bedrock",
  curator: "куратор",
  gateway: "шлюз",
  kanban: "канбан",
  lsp: "LSP",
  openrouter: "OpenRouter",
  secrets: "секреты",
  updates: "обновления",
  web: "веб",
  length: "длина",
  providers: "провайдеры",
  toolsets: "наборы инструментов",
  file: "файл",
  read: "чтение",
  chars: "символы",
  char: "символ",
  prefill: "предзаполнение",
  timezone: "часовой пояс",
  command: "команда",
  allowlist: "список разрешений",
  hooks: "перехватчики",
  accept: "принимать",
  paste: "вставка",
  collapse: "сворачивание",
  threshold: "порог",
  output: "вывод",
  guardrails: "ограничения",
  loop: "цикл",
};

export function localizeUiText(value: unknown): string {
  const text = String(value ?? "");
  if (!text || /[А-Яа-яЁё]/.test(text)) return text;
  return EXACT_TRANSLATIONS[text] ?? text;
}

export function localizeFieldLabel(value: string): string {
  const exact = localizeUiText(value);
  if (exact !== value) return exact;
  const words = value.replace(/([a-z])([A-Z])/g, "$1 $2").split(/[._\s-]+/).filter(Boolean);
  const translated = words.map((word) => FIELD_WORDS[word.toLowerCase()] ?? word).join(" ");
  return translated.charAt(0).toUpperCase() + translated.slice(1);
}

export function localizeSchemaDescription(schemaKey: string, description: unknown): string {
  const text = String(description ?? "");
  if (/[А-Яа-яЁё]/.test(text)) return text;
  const translated = localizeUiText(text);
  if (translated !== text) return translated;
  return `Настройка «${localizeFieldLabel(schemaKey.split(".").pop() ?? schemaKey)}».`;
}

export function localizeEnvDescription(key: string, category: string, description: unknown): string {
  const text = String(description ?? "");
  if (/[А-Яа-яЁё]/.test(text)) return text;
  const translated = localizeUiText(text);
  if (translated !== text) return translated;
  const prefix = key.split("_")[0];
  if (category === "provider") return `Ключ или параметр провайдера ${prefix}.`;
  if (category === "messaging") return `Параметр подключения мессенджера ${prefix}.`;
  if (category === "tool") return `Параметр инструмента ${key}.`;
  return `Системная настройка ${key}.`;
}

export function localizePluginDescription(name: string, description: unknown): string {
  const text = String(description ?? "");
  if (/[А-Яа-яЁё]/.test(text)) return text;
  const translated = localizeUiText(text);
  if (translated !== text) return translated;
  const detail = name.includes("/") ? name.split("/").pop() : name;
  if (name.startsWith("platforms/")) return `Подключение Нэйры к платформе ${detail}.`;
  if (name.startsWith("image_gen/")) return `Генерация изображений через ${detail}.`;
  if (name.startsWith("video_gen/")) return `Генерация видео через ${detail}.`;
  if (name.startsWith("web/")) return `Поиск и извлечение данных из веба через ${detail}.`;
  return `Плагин «${name}» расширяет возможности Нэйры.`;
}

export function russianNoun(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  return mod10 === 1 && mod100 !== 11
    ? one
    : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
      ? few
      : many;
}
