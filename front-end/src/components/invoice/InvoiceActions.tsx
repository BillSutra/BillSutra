"use client";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/providers/LanguageProvider";

type InvoiceActionsProps = {
  onPrint: () => void;
  onDownloadPdf: () => void;
  onSendEmail?: () => void;
  isSendingEmail?: boolean;
  canSendEmail?: boolean;
};

const InvoiceActions = ({
  onPrint,
  onDownloadPdf,
  onSendEmail,
  isSendingEmail = false,
  canSendEmail = true,
}: InvoiceActionsProps) => {
  const { t } = useI18n();

  return (
    <div className="no-print flex flex-wrap gap-2">
      <Button type="button" variant="outline" onClick={onPrint}>
        {t("invoiceActions.print")}
      </Button>
      <Button type="button" onClick={onDownloadPdf}>
        {t("invoiceActions.downloadPdf")}
      </Button>
      {onSendEmail ? (
        <Button
          type="button"
          variant="outline"
          onClick={onSendEmail}
          disabled={!canSendEmail || isSendingEmail}
        >
          {isSendingEmail
            ? t("invoiceActions.sendingEmail")
            : t("invoiceActions.sendEmail")}
        </Button>
      ) : null}
    </div>
  );
};

export default InvoiceActions;
