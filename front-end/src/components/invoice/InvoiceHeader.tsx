import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/hooks/invoice/useInvoiceDrafts";

type InvoiceHeaderProps = {
  isDirty: boolean;
  lastSavedAt: Date | null;
};

const InvoiceHeader = ({ isDirty, lastSavedAt }: InvoiceHeaderProps) => {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-gray-500">
            Invoices
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Create invoice
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-500">
            Build GST-ready invoices with live totals, customer details, and
            preview-ready layouts for printing.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2">
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
          <Button asChild variant="outline" className="mt-2">
            <Link href="/invoices/history">View invoice history</Link>
          </Button>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.2em] text-gray-500">
        <span className="rounded-full border border-gray-200 bg-white px-3 py-1 dark:border-gray-700 dark:bg-gray-900">
          Live totals
        </span>
        <span className="rounded-full border border-gray-200 bg-white px-3 py-1 dark:border-gray-700 dark:bg-gray-900">
          GST ready
        </span>
        <span className="rounded-full border border-gray-200 bg-white px-3 py-1 dark:border-gray-700 dark:bg-gray-900">
          Print preview
        </span>
      </div>
    </div>
  );
};

export default InvoiceHeader;
