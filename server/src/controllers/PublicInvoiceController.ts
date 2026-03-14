import type { Request, Response } from "express";
import { InvoiceStatus } from "@prisma/client";
import prisma from "../config/db.config.js";
import { sendResponse } from "../utils/sendResponse.js";

class PublicInvoiceController {
  static async show(req: Request, res: Response) {
    const id = Number(req.params.id);

    const invoice = await prisma.invoice.findFirst({
      where: { id },
      include: {
        customer: true,
        items: true,
        user: {
          select: {
            business_profile: true,
          },
        },
      },
    });

    if (!invoice) {
      return sendResponse(res, 404, { message: "Invoice not found" });
    }

    // Keep status accurate for public view as well.
    if (
      invoice.due_date &&
      invoice.due_date < new Date() &&
      invoice.status !== InvoiceStatus.PAID &&
      invoice.status !== InvoiceStatus.OVERDUE
    ) {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: InvoiceStatus.OVERDUE },
      });
      invoice.status = InvoiceStatus.OVERDUE;
    }

    return sendResponse(res, 200, {
      data: {
        id: invoice.id,
        invoiceNumber: invoice.invoice_number,
        status: invoice.status,
        issueDate: invoice.date,
        dueDate: invoice.due_date,
        notes: invoice.notes,
        client: invoice.customer,
        businessProfile: invoice.user.business_profile,
        items: invoice.items,
        totals: {
          subtotal: invoice.subtotal,
          tax: invoice.tax,
          discount: invoice.discount,
          total: invoice.total,
        },
      },
    });
  }
}

export default PublicInvoiceController;
