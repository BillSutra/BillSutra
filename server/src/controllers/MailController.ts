import type { Request, Response } from "express";
import { sendResponse } from "../utils/sendResponse.js";
import {
  sendTemplateEmail,
  sendInvoiceEmailWithPdf,
} from "../services/mailService.js";
import { getFrontendAppUrl } from "../lib/appUrls.js";

class MailController {
  static async sendTestEmail(req: Request, res: Response) {
    const recipient =
      typeof req.body?.to === "string" && req.body.to.trim()
        ? req.body.to.trim()
        : typeof req.user?.email === "string" && req.user.email.trim()
          ? req.user.email.trim()
          : "";

    if (!recipient) {
      return sendResponse(res, 400, {
        message: "A destination email address is required.",
      });
    }

    const template = req.body.template;
    const requestedSubject =
      typeof req.body?.subject === "string" && req.body.subject.trim()
        ? req.body.subject.trim()
        : undefined;

    try {
      let result;

      switch (template) {
        case "invoice": {
          const invoiceData = {
            businessName: req.body.businessName || "BillSutra Demo Business",
            businessLogoUrl: req.body.businessLogoUrl || undefined,
            customerName: req.body.customerName || "Demo Customer",
            invoiceId: req.body.invoiceId || "INV-2026-0001",
            items: [
              { name: "Premium Plan", qty: 1, price: 2999 },
              { name: "Support Add-on", qty: 1, price: 499 },
            ],
            gst: 630,
            discount: 100,
            total: req.body.amount || 4028,
            downloadLink:
              req.body.downloadLink ||
              new URL("/invoices", `${getFrontendAppUrl()}/`).toString(),
          };

          const pdfBuffer =
            req.body.attachPdf && typeof req.body.invoicePdfBase64 === "string"
              ? Buffer.from(req.body.invoicePdfBase64, "base64")
              : undefined;

          result = await sendInvoiceEmailWithPdf({
            to: recipient,
            data: invoiceData,
            pdfBuffer,
            pdfFileName: `${invoiceData.invoiceId}.pdf`,
          });
          break;
        }
        case "payment_success":
          result = await sendTemplateEmail({
            template,
            to: recipient,
            subject: requestedSubject,
            data: {
              amount: req.body.amount || 1499,
              transactionId: req.body.transactionId || "TXN-DEMO-2026-001",
            },
          });
          break;
        case "plan_activation":
          result = await sendTemplateEmail({
            template,
            to: recipient,
            subject: requestedSubject,
            data: {
              planName: req.body.planName || "Growth Plan",
              validity: req.body.validity || "31 Dec 2026",
            },
          });
          break;
        case "otp":
        default:
          result = await sendTemplateEmail({
            template: "otp",
            to: recipient,
            subject: requestedSubject,
            data: {
              otp: req.body.otp || "482913",
              expiresInMinutes: req.body.expiresInMinutes || 5,
            },
          });
          break;
      }

      if (!result.success) {
        return sendResponse(res, 502, {
          message: result.error?.message || "Unable to send test email.",
          data: result,
        });
      }

      return sendResponse(res, 200, {
        message: `Test email sent to ${recipient}`,
        data: {
          ...result,
          recipient,
          template,
          attachmentCount:
            template === "invoice" && req.body.attachPdf && req.body.invoicePdfBase64
              ? 1
              : 0,
        },
      });
    } catch (error) {
      console.error("[mailController] send test email failed", {
        error: error instanceof Error ? error.message : error,
        recipient,
        template,
      });

      return sendResponse(res, 500, {
        message:
          error instanceof Error
            ? error.message
            : "Unexpected mail controller error.",
      });
    }
  }
}

export default MailController;
