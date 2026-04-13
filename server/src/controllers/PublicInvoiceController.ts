import type { Request, Response } from "express";
import { getPublicInvoice } from "../modules/invoice/invoice.service.js";
import { sendResponse } from "../utils/sendResponse.js";

const readRouteParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

class PublicInvoiceController {
  static async show(req: Request, res: Response) {
    try {
      const reference = readRouteParam(req.params.id);
      if (!reference) {
        return sendResponse(res, 422, {
          message: "Invoice reference is required",
        });
      }

      const invoice = await getPublicInvoice(reference);

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
