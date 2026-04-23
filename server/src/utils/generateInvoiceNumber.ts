const INVOICE_PREFIX = "INV";
const DEFAULT_SEQUENCE_WIDTH = 4;

const getInvoiceYear = () => new Date().getFullYear();

export const generateInvoiceNumber = (latest?: string | null) => {
  const year = getInvoiceYear();
  const currentYearPattern = new RegExp(
    `^${INVOICE_PREFIX}-${year}-(\\d{1,})$`,
    "i",
  );
  const legacyPattern = new RegExp(`^${INVOICE_PREFIX}-(\\d{1,})$`, "i");

  const currentYearMatch = latest?.match(currentYearPattern);
  if (currentYearMatch) {
    const next = Number(currentYearMatch[1]) + 1;
    return `${INVOICE_PREFIX}-${year}-${String(next).padStart(DEFAULT_SEQUENCE_WIDTH, "0")}`;
  }

  const legacyMatch = latest?.match(legacyPattern);
  if (legacyMatch) {
    const next = Number(legacyMatch[1]) + 1;
    return `${INVOICE_PREFIX}-${year}-${String(next).padStart(DEFAULT_SEQUENCE_WIDTH, "0")}`;
  }

  return `${INVOICE_PREFIX}-${year}-${"1".padStart(DEFAULT_SEQUENCE_WIDTH, "0")}`;
};
