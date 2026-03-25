"use client";

import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/hooks/invoice/useInvoiceDrafts";
import { useI18n } from "@/providers/LanguageProvider";

type InvoiceDraftPanelProps = {
  isDirty: boolean;
  lastSavedAt: Date | null;
  onSaveDraft: () => void;
};

const InvoiceDraftPanel = ({
  isDirty,
  lastSavedAt,
  onSaveDraft,
}: InvoiceDraftPanelProps) => {
  const { locale, t } = useI18n();

  return (
    <div className="no-print rounded-[1.7rem] bg-white/90 p-6 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.14)] ring-1 ring-slate-200/80 dark:bg-slate-900/80 dark:ring-slate-700/70">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
          {t("invoiceDrafts.title")}
        </p>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-500 dark:bg-slate-800 dark:text-slate-300">
          {isDirty ? t("common.unsaved") : t("common.saved")}
        </span>
      </div>
      <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
        {lastSavedAt
          ? t("invoiceDrafts.savedRelative", {
              time: formatRelativeTime(lastSavedAt, locale),
            })
          : t("invoiceDrafts.saveHelp")}
      </p>
      <Button
        type="button"
        variant="outline"
        className="mt-4 rounded-[1rem]"
        onClick={onSaveDraft}
      >
        {t("invoiceDrafts.saveDraft")}
      </Button>
    </div>
  );
};

export default InvoiceDraftPanel;
