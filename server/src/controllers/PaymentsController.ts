import crypto from "crypto";
import type { Request, Response } from "express";
import {
  InvoiceStatus,
  PaymentMethod,
  Prisma,
  type Payment,
} from "@prisma/client";
import type { z } from "zod";
import prisma from "../config/db.config.js";
import { sendResponse } from "../utils/sendResponse.js";
import AppError from "../utils/AppError.js";
import {
  paymentCreateSchema,
  paymentUpdateSchema,
} from "../validations/apiValidations.js";
import { emitDashboardUpdate } from "../services/dashboardRealtime.js";
import { dispatchNotification } from "../services/notification.service.js";
import {
  emitRealtimeInvoiceUpdated,
  emitRealtimePaymentAdded,
} from "../services/realtimeSocket.service.js";
import {
  captureServerException,
  captureServerMessage,
} from "../lib/observability.js";
import { dispatchPaymentReceivedEmail } from "../services/notificationEmail.service.js";
import { computeInvoiceStatus } from "../utils/invoicePaymentSnapshot.js";
import {
  encryptSensitiveValue,
  maybeDecryptSensitiveValue,
} from "../lib/fieldEncryption.js";
import { recordAuditLog } from "../services/auditLog.service.js";

type PaymentCreateInput = z.infer<typeof paymentCreateSchema>;
type PaymentUpdateInput = z.infer<typeof paymentUpdateSchema>;
type TransactionClient = Prisma.TransactionClient;

const PAYMENT_IDEMPOTENCY_COLUMN_CHECK_TTL_MS = 60_000;
const MAX_PAYMENT_TRANSACTION_RETRIES = 2;

let paymentIdempotencyColumnAvailability:
  | { exists: boolean; checkedAt: number }
  | null = null;

const isPaymentIdempotencyColumnMissingError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  (error.code === "P2021" || error.code === "P2022");

const isTransactionConflictError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2034";

const isPaymentIdempotencyConflictError = (error: unknown) => {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  if (error.code !== "P2002") {
    return false;
  }

  const target = error.meta?.target;
  const targetText = Array.isArray(target)
    ? target.join(",")
    : typeof target === "string"
      ? target
      : "";

  return /payment_idempotency_key/i.test(targetText);
};

const hasPaymentIdempotencyColumn = async () => {
  const now = Date.now();
  if (
    paymentIdempotencyColumnAvailability &&
    now - paymentIdempotencyColumnAvailability.checkedAt <
      PAYMENT_IDEMPOTENCY_COLUMN_CHECK_TTL_MS
  ) {
    return paymentIdempotencyColumnAvailability.exists;
  }

  try {
    const result = await prisma.$queryRaw<Array<{ exists: boolean }>>(Prisma.sql`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'payments'
          AND column_name = 'payment_idempotency_key'
      ) AS "exists"
    `);

    const exists = result[0]?.exists === true;
    paymentIdempotencyColumnAvailability = {
      exists,
      checkedAt: now,
    };
    return exists;
  } catch {
    paymentIdempotencyColumnAvailability = {
      exists: false,
      checkedAt: now,
    };
    return false;
  }
};

const resolveHeaderValue = (req: Request, headerName: string) => {
  const value = req.headers[headerName];
  if (Array.isArray(value)) {
    return value[0]?.trim() || null;
  }

  return typeof value === "string" && value.trim() ? value.trim() : null;
};

const resolvePaymentIdempotencyKey = (
  req: Request,
  body: PaymentCreateInput,
  userId: number,
) => {
  const explicitKey =
    resolveHeaderValue(req, "idempotency-key") ??
    resolveHeaderValue(req, "x-idempotency-key");

  const sourcePayload = explicitKey
    ? {
        source: "header",
        value: explicitKey,
      }
    : {
        source: "payload_fingerprint",
        value: JSON.stringify({
          userId,
          invoiceId: body.invoice_id,
          amount: Number(body.amount).toFixed(2),
          method: body.method ?? PaymentMethod.CASH,
          provider: body.provider?.trim() ?? null,
          transactionId: body.transaction_id?.trim() ?? null,
          reference: body.reference?.trim() ?? null,
          paidAt: body.paid_at ? new Date(body.paid_at).toISOString() : null,
        }),
      };

  return {
    source: sourcePayload.source,
    key: crypto
      .createHash("sha256")
      .update(sourcePayload.value)
      .digest("hex"),
  };
};

const serializePayment = (payment: Payment) => ({
  id: payment.id,
  user_id: payment.user_id,
  invoice_id: payment.invoice_id,
  amount: payment.amount,
  method: payment.method,
  provider: payment.provider,
  transaction_id: maybeDecryptSensitiveValue(payment.transaction_id),
  reference: maybeDecryptSensitiveValue(payment.reference),
  paid_at: payment.paid_at,
  created_at: payment.created_at,
});

const logPaymentEvent = (
  event: "start" | "success" | "failure" | "duplicate" | "retry",
  req: Request,
  detail: {
    userId: number;
    invoiceId: number;
    amount: number;
    idempotencyEnabled?: boolean;
    idempotencySource?: string;
    paymentId?: number;
    attempt?: number;
    error?: string;
  },
  level: "info" | "warning" | "error" = "info",
) => {
  const logPayload = {
    invoiceId: detail.invoiceId,
    userId: detail.userId,
    amount: detail.amount,
    idempotencyEnabled: detail.idempotencyEnabled ?? false,
    idempotencySource: detail.idempotencySource ?? null,
    paymentId: detail.paymentId ?? null,
    attempt: detail.attempt ?? null,
    error: detail.error ?? null,
  };

  const logger =
    level === "error"
      ? console.error
      : level === "warning"
        ? console.warn
        : console.info;

  logger(`[payments] ${event}`, logPayload);
  captureServerMessage(`Payment ${event}`, req, {
    level,
    tags: {
      flow: "payments.store",
      event,
      invoice_id: detail.invoiceId,
      user_id: detail.userId,
    },
    extra: logPayload,
  });
};

const lockInvoiceRow = async (
  tx: TransactionClient,
  invoiceId: number,
  userId: number,
) => {
  const rows = await tx.$queryRaw<
    Array<{
      id: number;
      invoice_number: string;
      total: Prisma.Decimal;
    }>
  >(Prisma.sql`
    SELECT id, invoice_number, total
    FROM "invoices"
    WHERE id = ${invoiceId}
      AND user_id = ${userId}
    FOR UPDATE
  `);

  return rows[0] ?? null;
};

const findPaymentByIdempotencyKey = async (
  db: Pick<TransactionClient, "$queryRaw">,
  userId: number,
  paymentIdempotencyKey: string,
) => {
  const rows = await db.$queryRaw<Payment[]>(Prisma.sql`
    SELECT
      id,
      user_id,
      invoice_id,
      amount,
      method,
      provider,
      transaction_id,
      payment_idempotency_key,
      reference,
      paid_at,
      created_at
    FROM "payments"
    WHERE user_id = ${userId}
      AND payment_idempotency_key = ${paymentIdempotencyKey}
    LIMIT 1
  `);

  return rows[0] ?? null;
};

const resolveInvoiceStatus = (paid: number, total: number) => {
  if (paid >= total) {
    return InvoiceStatus.PAID;
  }

  if (paid > 0) {
    return InvoiceStatus.PARTIALLY_PAID;
  }

  return InvoiceStatus.SENT;
};

type PaymentTransactionResult = {
  payment: Payment;
  invoiceId: number;
  invoiceNumber: string;
  invoiceStatus: InvoiceStatus;
  paidAmount: number;
  totalAmount: number;
  createdNewPayment: boolean;
};

type PaymentUpdateTransactionResult = {
  payment: Payment;
  previousPayment: Payment;
  invoiceId: number;
  invoiceNumber: string;
  invoiceStatus: InvoiceStatus;
  paidAmount: number;
  totalAmount: number;
};

const runPaymentTransaction = async (params: {
  userId: number;
  body: PaymentCreateInput;
  idempotencyEnabled: boolean;
  paymentIdempotencyKey: string | null;
  req: Request;
}): Promise<PaymentTransactionResult> => {
  const { userId, body, idempotencyEnabled, paymentIdempotencyKey, req } = params;

  for (let attempt = 1; attempt <= MAX_PAYMENT_TRANSACTION_RETRIES; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const invoice = await lockInvoiceRow(tx, body.invoice_id, userId);

          if (!invoice) {
            throw new AppError("Invoice not found", 404);
          }

          let payment: Payment | null = null;
          let createdNewPayment = false;

          if (idempotencyEnabled && paymentIdempotencyKey) {
            payment = await findPaymentByIdempotencyKey(
              tx,
              userId,
              paymentIdempotencyKey,
            );

            if (payment && payment.invoice_id !== invoice.id) {
              throw new AppError(
                "This idempotency key has already been used for another payment.",
                409,
              );
            }
          }

          if (!payment) {
            payment = await tx.payment.create({
              data: {
                user_id: userId,
                invoice_id: body.invoice_id,
                amount: body.amount,
                method: body.method ?? PaymentMethod.CASH,
                provider: body.provider,
                transaction_id: encryptSensitiveValue(
                  body.transaction_id?.trim() || null,
                ),
                reference: encryptSensitiveValue(
                  body.reference?.trim() || null,
                ),
                paid_at: body.paid_at ?? undefined,
                ...(idempotencyEnabled && paymentIdempotencyKey
                  ? { payment_idempotency_key: paymentIdempotencyKey }
                  : {}),
              },
            });
            createdNewPayment = true;
          }

          const totals = await tx.payment.aggregate({
            where: { invoice_id: body.invoice_id },
            _sum: { amount: true },
          });

          const paidAmount = Number(totals._sum.amount ?? 0);
          const totalAmount = Number(invoice.total);
          const invoiceStatus = resolveInvoiceStatus(paidAmount, totalAmount);

          await tx.invoice.update({
            where: { id: invoice.id },
            data: { status: invoiceStatus },
          });

          return {
            payment,
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoice_number,
            invoiceStatus,
            paidAmount,
            totalAmount,
            createdNewPayment,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    } catch (error) {
      if (isPaymentIdempotencyColumnMissingError(error)) {
        paymentIdempotencyColumnAvailability = {
          exists: false,
          checkedAt: Date.now(),
        };
      }

      if (
        isTransactionConflictError(error) &&
        attempt < MAX_PAYMENT_TRANSACTION_RETRIES
      ) {
        logPaymentEvent(
          "retry",
          req,
          {
            userId,
            invoiceId: body.invoice_id,
            amount: Number(body.amount),
            attempt,
            error: error instanceof Error ? error.message : "transaction_conflict",
          },
          "warning",
        );
        continue;
      }

      throw error;
    }
  }

  throw new AppError("Unable to record payment right now. Please try again.", 409);
};

const logPaymentUpdateEvent = (
  event: "start" | "success" | "failure",
  req: Request,
  detail: {
    userId: number;
    paymentId: number;
    invoiceId: number;
    previousAmount?: number;
    nextAmount?: number;
    previousMethod?: PaymentMethod | null;
    nextMethod?: PaymentMethod | null;
    error?: string;
  },
  level: "info" | "warning" | "error" = "info",
) => {
  const payload = {
    paymentId: detail.paymentId,
    invoiceId: detail.invoiceId,
    userId: detail.userId,
    previousAmount: detail.previousAmount ?? null,
    nextAmount: detail.nextAmount ?? null,
    previousMethod: detail.previousMethod ?? null,
    nextMethod: detail.nextMethod ?? null,
    error: detail.error ?? null,
  };

  const logger =
    level === "error"
      ? console.error
      : level === "warning"
        ? console.warn
        : console.info;

  logger(`[payments.update] ${event}`, payload);
  captureServerMessage(`Payment update ${event}`, req, {
    level,
    tags: {
      flow: "payments.update",
      event,
      invoice_id: detail.invoiceId,
      payment_id: detail.paymentId,
      user_id: detail.userId,
    },
    extra: payload,
  });
};

const runPaymentUpdateTransaction = async (params: {
  userId: number;
  paymentId: number;
  body: PaymentUpdateInput;
}): Promise<PaymentUpdateTransactionResult> => {
  const { userId, paymentId, body } = params;

  return prisma.$transaction(
    async (tx) => {
      const existingPayment = await tx.payment.findFirst({
        where: { id: paymentId, user_id: userId },
      });

      if (!existingPayment) {
        throw new AppError("Payment not found", 404);
      }

      const invoice = await lockInvoiceRow(tx, existingPayment.invoice_id, userId);
      if (!invoice) {
        throw new AppError("Invoice not found", 404);
      }

      const nextAmount = Number(body.amount ?? existingPayment.amount);
      if (!Number.isFinite(nextAmount) || nextAmount < 0) {
        throw new AppError("Payment amount must be zero or greater.", 422);
      }

      const otherPayments = await tx.payment.aggregate({
        where: {
          invoice_id: existingPayment.invoice_id,
          NOT: { id: existingPayment.id },
        },
        _sum: { amount: true },
      });

      const otherPaidAmount = Number(otherPayments._sum.amount ?? 0);
      const invoiceTotal = Number(invoice.total);

      if (otherPaidAmount + nextAmount > invoiceTotal + 0.009) {
        throw new AppError("Payment amount exceeds the remaining invoice balance.", 422);
      }

      const updatedPayment = await tx.payment.update({
        where: { id: existingPayment.id },
        data: {
          ...(body.amount !== undefined ? { amount: body.amount } : {}),
          ...(body.method !== undefined ? { method: body.method } : {}),
          ...(body.provider !== undefined ? { provider: body.provider } : {}),
          ...(body.transaction_id !== undefined
            ? {
                transaction_id: encryptSensitiveValue(
                  body.transaction_id?.trim() || null,
                ),
              }
            : {}),
          ...(body.reference !== undefined
            ? {
                reference: encryptSensitiveValue(
                  body.reference?.trim() || null,
                ),
              }
            : {}),
          ...(body.paid_at !== undefined ? { paid_at: body.paid_at } : {}),
        },
      });

      const totals = await tx.payment.aggregate({
        where: { invoice_id: existingPayment.invoice_id },
        _sum: { amount: true },
      });

      const paidAmount = Number(totals._sum.amount ?? 0);
      const invoiceStatus = resolveInvoiceStatus(paidAmount, invoiceTotal);

      await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: invoiceStatus },
      });

      return {
        payment: updatedPayment,
        previousPayment: existingPayment,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
        invoiceStatus,
        paidAmount,
        totalAmount: invoiceTotal,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
};

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

    return sendResponse(res, 200, {
      data: payments.map((payment) => ({
        ...serializePayment(payment),
        invoice: payment.invoice,
      })),
    });
  }

  static async store(req: Request, res: Response) {
    const userId = req.user?.id;
    const businessId = req.user?.businessId?.trim();
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const body: PaymentCreateInput = req.body;
    const idempotencyEnabled = await hasPaymentIdempotencyColumn();
    const resolvedIdempotency = resolvePaymentIdempotencyKey(req, body, userId);
    const paymentIdempotencyKey = idempotencyEnabled
      ? resolvedIdempotency.key
      : null;

    logPaymentEvent("start", req, {
      userId,
      invoiceId: body.invoice_id,
      amount: Number(body.amount),
      idempotencyEnabled,
      idempotencySource: idempotencyEnabled ? resolvedIdempotency.source : "disabled",
    });

    try {
      const result = await runPaymentTransaction({
        userId,
        body,
        idempotencyEnabled,
        paymentIdempotencyKey,
        req,
      });

      if (result.createdNewPayment) {
        if (businessId) {
          try {
            const computedStatus = computeInvoiceStatus(
              result.paidAmount,
              result.totalAmount,
            );
            await dispatchNotification({
              userId,
              businessId,
              type: "payment",
              message:
                computedStatus === "PARTIAL"
                  ? `Partial payment of Rs ${Number(body.amount).toFixed(2)} received for invoice ${result.invoiceNumber}.`
                  : `Payment of Rs ${Number(body.amount).toFixed(2)} received for invoice ${result.invoiceNumber}.`,
              referenceKey: `payment-received:${result.payment.id}`,
            });
          } catch (error) {
            captureServerMessage("Payment notification failed after commit", req, {
              level: "warning",
              tags: {
                flow: "payments.store",
                payment_id: result.payment.id,
                invoice_id: result.invoiceId,
              },
              extra: {
                userId,
                amount: Number(body.amount),
                error: error instanceof Error ? error.message : error,
              },
            });
          }
        }

        const computedStatus = computeInvoiceStatus(
          result.paidAmount,
          result.totalAmount,
        );
        emitDashboardUpdate({ userId, source: "payment.create" });
        emitRealtimeInvoiceUpdated({
          userId,
          invoiceId: result.invoiceId,
          status: result.invoiceStatus,
          totalPaid: result.paidAmount,
          computedStatus,
          source: "payment.create",
        });
        emitRealtimePaymentAdded({
          userId,
          invoiceId: result.invoiceId,
          paymentId: result.payment.id,
          amount: Number(result.payment.amount),
          totalPaid: result.paidAmount,
          status: result.invoiceStatus,
          computedStatus,
        });

        void dispatchPaymentReceivedEmail(result.payment.id).catch((error) => {
          captureServerMessage("Payment receipt email dispatch failed", req, {
            level: "warning",
            tags: {
              flow: "payments.store",
              payment_id: result.payment.id,
              invoice_id: result.invoiceId,
            },
            extra: {
              userId,
              error: error instanceof Error ? error.message : String(error),
            },
          });
        });
      } else {
        logPaymentEvent("duplicate", req, {
          userId,
          invoiceId: result.invoiceId,
          amount: Number(body.amount),
          paymentId: result.payment.id,
          idempotencyEnabled,
          idempotencySource: resolvedIdempotency.source,
        });
      }

      logPaymentEvent("success", req, {
        userId,
        invoiceId: result.invoiceId,
        amount: Number(body.amount),
        paymentId: result.payment.id,
        idempotencyEnabled,
        idempotencySource: idempotencyEnabled ? resolvedIdempotency.source : "disabled",
      });
      await recordAuditLog({
        req,
        userId,
        actorId: req.user?.actorId ?? String(userId),
        actorType: req.user?.accountType ?? "OWNER",
        action: "payment.create",
        resourceType: "payment",
        resourceId: String(result.payment.id),
        status: "success",
        metadata: {
          invoiceId: result.invoiceId,
          amount: Number(result.payment.amount),
          method: result.payment.method,
          createdNewPayment: result.createdNewPayment,
        },
      });

      return sendResponse(res, 201, {
        message: "Payment recorded",
        data: serializePayment(result.payment),
      });
    } catch (error) {
      if (
        idempotencyEnabled &&
        paymentIdempotencyKey &&
        isPaymentIdempotencyConflictError(error)
      ) {
        const existingPayment = await findPaymentByIdempotencyKey(
          prisma,
          userId,
          paymentIdempotencyKey,
        );

        if (existingPayment) {
          logPaymentEvent("duplicate", req, {
            userId,
            invoiceId: body.invoice_id,
            amount: Number(body.amount),
            paymentId: existingPayment.id,
            idempotencyEnabled,
            idempotencySource: resolvedIdempotency.source,
          });

          return sendResponse(res, 201, {
            message: "Payment recorded",
            data: serializePayment(existingPayment),
          });
        }
      }

      logPaymentEvent(
        "failure",
        req,
        {
          userId,
          invoiceId: body.invoice_id,
          amount: Number(body.amount),
          idempotencyEnabled,
          idempotencySource: idempotencyEnabled ? resolvedIdempotency.source : "disabled",
          error: error instanceof Error ? error.message : "unknown_error",
        },
        "error",
      );

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

      if (isTransactionConflictError(error)) {
        throw new AppError(
          "Another payment update is in progress for this invoice. Please try again.",
          409,
        );
      }

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

    return sendResponse(res, 200, { data: payments.map(serializePayment) });
  }

  static async update(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const paymentId = Number(req.params.id);
    const body: PaymentUpdateInput = req.body;

    const existingPayment = await prisma.payment.findFirst({
      where: { id: paymentId, user_id: userId },
      select: {
        id: true,
        invoice_id: true,
        amount: true,
        method: true,
      },
    });

    if (!existingPayment) {
      return sendResponse(res, 404, { message: "Payment not found" });
    }

    logPaymentUpdateEvent("start", req, {
      userId,
      paymentId,
      invoiceId: existingPayment.invoice_id,
      previousAmount: Number(existingPayment.amount),
      nextAmount: body.amount ?? Number(existingPayment.amount),
      previousMethod: existingPayment.method,
      nextMethod: body.method ?? existingPayment.method,
    });

    try {
      const result = await runPaymentUpdateTransaction({
        userId,
        paymentId,
        body,
      });

      const computedStatus = computeInvoiceStatus(
        result.paidAmount,
        result.totalAmount,
      );

      emitDashboardUpdate({ userId, source: "payment.update" });
      emitRealtimeInvoiceUpdated({
        userId,
        invoiceId: result.invoiceId,
        status: result.invoiceStatus,
        totalPaid: result.paidAmount,
        computedStatus,
        source: "payment.update",
      });

      logPaymentUpdateEvent("success", req, {
        userId,
        paymentId: result.payment.id,
        invoiceId: result.invoiceId,
        previousAmount: Number(result.previousPayment.amount),
        nextAmount: Number(result.payment.amount),
        previousMethod: result.previousPayment.method,
        nextMethod: result.payment.method,
      });
      await recordAuditLog({
        req,
        userId,
        actorId: req.user?.actorId ?? String(userId),
        actorType: req.user?.accountType ?? "OWNER",
        action: "payment.update",
        resourceType: "payment",
        resourceId: String(result.payment.id),
        status: "success",
        metadata: {
          invoiceId: result.invoiceId,
          previousAmount: Number(result.previousPayment.amount),
          nextAmount: Number(result.payment.amount),
          previousMethod: result.previousPayment.method,
          nextMethod: result.payment.method,
        },
      });

      return sendResponse(res, 200, {
        message: "Payment updated",
        data: serializePayment(result.payment),
      });
    } catch (error) {
      logPaymentUpdateEvent(
        "failure",
        req,
        {
          userId,
          paymentId,
          invoiceId: existingPayment.invoice_id,
          previousAmount: Number(existingPayment.amount),
          nextAmount: body.amount ?? Number(existingPayment.amount),
          previousMethod: existingPayment.method,
          nextMethod: body.method ?? existingPayment.method,
          error: error instanceof Error ? error.message : "unknown_error",
        },
        "error",
      );

      captureServerException(error, req, {
        level: "error",
        tags: {
          flow: "payments.update",
          invoice_id: existingPayment.invoice_id,
          payment_id: paymentId,
        },
        extra: {
          userId,
          body,
        },
      });

      if (isTransactionConflictError(error)) {
        throw new AppError(
          "Another payment update is in progress for this invoice. Please try again.",
          409,
        );
      }

      throw error;
    }
  }
}

export default PaymentsController;
