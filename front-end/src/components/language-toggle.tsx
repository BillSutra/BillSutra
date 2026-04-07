"use client";

import { cn } from "@/lib/utils";
import { useI18n } from "@/providers/LanguageProvider";

const LanguageToggle = ({ className }: { className?: string }) => {
  const { language, setLanguage, t } = useI18n();

  return (
    <div
      role="group"
      aria-label={t("common.language")}
      className={cn(
        "inline-flex items-center rounded-xl border border-border bg-card/90 p-1 shadow-sm",
        className,
      )}
    >
      {(
        [
          { id: "en", label: "EN", fullLabel: t("common.english") },
          { id: "hi", label: "HI", fullLabel: t("common.hindi") },
          { id: "hinglish", label: "HG", fullLabel: t("common.hinglish") },
        ] as const
      ).map((option) => {
        const active = language === option.id;

        return (
          <button
            key={option.id}
            type="button"
            onClick={() => setLanguage(option.id)}
            aria-pressed={active}
            aria-label={option.fullLabel}
            className={cn(
              "rounded-lg px-2.5 py-1.5 text-xs font-semibold tracking-[0.16em] transition",
              active
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};

export default LanguageToggle;
