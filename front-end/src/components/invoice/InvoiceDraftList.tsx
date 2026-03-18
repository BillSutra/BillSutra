"use client";

import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/hooks/invoice/useInvoiceDrafts";
import type { InvoiceDraft } from "@/types/invoice";
import { useI18n } from "@/providers/LanguageProvider";

type InvoiceDraftListProps = {
  drafts: InvoiceDraft[];
  currentDraftId: string | null;
  customerNameById: Map<string, string>;
  onLoadDraft: (draft: InvoiceDraft) => void;
  onDeleteDraft: (id: string) => void;
};

const InvoiceDraftList = ({
  drafts,
  currentDraftId,
  customerNameById,
  onLoadDraft,
  onDeleteDraft,
}: InvoiceDraftListProps) => {
  const { locale, t } = useI18n();

  return (
    <div className="no-print rounded-2xl border border-[#ecdccf] bg-white/90 p-6">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
          {t("invoiceDrafts.recentDrafts")}
        </p>
        <span className="text-xs text-[#8a6d56]">
          {t("invoiceDrafts.savedCount", { count: drafts.length })}
        </span>
      </div>
      {drafts.length === 0 ? (
        <p className="mt-3 text-sm text-[#5c4b3b]">{t("invoiceDrafts.noDrafts")}</p>
      ) : (
        <div className="mt-4 grid gap-3">
          {drafts.map((draft) => (
            <div
              key={draft.id}
              className="rounded-xl border border-[#f0e2d6] bg-[#fff7ef] p-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#1f1b16]">
                    {draft.form.customer_id
                      ? (customerNameById.get(draft.form.customer_id) ??
                        `Customer #${draft.form.customer_id}`)
                      : t("invoiceDrafts.untitledDraft")}
                  </p>
                  <p className="text-xs text-[#8a6d56]">
                    {t("invoiceDrafts.savedRelative", {
                      time: formatRelativeTime(new Date(draft.savedAt), locale),
                    })}
                  </p>
                </div>
                {currentDraftId === draft.id && (
                  <span className="rounded-full border border-[#eadacc] bg-white px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-[#8a6d56]">
                    {t("invoiceDrafts.current")}
                  </span>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 px-3 text-xs"
                  onClick={() => onLoadDraft(draft)}
                >
                  {t("common.load")}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="h-8 px-3 text-xs"
                  onClick={() => onDeleteDraft(draft.id)}
                >
                  {t("common.delete")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default InvoiceDraftList;
