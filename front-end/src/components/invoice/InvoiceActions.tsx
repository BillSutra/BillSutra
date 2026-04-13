"use client";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/providers/LanguageProvider";

type InvoiceActionsProps = {
  onPrint: () => void;
  onDownloadPdf: () => void;
  onSendEmail?: () => void;
  isSendingEmail?: boolean;
};

const InvoiceActions = ({
  onPrint,
  onDownloadPdf,
  onSendEmail,
  isSendingEmail = false,
}: InvoiceActionsProps) => {
  const { t } = useI18n();

  return (
    <div className="no-print rounded-[1.7rem] bg-white/90 p-4 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/80 dark:bg-slate-900/80 dark:ring-slate-700/70">
      <div className="mb-3">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
          Optional tools
        </p>
        <h3 className="mt-2 text-lg font-semibold text-slate-950 dark:text-slate-100">
          Save or share this bill
        </h3>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          type="button"
          variant="outline"
          onClick={onPrint}
          className="h-11 rounded-[1rem] sm:w-full"
        >
          {t("invoiceActions.print")}
        </Button>
        <Button
          type="button"
          onClick={onDownloadPdf}
          className="h-11 rounded-[1rem] sm:w-full"
        >
          {t("invoiceActions.downloadPdf")}
        </Button>
        {onSendEmail ? (
          <Button
            type="button"
            variant="outline"
            onClick={onSendEmail}
            disabled={isSendingEmail}
            className="h-11 rounded-[1rem] sm:col-span-2"
          >
            {isSendingEmail
              ? t("invoiceActions.sendingEmail")
              : t("invoiceActions.sendEmail")}
          </Button>
        ) : null}
      </div>
    </div>
  );
};

export default InvoiceActions;
