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
    <div className="no-print rounded-2xl border border-[#ecdccf] bg-white/90 p-6">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
          {t("invoiceDrafts.title")}
        </p>
        <span className="rounded-full border border-[#eadacc] bg-[#fff7ef] px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-[#8a6d56]">
          {isDirty ? t("common.unsaved") : t("common.saved")}
        </span>
      </div>
      <p className="mt-3 text-sm text-[#5c4b3b]">
        {lastSavedAt
          ? t("invoiceDrafts.savedRelative", {
              time: formatRelativeTime(lastSavedAt, locale),
            })
          : t("invoiceDrafts.saveHelp")}
      </p>
      <Button
        type="button"
        variant="outline"
        className="mt-4"
        onClick={onSaveDraft}
      >
        {t("invoiceDrafts.saveDraft")}
      </Button>
    </div>
  );
};

export default InvoiceDraftPanel;
