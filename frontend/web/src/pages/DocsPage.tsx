import { useLayoutEffect } from "react";
import { ExternalLink } from "lucide-react";
import { useI18n } from "@/i18n";
import { usePageHeader } from "@/contexts/usePageHeader";
import { cn } from "@/lib/utils";
import { PluginSlot } from "@/plugins";

export const NEYRA_DOCS_URL = "https://github.com/Maksim87de/neyra-business-agent-network";

const DS_BUTTON_OUTLINED_LINK_CN = cn(
  "group relative inline-grid grid-cols-[auto_1fr_auto] items-center",
  "px-[.9em_.75em] py-[1.25em] gap-2",
  "leading-0 font-bold tracking-[0.2em] uppercase",
  "text-midground bg-transparent shadow-midground",
  "shadow-[inset_-1px_-1px_0_0_#00000080,inset_1px_1px_0_0_#ffffff80]",
);

export default function DocsPage() {
  const { t } = useI18n();
  const { setEnd } = usePageHeader();

  useLayoutEffect(() => {
    setEnd(
      <a
        href={NEYRA_DOCS_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={DS_BUTTON_OUTLINED_LINK_CN}
      >
        <ExternalLink className="size-3.5" />
        {t.app.openDocumentation}
      </a>,
    );
    return () => {
      setEnd(null);
    };
  }, [setEnd, t]);

  return (
    <div
      className={cn(
        "flex min-h-0 w-full min-w-0 flex-1 flex-col",
        "pt-1 sm:pt-2",
      )}
    >
      <PluginSlot name="docs:top" />
      {/* Neyra docs live on GitHub, which sends X-Frame-Options: deny and
          cannot be iframed. Show a CTA that opens the repo in a new tab
          instead of a permanently-blank embed. Swap back to an <iframe>
          here only if a self-hosted, frame-able docs site exists. */}
      <div
        className={cn(
          "flex min-h-0 w-full min-w-0 flex-1 flex-col",
          "items-center justify-center gap-4 text-center",
        )}
      >
        <p className="max-w-md text-sm text-text-secondary">
          {t.app.nav.documentation}
        </p>
        <a
          href={NEYRA_DOCS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={DS_BUTTON_OUTLINED_LINK_CN}
        >
          <ExternalLink className="size-3.5" />
          {t.app.openDocumentation}
        </a>
      </div>
      <PluginSlot name="docs:bottom" />
    </div>
  );
}
