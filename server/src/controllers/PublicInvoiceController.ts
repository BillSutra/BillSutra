import type { Request, Response } from "express";
import { getPublicInvoice } from "../modules/invoice/invoice.service.js";
import { sendResponse } from "../utils/sendResponse.js";

class PublicInvoiceController {
  static async show(req: Request, res: Response) {
    try {
      const invoice = await getPublicInvoice(req.params.id);

      if (!invoice) {
        return sendResponse(res, 404, { message: "Invoice not found" });
      }

      res.setHeader("X-Robots-Tag", "noindex, nofollow");

      return sendResponse(res, 200, {
        message: "Invoice retrieved",
        data: invoice,
      });
    } catch (error) {
      const err = error as Error & { status?: number };

      if (err.status) {
        return sendResponse(res, err.status, { message: err.message });
      }

      return sendResponse(res, 500, {
        message: "Unable to retrieve invoice",
      });
    }
  }
}

export default PublicInvoiceController;
