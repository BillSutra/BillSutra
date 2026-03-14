import { useCallback } from "react";
import { generateInvoicePdf } from "@/lib/pdf/generateInvoicePdf";
import type { InvoicePdfInput } from "@/types/invoice";

export const useInvoicePdf = () => {
  const downloadPdf = useCallback(async (input: InvoicePdfInput) => {
    await generateInvoicePdf(input);
  }, []);

  return { downloadPdf };
};

export type { InvoicePdfInput };
