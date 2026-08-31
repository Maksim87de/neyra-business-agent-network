import { Moon, Sun } from "lucide-react";
import { Button } from "@nous-research/ui/ui/components/button";
import { useTheme } from "@/themes";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

/**
 * Dark/light toggle for the Neyra dashboard.
 *
 * The old multi-theme picker is intentionally removed from the product shell:
 * operators should see one Neyra interface, not an upstream theme catalog.
 */
export function ThemeSwitcher({ collapsed = false }: ThemeSwitcherProps) {
  const { themeName, setTheme } = useTheme();
  const { t } = useI18n();
  const isLight = themeName === "light";
  const nextTheme = isLight ? "default" : "light";
  const label = t.theme?.switchTheme ?? "Toggle color mode";

  return (
    <Button
      ghost
      size="icon"
      onClick={() => setTheme(nextTheme)}
      className={cn(
        "text-text-secondary hover:text-foreground hover:bg-transparent",
        !collapsed && "h-8 w-8",
      )}
      title={label}
      aria-label={label}
      aria-pressed={isLight}
    >
      {isLight ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
    </Button>
  );
}

interface ThemeSwitcherProps {
  collapsed?: boolean;
  dropUp?: boolean;
}
