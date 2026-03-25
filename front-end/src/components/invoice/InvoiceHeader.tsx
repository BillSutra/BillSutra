import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/hooks/invoice/useInvoiceDrafts";

type InvoiceHeaderProps = {
  isDirty: boolean;
  lastSavedAt: Date | null;
};

const InvoiceHeader = ({ isDirty, lastSavedAt }: InvoiceHeaderProps) => {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-wrap items-center justify-end gap-4">
        <div className="flex min-w-[140px] flex-col items-end gap-1 text-right">
          <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs uppercase tracking-[0.25em] text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
            {isDirty ? "Draft" : "Saved"}
          </span>
          <span className="text-xs text-gray-500">
            {isDirty
              ? "Unsaved changes"
              : lastSavedAt
                ? `Saved ${formatRelativeTime(lastSavedAt)}`
                : "Ready"}
          </span>
        </div>
        <div className="flex justify-end">
          <Button asChild variant="outline">
            <Link href="/invoices/history">View invoice history</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default InvoiceHeader;
