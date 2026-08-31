import { useEffect, useLayoutEffect, useState, useMemo } from "react";
import {
  Package,
  Search,
  Wrench,
  X,
  Cpu,
  Globe,
  Shield,
  Eye,
  Paintbrush,
  Brain,
  Blocks,
  Code,
  Zap,
  Filter,
} from "lucide-react";
import { api } from "@/lib/api";
import type { SkillInfo, ToolsetInfo } from "@/lib/api";
import { useToast } from "@nous-research/ui/hooks/use-toast";
import { Toast } from "@nous-research/ui/ui/components/toast";
import { Card, CardContent, CardHeader, CardTitle } from "@nous-research/ui/ui/components/card";
import { Badge } from "@nous-research/ui/ui/components/badge";
import { Button } from "@nous-research/ui/ui/components/button";
import { ListItem } from "@nous-research/ui/ui/components/list-item";
import { Spinner } from "@nous-research/ui/ui/components/spinner";
import { Switch } from "@nous-research/ui/ui/components/switch";
import { cn } from "@/lib/utils";
import { Input } from "@nous-research/ui/ui/components/input";
import { useI18n } from "@/i18n";
import { usePageHeader } from "@/contexts/usePageHeader";
import { PluginSlot } from "@/plugins";

/* ------------------------------------------------------------------ */
/*  Types & helpers                                                    */
/* ------------------------------------------------------------------ */

const CATEGORY_LABELS: Record<string, string> = {
  mlops: "MLOps",
  "mlops/cloud": "MLOps / Cloud",
  "mlops/evaluation": "MLOps / Evaluation",
  "mlops/inference": "MLOps / Inference",
  "mlops/models": "MLOps / Models",
  "mlops/training": "MLOps / Training",
  "mlops/vector-databases": "MLOps / Vector DBs",
  mcp: "MCP",
  "red-teaming": "Red Teaming",
  ocr: "OCR",
  p5js: "p5.js",
  ai: "AI",
  ux: "UX",
  ui: "UI",
};

const TOOLSET_RU: Record<string, { label: string; description: string }> = {
  web: {
    label: "Поиск и извлечение данных из веба",
    description: "Поиск информации в интернете и извлечение содержимого веб-страниц.",
  },
  browser: {
    label: "Управление браузером",
    description: "Переходы по страницам, нажатия, ввод текста, прокрутка и снимки.",
  },
  terminal: {
    label: "Терминал и процессы",
    description: "Выполнение команд терминала и управление запущенными процессами.",
  },
  file: {
    label: "Работа с файлами",
    description: "Чтение, запись, точечное изменение и поиск файлов.",
  },
  code_execution: {
    label: "Выполнение кода",
    description: "Запуск кода в изолированной среде выполнения.",
  },
  vision: {
    label: "Анализ изображений",
    description: "Распознавание и анализ содержимого изображений.",
  },
  video: {
    label: "Анализ видео",
    description: "Анализ видеозаписей; требуется модель с поддержкой видео.",
  },
  image_gen: {
    label: "Генерация изображений",
    description: "Создание и редактирование изображений по текстовому заданию.",
  },
  video_gen: {
    label: "Генерация видео",
    description: "Создание видео по тексту или исходному изображению.",
  },
  x_search: {
    label: "Поиск в X (Twitter)",
    description: "Поиск публикаций в X; требуется авторизация xAI или ключ XAI API.",
  },
  moa: {
    label: "Коллектив моделей",
    description: "Параллельное решение задачи несколькими моделями с объединением результатов.",
  },
  tts: {
    label: "Озвучивание текста",
    description: "Преобразование текста в синтезированную речь.",
  },
  skills: {
    label: "Навыки",
    description: "Просмотр списка навыков, чтение инструкций и управление навыками.",
  },
  todo: {
    label: "Планирование задач",
    description: "Создание и ведение списка задач и этапов выполнения.",
  },
  memory: {
    label: "Память",
    description: "Долговременное сохранение и использование данных между сессиями.",
  },
  context_engine: {
    label: "Контекстный движок",
    description: "Инструменты активного движка управления контекстом.",
  },
  session_search: {
    label: "Поиск по сессиям",
    description: "Поиск информации в прошлых разговорах и рабочих сессиях.",
  },
  clarify: {
    label: "Уточняющие вопросы",
    description: "Запрос недостающей информации у пользователя.",
  },
  delegation: {
    label: "Делегирование задач",
    description: "Передача отдельных задач специализированным агентам.",
  },
  cronjob: {
    label: "Задачи по расписанию",
    description: "Создание, просмотр, изменение, приостановка, возобновление и запуск задач по расписанию.",
  },
  messaging: {
    label: "Отправка сообщений",
    description: "Отправка сообщений через подключённые каналы связи.",
  },
  homeassistant: {
    label: "Умный дом",
    description: "Просмотр устройств и управление ими через Home Assistant.",
  },
  spotify: {
    label: "Spotify",
    description: "Воспроизведение, поиск, плейлисты, очередь и медиатека Spotify.",
  },
  discord: {
    label: "Discord",
    description: "Чтение сообщений, поиск участников и создание обсуждений в Discord.",
  },
  discord_admin: {
    label: "Администрирование Discord",
    description: "Управление каналами, ролями и закреплёнными сообщениями Discord.",
  },
  computer_use: {
    label: "Управление компьютером (macOS)",
    description: "Фоновое управление рабочим столом macOS через драйвер автоматизации.",
  },
};

const TOOL_RU: Record<string, string> = {
  browser_back: "Назад в браузере",
  browser_cdp: "Управление браузером",
  browser_click: "Нажатие в браузере",
  browser_console: "Консоль браузера",
  browser_dialog: "Диалоги браузера",
  browser_get_images: "Получение изображений",
  browser_navigate: "Переход по адресу",
  browser_press: "Нажатие клавиши",
  browser_scroll: "Прокрутка страницы",
  browser_snapshot: "Снимок страницы",
  browser_type: "Ввод текста",
  browser_vision: "Визуальный анализ страницы",
  clarify: "Уточняющий вопрос",
  computer_use: "Управление компьютером",
  cronjob: "Задача по расписанию",
  delegate_task: "Делегирование задачи",
  discord: "Работа с Discord",
  discord_admin: "Администрирование Discord",
  execute_code: "Выполнение кода",
  ha_call_service: "Вызов службы умного дома",
  ha_get_state: "Получение состояния устройства",
  ha_list_entities: "Список устройств",
  ha_list_services: "Список служб умного дома",
  image_generate: "Генерация изображения",
  memory: "Память",
  mixture_of_agents: "Коллектив моделей",
  patch: "Точечное изменение файла",
  process: "Управление процессами",
  read_file: "Чтение файла",
  search_files: "Поиск файлов",
  send_message: "Отправка сообщения",
  session_search: "Поиск по сессиям",
  skill_manage: "Управление навыком",
  skill_view: "Просмотр навыка",
  skills_list: "Список навыков",
  spotify_albums: "Альбомы Spotify",
  spotify_devices: "Устройства Spotify",
  spotify_library: "Медиатека Spotify",
  spotify_playback: "Воспроизведение Spotify",
  spotify_playlists: "Плейлисты Spotify",
  spotify_queue: "Очередь Spotify",
  spotify_search: "Поиск в Spotify",
  terminal: "Терминал",
  text_to_speech: "Озвучивание текста",
  todo: "План задач",
  video_analyze: "Анализ видео",
  video_generate: "Генерация видео",
  vision_analyze: "Анализ изображения",
  web_extract: "Извлечение с веб-страницы",
  web_search: "Поиск в интернете",
  write_file: "Запись файла",
  x_search: "Поиск в X",
};

function toolsetText(toolset: ToolsetInfo): { label: string; description: string } {
  return TOOLSET_RU[toolset.name] ?? {
    label: toolset.label.replace(/^[\p{Emoji}\s]+/u, "").trim() || toolset.name,
    description: toolset.description,
  };
}

function prettyCategory(
  raw: string | null | undefined,
  generalLabel: string,
): string {
  if (!raw) return generalLabel;
  if (/[А-Яа-яЁё]/.test(raw)) return raw;
  if (CATEGORY_LABELS[raw]) return CATEGORY_LABELS[raw];
  return raw
    .split(/[-_/]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function russianCount(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  const word = mod10 === 1 && mod100 !== 11
    ? one
    : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
      ? few
      : many;
  return `${count} ${word}`;
}

const TOOLSET_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  computer: Cpu,
  web: Globe,
  security: Shield,
  vision: Eye,
  design: Paintbrush,
  ai: Brain,
  integration: Blocks,
  code: Code,
  automation: Zap,
};

function toolsetIcon(
  name: string,
): React.ComponentType<{ className?: string }> {
  const lower = name.toLowerCase();
  for (const [key, icon] of Object.entries(TOOLSET_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return Wrench;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function SkillsPage() {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [toolsets, setToolsets] = useState<ToolsetInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"skills" | "toolsets">("skills");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [togglingSkills, setTogglingSkills] = useState<Set<string>>(new Set());
  const { toast, showToast } = useToast();
  const { t } = useI18n();
  const { setAfterTitle, setEnd } = usePageHeader();

  useEffect(() => {
    Promise.all([api.getSkills(), api.getToolsets()])
      .then(([s, tsets]) => {
        setSkills(s);
        setToolsets(tsets);
      })
      .catch(() => showToast(t.common.loading, "error"))
      .finally(() => setLoading(false));
  }, []);

  /* ---- Toggle skill ---- */
  const handleToggleSkill = async (skill: SkillInfo) => {
    setTogglingSkills((prev) => new Set(prev).add(skill.name));
    try {
      await api.toggleSkill(skill.name, !skill.enabled);
      setSkills((prev) =>
        prev.map((s) =>
          s.name === skill.name ? { ...s, enabled: !s.enabled } : s,
        ),
      );
      showToast(
        `${skill.name} ${skill.enabled ? t.common.disabled : t.common.enabled}`,
        "success",
      );
    } catch {
      showToast(`${t.common.failedToToggle} ${skill.name}`, "error");
    } finally {
      setTogglingSkills((prev) => {
        const next = new Set(prev);
        next.delete(skill.name);
        return next;
      });
    }
  };

  /* ---- Derived data ---- */
  const lowerSearch = search.toLowerCase();
  const isSearching = search.trim().length > 0;

  const searchMatchedSkills = useMemo(() => {
    if (!isSearching) return [];
    return skills.filter(
      (s) =>
        s.name.toLowerCase().includes(lowerSearch) ||
        s.description.toLowerCase().includes(lowerSearch) ||
        (s.category ?? "").toLowerCase().includes(lowerSearch),
    );
  }, [skills, isSearching, lowerSearch]);

  const activeSkills = useMemo(() => {
    if (isSearching) return [];
    if (!activeCategory)
      return [...skills].sort((a, b) => a.name.localeCompare(b.name));
    return skills
      .filter((s) =>
        activeCategory === "__none__"
          ? !s.category
          : s.category === activeCategory,
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [skills, activeCategory, isSearching]);

  const allCategories = useMemo(() => {
    const cats = new Map<string, number>();
    for (const s of skills) {
      const key = s.category || "__none__";
      cats.set(key, (cats.get(key) || 0) + 1);
    }
    return [...cats.entries()]
      .sort((a, b) => {
        if (a[0] === "__none__") return -1;
        if (b[0] === "__none__") return 1;
        return a[0].localeCompare(b[0]);
      })
      .map(([key, count]) => ({
        key,
        name: prettyCategory(key === "__none__" ? null : key, t.common.general),
        count,
      }));
  }, [skills, t]);

  const enabledCount = skills.filter((s) => s.enabled).length;

  useLayoutEffect(() => {
    if (loading) {
      setAfterTitle(null);
      setEnd(null);
      return;
    }
    setAfterTitle(
      <span className="whitespace-nowrap text-xs text-muted-foreground">
        {t.skills.enabledOf
          .replace("{enabled}", String(enabledCount))
          .replace("{total}", String(skills.length))}
      </span>,
    );
    setEnd(
      <div className="relative w-full min-w-0 sm:max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          className="h-8 rounded-none pl-8 pr-7 text-xs"
          placeholder={t.common.search}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <Button
            ghost
            size="xs"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setSearch("")}
            aria-label={t.common.clear}
          >
            <X />
          </Button>
        )}
      </div>,
    );
    return () => {
      setAfterTitle(null);
      setEnd(null);
    };
  }, [enabledCount, loading, search, setAfterTitle, setEnd, skills.length, t]);

  const filteredToolsets = useMemo(() => {
    return toolsets.filter((ts) => {
      const localized = toolsetText(ts);
      return (
        !search ||
        ts.name.toLowerCase().includes(lowerSearch) ||
        localized.label.toLowerCase().includes(lowerSearch) ||
        localized.description.toLowerCase().includes(lowerSearch) ||
        ts.tools.some((tool) =>
          (TOOL_RU[tool] ?? tool).toLowerCase().includes(lowerSearch),
        )
      );
    });
  }, [toolsets, search, lowerSearch]);

  /* ---- Loading ---- */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="text-2xl text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PluginSlot name="skills:top" />
      <Toast toast={toast} />

      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <aside aria-label={t.skills.title} className="sm:w-56 sm:shrink-0">
          <div className="sm:sticky sm:top-0">
            <div className="flex flex-col rounded-none border border-border bg-muted/20">
              <div className="hidden sm:flex items-center gap-2 px-3 py-2 border-b border-border">
                <Filter className="h-3 w-3 text-text-tertiary" />
                <span className="font-mondwest text-display text-xs tracking-[0.12em] text-text-secondary">
                  {t.skills.filters}
                </span>
              </div>

              <div className="flex sm:flex-col gap-1 overflow-x-auto sm:overflow-x-visible scrollbar-none p-2">
                <PanelItem
                  icon={Package}
                  label={`${t.skills.all} (${skills.length})`}
                  active={view === "skills" && !isSearching}
                  onClick={() => {
                    setView("skills");
                    setActiveCategory(null);
                    setSearch("");
                  }}
                />
                <PanelItem
                  icon={Wrench}
                  label={`${t.skills.toolsets} (${toolsets.length})`}
                  active={view === "toolsets"}
                  onClick={() => {
                    setView("toolsets");
                    setSearch("");
                  }}
                />
              </div>

              {view === "skills" &&
                !isSearching &&
                allCategories.length > 0 && (
                  <div className="hidden sm:flex flex-col border-t border-border">
                    <div className="px-3 pt-2 pb-1 font-mondwest text-display text-xs tracking-[0.12em] text-text-tertiary">
                      {t.skills.categories}
                    </div>
                    <div className="flex flex-col p-2 pt-1 gap-px max-h-[calc(100vh-340px)] overflow-y-auto">
                      {allCategories.map(({ key, name, count }) => {
                        const isActive = activeCategory === key;

                        return (
                          <ListItem
                            key={key}
                            active={isActive}
                            onClick={() =>
                              setActiveCategory(isActive ? null : key)
                            }
                            className="rounded-none px-2 py-1 text-xs"
                          >
                            <span className="flex-1 truncate">{name}</span>
                            <span
                              className={`text-xs tabular-nums ${
                                isActive
                                  ? "text-text-secondary"
                                  : "text-text-tertiary"
                              }`}
                            >
                              {count}
                            </span>
                          </ListItem>
                        );
                      })}
                    </div>
                  </div>
                )}
            </div>
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          {isSearching ? (
            <Card className="rounded-none">
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    {t.skills.title}
                  </CardTitle>
                  <Badge tone="secondary" className="text-xs">
                    {russianCount(searchMatchedSkills.length, "результат", "результата", "результатов")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {searchMatchedSkills.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    {t.skills.noSkillsMatch}
                  </p>
                ) : (
                  <div className="grid gap-1">
                    {searchMatchedSkills.map((skill) => (
                      <SkillRow
                        key={skill.name}
                        skill={skill}
                        toggling={togglingSkills.has(skill.name)}
                        onToggle={() => handleToggleSkill(skill)}
                        noDescriptionLabel={t.skills.noDescription}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : view === "skills" ? (
            /* Skills list */
            <Card className="rounded-none">
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    {activeCategory
                      ? prettyCategory(
                          activeCategory === "__none__" ? null : activeCategory,
                          t.common.general,
                        )
                      : t.skills.all}
                  </CardTitle>
                  <Badge tone="secondary" className="text-xs">
                    {russianCount(activeSkills.length, "навык", "навыка", "навыков")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {activeSkills.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    {skills.length === 0
                      ? t.skills.noSkills
                      : t.skills.noSkillsMatch}
                  </p>
                ) : (
                  <div className="grid gap-1">
                    {activeSkills.map((skill) => (
                      <SkillRow
                        key={skill.name}
                        skill={skill}
                        toggling={togglingSkills.has(skill.name)}
                        onToggle={() => handleToggleSkill(skill)}
                        noDescriptionLabel={t.skills.noDescription}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            /* Toolsets grid */
            <>
              {filteredToolsets.length === 0 ? (
                <Card className="rounded-none">
                  <CardContent className="py-8 text-center text-sm text-muted-foreground">
                    {t.skills.noToolsetsMatch}
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredToolsets.map((ts) => {
                    const TsIcon = toolsetIcon(ts.name);
                    const localized = toolsetText(ts);

                    return (
                      <Card key={ts.name} className="relative rounded-none">
                        <CardContent className="py-4">
                          <div className="flex items-start gap-3">
                            <TsIcon className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm">
                                  {localized.label}
                                </span>
                                <Badge
                                  tone={ts.enabled ? "success" : "outline"}
                                  className="text-xs"
                                >
                                  {ts.enabled
                                    ? t.common.active
                                    : t.common.inactive}
                                </Badge>
                              </div>
                              <p className="text-xs text-text-secondary mb-2">
                                {localized.description}
                              </p>
                              {ts.enabled && !ts.configured && (
                                <p className="text-xs text-amber-300 mb-2">
                                  {t.skills.setupNeeded}
                                </p>
                              )}
                              {ts.tools.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {ts.tools.map((tool) => (
                                    <Badge
                                      key={tool}
                                      tone="secondary"
                                      className="text-xs"
                                    >
                                      {TOOL_RU[tool] ?? tool}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                              {ts.tools.length === 0 && (
                                <span className="text-xs text-text-tertiary">
                                  {ts.enabled
                                    ? t.skills.toolsetLabel.replace(
                                        "{name}",
                                        localized.label,
                                      )
                                    : t.skills.disabledForCli}
                                </span>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <PluginSlot name="skills:bottom" />
    </div>
  );
}

function SkillRow({
  skill,
  toggling,
  onToggle,
  noDescriptionLabel,
}: SkillRowProps) {
  return (
    <div className="group flex items-start gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40">
      <div className="pt-0.5 shrink-0">
        <Switch
          checked={skill.enabled}
          onCheckedChange={onToggle}
          disabled={toggling}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span
            className={`font-mono-ui text-sm ${
              skill.enabled ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            {skill.name}
          </span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
          {skill.description || noDescriptionLabel}
        </p>
      </div>
    </div>
  );
}

function PanelItem({ active, icon: Icon, label, onClick }: PanelItemProps) {
  return (
    <ListItem
      active={active}
      onClick={onClick}
      className={cn(
        "rounded-none whitespace-nowrap px-2.5 py-1.5",
        "font-mondwest text-[0.7rem] tracking-[0.08em] uppercase",
        active && "bg-foreground/90 text-background hover:text-background",
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="flex-1 truncate">{label}</span>
    </ListItem>
  );
}

interface PanelItemProps {
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}

interface SkillRowProps {
  noDescriptionLabel: string;
  onToggle: () => void;
  skill: SkillInfo;
  toggling: boolean;
}
