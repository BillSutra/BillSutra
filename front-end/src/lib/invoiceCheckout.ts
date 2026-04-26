import type { Invoice, InvoiceInput } from "@/lib/apiClient";
import type { InvoiceRenderPayload } from "@/lib/invoiceRenderPayload";

export const submitInvoiceCheckout = async (
  createInvoice: (payload: InvoiceInput) => Promise<Invoice>,
  payload: InvoiceInput,
) => createInvoice(payload);

const EMAIL_ADDRESS_PATTERN = /^[\w-.]+@[\w-]+\.[a-zA-Z]{2,}$/;

const normalizeInvoiceCheckoutEmail = (value?: string | null) => {
  const normalized = value?.trim() ?? "";
  if (!normalized) {
    return null;
  }

  return EMAIL_ADDRESS_PATTERN.test(normalized) ? normalized : null;
};

type SendInvoiceCheckoutEmail = (
  invoiceId: number,
  payload: { email?: string; preview_payload?: InvoiceRenderPayload },
) => Promise<{
  invoiceId: number;
  status?: string;
  email?: string;
  queued?: boolean;
  jobId?: string | null;
}>;

export const runInvoiceCheckoutPipeline = async ({
  createInvoice,
  sendInvoiceEmail,
  payload,
  customerEmail,
  previewPayload,
}: {
  createInvoice: (payload: InvoiceInput) => Promise<Invoice>;
  sendInvoiceEmail: SendInvoiceCheckoutEmail;
  payload: InvoiceInput;
  customerEmail?: string | null;
  previewPayload?: InvoiceRenderPayload | null;
}) => {
  const invoice = await submitInvoiceCheckout(createInvoice, payload);
  const emailRecipient = normalizeInvoiceCheckoutEmail(customerEmail);
  const normalizedPreviewPayload = previewPayload
    ? {
        ...previewPayload,
        data: {
          ...previewPayload.data,
          invoiceNumber:
            invoice.invoice_number || previewPayload.data.invoiceNumber,
        },
      }
    : null;

  if (!emailRecipient) {
    return {
      invoice,
      emailRecipient: null,
      emailResult: null,
      emailError: null,
      previewPayload: normalizedPreviewPayload,
    };
  }

  try {
    const emailResult = await sendInvoiceEmail(invoice.id, {
      email: emailRecipient,
      preview_payload: normalizedPreviewPayload ?? undefined,
    });

    return {
      invoice,
      emailRecipient,
      emailResult,
      emailError: null,
      previewPayload: normalizedPreviewPayload,
    };
  } catch (emailError) {
    return {
      invoice,
      emailRecipient,
      emailResult: null,
      emailError,
      previewPayload: normalizedPreviewPayload,
    };
  }
};
