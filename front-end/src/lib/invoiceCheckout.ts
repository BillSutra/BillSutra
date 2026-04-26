import type { Invoice, InvoiceInput } from "@/lib/apiClient";

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
  payload: { email?: string },
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
}: {
  createInvoice: (payload: InvoiceInput) => Promise<Invoice>;
  sendInvoiceEmail: SendInvoiceCheckoutEmail;
  payload: InvoiceInput;
  customerEmail?: string | null;
}) => {
  const invoice = await submitInvoiceCheckout(createInvoice, payload);
  const emailRecipient = normalizeInvoiceCheckoutEmail(customerEmail);

  if (!emailRecipient) {
    return {
      invoice,
      emailRecipient: null,
      emailResult: null,
      emailError: null,
    };
  }

  try {
    const emailResult = await sendInvoiceEmail(invoice.id, {
      email: emailRecipient,
    });

    return {
      invoice,
      emailRecipient,
      emailResult,
      emailError: null,
    };
  } catch (emailError) {
    return {
      invoice,
      emailRecipient,
      emailResult: null,
      emailError,
    };
  }
};
