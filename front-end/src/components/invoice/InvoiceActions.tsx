import { Button } from "@/components/ui/button";

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
  return (
    <div className="no-print flex flex-wrap gap-2">
      <Button type="button" variant="outline" onClick={onPrint}>
        Print invoice
      </Button>
      <Button type="button" onClick={onDownloadPdf}>
        Download PDF
      </Button>
      {onSendEmail ? (
        <Button
          type="button"
          variant="outline"
          onClick={onSendEmail}
          disabled={!canSendEmail || isSendingEmail}
        >
          {isSendingEmail ? "Sending..." : "Send Email"}
        </Button>
      ) : null}
    </div>
  );
};

export default InvoiceActions;
