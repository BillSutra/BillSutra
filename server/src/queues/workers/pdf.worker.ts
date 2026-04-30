import { generateInvoicePdf } from "../../modules/invoice/invoice.service.js";
import type { AppQueueJobHandlerMap } from "../types.js";

export const pdfJobHandlers: Pick<
  AppQueueJobHandlerMap,
  "generateInvoicePDF"
> = {
  generateInvoicePDF: async (job) => {
    const invoiceId = job.data.payload.invoiceId;
    const result = await generateInvoicePdf(
      job.data.context.userId as number,
      invoiceId,
    );

    return {
      invoiceId,
      invoiceNumber: result.invoiceNumber,
      bytes: result.buffer.length,
    };
  },
};
