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
    <div className="no-print rounded-[1.7rem] border border-gray-200 bg-white/90 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/80">
      <div className="mb-3">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">
          Utilities
        </p>
        <h3 className="mt-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
          Print, export, and share
        </h3>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          type="button"
          variant="outline"
          onClick={onPrint}
          className="h-11 rounded-xl sm:w-full"
        >
          {t("invoiceActions.print")}
        </Button>
        <Button
          type="button"
          onClick={onDownloadPdf}
          className="h-11 rounded-xl sm:w-full"
        >
          {t("invoiceActions.downloadPdf")}
        </Button>
        {onSendEmail ? (
          <Button
            type="button"
            variant="outline"
            onClick={onSendEmail}
            disabled={isSendingEmail}
            className="h-11 rounded-xl sm:col-span-2"
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
