const INVOICE_PREFIX = "INV-";

export const generateInvoiceNumber = (latest?: string | null) => {
  const match = latest?.match(/INV-(\d+)/i);
  const next = match ? Number(match[1]) + 1 : 1;
  return `${INVOICE_PREFIX}${String(next).padStart(4, "0")}`;
};
