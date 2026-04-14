"use client";

import { cn } from "@/lib/utils";
import { useI18n } from "@/providers/LanguageProvider";
import { usePersistedLanguage } from "@/hooks/usePersistedLanguage";

const LanguageToggle = ({ className }: { className?: string }) => {
  const { t } = useI18n();
  const { language, setPersistedLanguage, isSavingLanguage } =
    usePersistedLanguage();
  const switchLanguageLabel = t("common.switchLanguage");

  return (
    <div
      role="group"
      aria-label={t("common.language")}
      title={
        switchLanguageLabel === "common.switchLanguage"
          ? "Switch Language"
          : switchLanguageLabel
      }
      className={cn(
        "relative inline-flex items-center rounded-2xl border border-border bg-card/90 p-1 shadow-sm transition-all",
        className,
      )}
    >
      {(
        [
          { id: "en", label: "EN", fullLabel: t("common.english") },
          { id: "hi", label: "HI", fullLabel: t("common.hindi") },
        ] as const
      ).map((option) => {
        const active = language === option.id;

        return (
          <button
            key={option.id}
            type="button"
            onClick={() => setPersistedLanguage(option.id)}
            aria-pressed={active}
            aria-label={option.fullLabel}
            disabled={isSavingLanguage}
            className={cn(
              "relative rounded-xl px-3 py-1.5 text-xs font-semibold tracking-[0.16em] transition-all duration-200",
              active
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              isSavingLanguage ? "opacity-80" : "",
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
