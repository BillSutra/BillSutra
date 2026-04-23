import type { Request, Response } from "express";
import { sendResponse } from "../utils/sendResponse.js";
import {
  createAccessRazorpayOrder,
  getAccessPaymentStatus,
  handleRazorpayWebhook,
  reviewAdminUpiPayment,
  submitAccessUpiPayment,
  uploadAccessPaymentProof,
  verifyAccessRazorpayPayment,
  listAdminUpiPayments,
} from "../services/accessPayments.service.js";

class AccessPaymentsController {
  static async status(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const data = await getAccessPaymentStatus(userId);
    return sendResponse(res, 200, { data });
  }

  static async createRazorpayOrder(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const data = await createAccessRazorpayOrder({
      userId,
      planId: req.body.plan_id,
      billingCycle: req.body.billing_cycle,
    });

    return sendResponse(res, 201, {
      message: "Razorpay order created",
      data,
    });
  }

  static async verifyRazorpayPayment(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const data = await verifyAccessRazorpayPayment({
      userId,
      orderId: req.body.razorpay_order_id,
      paymentId: req.body.razorpay_payment_id,
      signature: req.body.razorpay_signature,
    });

    return sendResponse(res, 200, {
      message: "Payment verified successfully",
      data,
    });
  }

  static async submitUpi(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const data = await submitAccessUpiPayment({
      userId,
      planId: req.body.plan_id,
      billingCycle: req.body.billing_cycle,
      name: req.body.name,
      utr: req.body.utr,
      paymentProof: req.file,
    });

    return sendResponse(res, 201, {
      message: "UPI proof submitted successfully",
      data,
    });
  }

  static async uploadProof(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const data = await uploadAccessPaymentProof({
      userId,
      planId: req.body.plan_id,
      billingCycle: req.body.billing_cycle,
      name: req.body.name,
      utr: req.body.utr,
      paymentProof: req.file,
    });

    return sendResponse(res, 201, {
      message: "Proof uploaded. Awaiting approval.",
      data,
    });
  }

  static async listAdminPayments(_req: Request, res: Response) {
    const data = await listAdminUpiPayments();
    return sendResponse(res, 200, { data });
  }

  static async verifyAdminPayment(req: Request, res: Response) {
    if (!req.admin) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const data = await reviewAdminUpiPayment({
      admin: req.admin,
      paymentId: req.body.paymentId,
      status: req.body.status,
      adminNote: req.body.adminNote,
    });

    return sendResponse(res, 200, {
      message: `Payment ${req.body.status}`,
      data,
    });
  }

  static async approvePayment(req: Request, res: Response) {
    if (!req.admin) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const data = await reviewAdminUpiPayment({
      admin: req.admin,
      paymentId: req.params.id,
      status: "approved",
      adminNote: req.body.adminNote,
    });

    return sendResponse(res, 200, {
      message: "Payment approved",
      data,
    });
  }

  static async rejectPayment(req: Request, res: Response) {
    if (!req.admin) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const data = await reviewAdminUpiPayment({
      admin: req.admin,
      paymentId: req.params.id,
      status: "rejected",
      adminNote: req.body.adminNote,
    });

    return sendResponse(res, 200, {
      message: "Payment rejected",
      data,
    });
  }

  static async razorpayWebhook(req: Request, res: Response) {
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(JSON.stringify(req.body ?? {}));
    const signature = req.headers["x-razorpay-signature"]?.toString();

    const data = await handleRazorpayWebhook(rawBody, signature);
    return sendResponse(res, 200, {
      message: "Webhook processed",
      data,
    });
  }

  static async protectedContent(req: Request, res: Response) {
    return sendResponse(res, 200, {
      data: {
        access: true,
        message: "Protected payment-gated content is available for this user.",
      },
    });
  }
}

export default AccessPaymentsController;
