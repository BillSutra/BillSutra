import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/hooks/invoice/useInvoiceDrafts";

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
  return (
    <div className="no-print rounded-2xl border border-[#ecdccf] bg-white/90 p-6">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
          Draft
        </p>
        <span className="rounded-full border border-[#eadacc] bg-[#fff7ef] px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-[#8a6d56]">
          {isDirty ? "Unsaved" : "Saved"}
        </span>
      </div>
      <p className="mt-3 text-sm text-[#5c4b3b]">
        {lastSavedAt
          ? `Saved ${formatRelativeTime(lastSavedAt)}.`
          : "Save a draft to continue later without submitting the invoice."}
      </p>
      <Button
        type="button"
        variant="outline"
        className="mt-4"
        onClick={onSaveDraft}
      >
        Save draft
      </Button>
    </div>
  );
};

export default InvoiceDraftPanel;
