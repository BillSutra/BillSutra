import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/hooks/invoice/useInvoiceDrafts";
import type { InvoiceDraft } from "@/types/invoice";

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
  return (
    <div className="no-print rounded-2xl border border-[#ecdccf] bg-white/90 p-6">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
          Recent drafts
        </p>
        <span className="text-xs text-[#8a6d56]">{drafts.length} total</span>
      </div>
      {drafts.length === 0 ? (
        <p className="mt-3 text-sm text-[#5c4b3b]">No saved drafts yet.</p>
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
                      : "Untitled draft"}
                  </p>
                  <p className="text-xs text-[#8a6d56]">
                    Saved {formatRelativeTime(new Date(draft.savedAt))}
                  </p>
                </div>
                {currentDraftId === draft.id && (
                  <span className="rounded-full border border-[#eadacc] bg-white px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-[#8a6d56]">
                    Current
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
                  Load
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="h-8 px-3 text-xs"
                  onClick={() => onDeleteDraft(draft.id)}
                >
                  Delete
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
