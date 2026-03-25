import type { Request, Response } from "express";
import { sendResponse } from "../utils/sendResponse.js";
import prisma from "../config/db.config.js";
import { InvoiceStatus, PaymentMethod } from "@prisma/client";
import type { z } from "zod";
import { paymentCreateSchema } from "../validations/apiValidations.js";
import { emitDashboardUpdate } from "../services/dashboardRealtime.js";
import {
  captureServerException,
  captureServerMessage,
} from "../lib/observability.js";

type PaymentCreateInput = z.infer<typeof paymentCreateSchema>;

class PaymentsController {
  static async index(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const payments = await prisma.payment.findMany({
      where: { user_id: userId },
      include: { invoice: true },
      orderBy: { created_at: "desc" },
    });

    return sendResponse(res, 200, { data: payments });
  }

  static async store(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const body: PaymentCreateInput = req.body;

    try {
      const invoice = await prisma.invoice.findFirst({
        where: { id: body.invoice_id, user_id: userId },
      });

      if (!invoice) {
        captureServerMessage("Payment attempted for missing invoice", req, {
          level: "warning",
          tags: {
            flow: "payments.store",
            invoice_id: body.invoice_id,
          },
        });

        return sendResponse(res, 404, { message: "Invoice not found" });
      }

      const payment = await prisma.payment.create({
        data: {
          user_id: userId,
          invoice_id: body.invoice_id,
          amount: body.amount,
          method: body.method ?? PaymentMethod.CASH,
          provider: body.provider,
          transaction_id: body.transaction_id,
          reference: body.reference,
          paid_at: body.paid_at ?? undefined,
        },
      });

      const totals = await prisma.payment.aggregate({
        where: { invoice_id: body.invoice_id },
        _sum: { amount: true },
      });

      const paid = Number(totals._sum.amount ?? 0);
      const total = Number(invoice.total);
      let status: InvoiceStatus = InvoiceStatus.SENT;

      if (paid >= total) {
        status = InvoiceStatus.PAID;
      } else if (paid > 0) {
        status = InvoiceStatus.PARTIALLY_PAID;
      }

      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { status },
      });

      emitDashboardUpdate({ userId, source: "payment.create" });
      return sendResponse(res, 201, {
        message: "Payment recorded",
        data: payment,
      });
    } catch (error) {
      captureServerException(error, req, {
        level: "error",
        tags: {
          flow: "payments.store",
          invoice_id: body.invoice_id,
        },
        extra: {
          amount: body.amount,
          method: body.method ?? PaymentMethod.CASH,
          provider: body.provider ?? null,
        },
      });
      throw error;
    }
  }

  static async showByInvoice(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const invoiceId = Number(req.params.invoiceId);

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, user_id: userId },
      select: { id: true },
    });

    if (!invoice) {
      return sendResponse(res, 404, { message: "Invoice not found" });
    }

    const payments = await prisma.payment.findMany({
      where: { user_id: userId, invoice_id: invoiceId },
      orderBy: { paid_at: "desc" },
    });

    return sendResponse(res, 200, { data: payments });
  }
}

export default PaymentsController;
