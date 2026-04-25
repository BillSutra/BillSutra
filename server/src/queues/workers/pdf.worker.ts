import { generateInvoicePdf } from "../../modules/invoice/invoice.service.js";
import type { DefaultQueueJobHandlerMap } from "../types.js";

export const pdfJobHandlers: Pick<
  DefaultQueueJobHandlerMap,
  "generateInvoicePDF"
> = {
  generateInvoicePDF: async (job) => {
    const result = await generateInvoicePdf(job.data.userId, job.data.invoiceId);

    return {
      invoiceId: job.data.invoiceId,
      invoiceNumber: result.invoiceNumber,
      bytes: result.buffer.length,
    };
  },
};
