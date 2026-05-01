import crypto from "crypto";
import path from "path";
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
import { invalidateCustomerListCaches } from "../lib/cacheInvalidation.js";
import { paymentProofStorage } from "../services/storage/paymentProofStorage.js";
import { getBackendAppUrl } from "../lib/appUrls.js";
import {
  buildSecureFileUrl,
  deleteUploadedFileById,
  deleteUploadedFileByPath,
  isUploadedFilesTableAvailable,
  registerUploadedFile,
} from "../services/uploadedFiles.service.js";

type PaymentCreateInput = z.infer<typeof paymentCreateSchema>;
type PaymentUpdateInput = z.infer<typeof paymentUpdateSchema>;
type TransactionClient = Prisma.TransactionClient;
type PaymentStatusInput = PaymentCreateInput["status"];

const PAYMENT_IDEMPOTENCY_COLUMN_CHECK_TTL_MS = 60_000;
const MAX_PAYMENT_TRANSACTION_RETRIES = 2;
const PAYMENT_VALID_STATUSES = new Set<PaymentStatusInput>(["PAID", "PARTIAL"]);
const DIGITAL_PAYMENT_METHODS = new Set<PaymentMethod>([
  PaymentMethod.UPI,
  PaymentMethod.BANK_TRANSFER,
  PaymentMethod.NEFT,
  PaymentMethod.RTGS,
  PaymentMethod.IMPS,
  PaymentMethod.CARD,
  PaymentMethod.WALLET,
]);
const MIN_VALID_PAYMENT_DATE = new Date("2000-01-01T00:00:00.000Z");

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

type PaymentWithOptionalInvoice = Payment & {
  invoice?: {
    id: number;
    invoice_number: string;
    status: InvoiceStatus;
    total: Prisma.Decimal;
    due_date: Date | null;
    customer?: {
      id: number;
      name: string;
      email: string | null;
    } | null;
  } | null;
};

const toAbsoluteUploadUrl = (value?: string | null) => {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `${getBackendAppUrl()}${value.startsWith("/") ? value : `/${value}`}`;
};

const serializeProofUrl = (payment: Payment) => {
  if (payment.proof_file_id) {
    return buildSecureFileUrl(payment.proof_file_id);
  }

  if (!payment.proof_url || payment.proof_url.startsWith("/uploads/private/")) {
    return null;
  }

  return toAbsoluteUploadUrl(payment.proof_url);
};

const serializePayment = (payment: PaymentWithOptionalInvoice) => ({
  id: payment.id,
  user_id: payment.user_id,
  invoice_id: payment.invoice_id,
  amount: Number(payment.amount),
  method: payment.method,
  provider: payment.provider,
  transaction_id: maybeDecryptSensitiveValue(payment.transaction_id),
  utrNumber: maybeDecryptSensitiveValue(payment.transaction_id),
  reference: maybeDecryptSensitiveValue(payment.reference),
  notes: payment.notes,
  chequeNumber: payment.cheque_number,
  bankName: payment.bank_name,
  depositDate: payment.deposit_date
    ? new Date(payment.deposit_date).toISOString()
    : null,
  proofUrl: serializeProofUrl(payment),
  proofFileName: payment.proof_file_name,
  proofMimeType: payment.proof_mime_type,
  proofSize: payment.proof_size,
  uploadedAt: payment.proof_uploaded_at
    ? new Date(payment.proof_uploaded_at).toISOString()
    : null,
  uploadedBy: payment.proof_uploaded_by,
  verifiedBy: payment.verified_by,
  hasProof: Boolean(payment.proof_url || payment.proof_file_id),
  paid_at: payment.paid_at ? new Date(payment.paid_at).toISOString() : null,
  created_at: new Date(payment.created_at).toISOString(),
  updated_at: new Date(payment.updated_at).toISOString(),
  invoice: payment.invoice
    ? {
        id: payment.invoice.id,
        invoice_number: payment.invoice.invoice_number,
        status: payment.invoice.status,
        total: Number(payment.invoice.total),
        due_date: payment.invoice.due_date
          ? new Date(payment.invoice.due_date).toISOString()
          : null,
        customer: payment.invoice.customer
          ? {
              id: payment.invoice.customer.id,
              name: payment.invoice.customer.name,
              email: payment.invoice.customer.email,
            }
          : null,
      }
    : undefined,
});

const normalizeTransactionReference = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toUpperCase() : null;
};

const normalizeOptionalString = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const hasMoreThanTwoDecimals = (value: number) =>
  Math.abs(value * 100 - Math.round(value * 100)) >= 1e-6;

const findPaymentByTransactionReference = async (params: {
  userId: number;
  transactionId: string;
  excludePaymentId?: number | null;
}) => {
  const { userId, transactionId, excludePaymentId } = params;
  const candidates = await prisma.payment.findMany({
    where: {
      user_id: userId,
      transaction_id: {
        not: null,
      },
      ...(excludePaymentId ? { NOT: { id: excludePaymentId } } : {}),
    },
    select: {
      id: true,
      invoice_id: true,
      transaction_id: true,
    },
  });

  return (
    candidates.find(
      (candidate) =>
        normalizeTransactionReference(
          maybeDecryptSensitiveValue(candidate.transaction_id),
        ) === transactionId,
    ) ?? null
  );
};

const validatePaymentDetails = async (params: {
  userId: number;
  paymentId?: number | null;
  body: PaymentCreateInput | PaymentUpdateInput;
  remainingBeforeWrite: number;
}) => {
  const { userId, paymentId, body, remainingBeforeWrite } = params;
  const amount = Number(body.amount);
  const method = body.method;
  const status = body.status;
  const paidAt = new Date(body.paid_at);
  const depositDate = body.deposit_date ? new Date(body.deposit_date) : null;
  const transactionId = normalizeTransactionReference(body.transaction_id);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new AppError("Payment amount must be greater than zero.", 422);
  }

  if (hasMoreThanTwoDecimals(amount)) {
    throw new AppError("Payment amount can have at most 2 decimal places.", 422);
  }

  if (amount > remainingBeforeWrite + 0.009) {
    throw new AppError("Payment amount exceeds the remaining invoice balance.", 422);
  }

  if (!PAYMENT_VALID_STATUSES.has(status)) {
    throw new AppError(
      "Only paid or partial payment records can be saved from this payment flow.",
      422,
    );
  }

  if (status === "PARTIAL" && amount >= remainingBeforeWrite - 0.009) {
    throw new AppError("Partial payments must be less than the due balance.", 422);
  }

  if (status === "PAID" && amount < remainingBeforeWrite - 0.009) {
    throw new AppError(
      "Use Partial status when the payment amount is less than the due balance.",
      422,
    );
  }

  if (Number.isNaN(paidAt.getTime())) {
    throw new AppError("Payment date is invalid.", 422);
  }

  if (paidAt.getTime() > Date.now()) {
    throw new AppError("Payment date cannot be in the future.", 422);
  }

  if (paidAt.getTime() < MIN_VALID_PAYMENT_DATE.getTime()) {
    throw new AppError("Payment date is too old to be valid.", 422);
  }

  if (method === PaymentMethod.CHEQUE) {
    if (depositDate && Number.isNaN(depositDate.getTime())) {
      throw new AppError("Deposit date is invalid.", 422);
    }

    if (depositDate && depositDate.getTime() > Date.now()) {
      throw new AppError("Deposit date cannot be in the future.", 422);
    }
    if (depositDate && depositDate.getTime() < MIN_VALID_PAYMENT_DATE.getTime()) {
      throw new AppError("Deposit date is too old to be valid.", 422);
    }
  }

  if (transactionId) {
    const duplicatePayment = await findPaymentByTransactionReference({
      userId,
      transactionId,
      excludePaymentId: paymentId ?? null,
    });

    if (duplicatePayment) {
      throw new AppError("This transaction reference already exists.", 409);
    }
  }

  return {
    amount,
    paidAt,
    depositDate,
    method,
    status,
    transactionId,
    provider: normalizeOptionalString(body.provider),
    reference: normalizeOptionalString(body.reference),
    notes: normalizeOptionalString(body.notes),
    chequeNumber: normalizeOptionalString(body.cheque_number),
    bankName: normalizeOptionalString(body.bank_name),
  };
};

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
      notes,
      cheque_number,
      bank_name,
      deposit_date,
      proof_url,
      proof_file_name,
      proof_file_path,
      proof_file_id,
      proof_mime_type,
      proof_size,
      proof_uploaded_at,
      proof_uploaded_by,
      verified_by,
      paid_at,
      created_at,
      updated_at
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

          const paidBeforeWriteAggregate = await tx.payment.aggregate({
            where: { invoice_id: body.invoice_id },
            _sum: { amount: true },
          });
          const paidBeforeWrite = Number(paidBeforeWriteAggregate._sum.amount ?? 0);
          const remainingBeforeWrite = Math.max(
            Number(invoice.total) - paidBeforeWrite,
            0,
          );
          const validated = await validatePaymentDetails({
            userId,
            body,
            remainingBeforeWrite,
          });

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
                amount: validated.amount,
                method: validated.method,
                provider: validated.provider,
                transaction_id: encryptSensitiveValue(
                  validated.transactionId,
                ),
                reference: encryptSensitiveValue(
                  validated.reference,
                ),
                notes: validated.notes,
                cheque_number: validated.chequeNumber,
                bank_name: validated.bankName,
                deposit_date: validated.depositDate ?? undefined,
                verified_by:
                  req.user?.name?.trim() ||
                  req.user?.email?.trim() ||
                  req.user?.actorId?.trim() ||
                  null,
                paid_at: validated.paidAt,
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
  req: Request;
}): Promise<PaymentUpdateTransactionResult> => {
  const { userId, paymentId, body, req } = params;

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
      const remainingBeforeWrite = Math.max(invoiceTotal - otherPaidAmount, 0);
      const validated = await validatePaymentDetails({
        userId,
        paymentId: existingPayment.id,
        body,
        remainingBeforeWrite,
      });

      const updatedPayment = await tx.payment.update({
        where: { id: existingPayment.id },
        data: {
          amount: validated.amount,
          method: validated.method,
          provider: validated.provider,
          transaction_id: encryptSensitiveValue(validated.transactionId),
          reference: encryptSensitiveValue(validated.reference),
          notes: validated.notes,
          cheque_number: validated.chequeNumber,
          bank_name: validated.bankName,
          deposit_date: validated.depositDate ?? null,
          verified_by:
            body.status === "PAID" || body.status === "PARTIAL"
              ? req.user?.name?.trim() ||
                req.user?.email?.trim() ||
                req.user?.actorId?.trim() ||
                null
              : null,
          paid_at: validated.paidAt,
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

type PaymentDeleteTransactionResult = {
  deletedPayment: Payment;
  invoiceId: number;
  invoiceNumber: string;
  invoiceStatus: InvoiceStatus;
  paidAmount: number;
  totalAmount: number;
};

const runPaymentDeleteTransaction = async (params: {
  userId: number;
  paymentId: number;
}): Promise<PaymentDeleteTransactionResult> => {
  const { userId, paymentId } = params;

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

      await tx.payment.delete({
        where: { id: existingPayment.id },
      });

      const totals = await tx.payment.aggregate({
        where: { invoice_id: existingPayment.invoice_id },
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
        deletedPayment: existingPayment,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
        invoiceStatus,
        paidAmount,
        totalAmount,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
};

const persistPaymentProof = async (params: {
  userId: number;
  paymentProof: Express.Multer.File;
}) => {
  const { userId, paymentProof } = params;
  const secureProofStorageEnabled = await isUploadedFilesTableAvailable();
  let proof = await paymentProofStorage.save(userId, paymentProof, {
    secure: secureProofStorageEnabled,
  });
  let uploadedFileRecord: Awaited<ReturnType<typeof registerUploadedFile>> = null;

  if (proof.secure) {
    try {
      uploadedFileRecord = await registerUploadedFile({
        ownerUserId: userId,
        fileName: path.basename(proof.filePath),
        originalName: paymentProof.originalname,
        filePath: proof.filePath,
        type: "payment_proof",
        mimeType: paymentProof.mimetype,
      });
    } catch (error) {
      console.warn(
        "[payments] secure proof registration failed; falling back to legacy proof access",
        {
          userId,
          message: error instanceof Error ? error.message : error,
        },
      );

      await paymentProofStorage.delete(proof.filePath);
      proof = await paymentProofStorage.save(userId, paymentProof, {
        secure: false,
      });
    }

    if (!uploadedFileRecord && proof.secure) {
      await paymentProofStorage.delete(proof.filePath);
      proof = await paymentProofStorage.save(userId, paymentProof, {
        secure: false,
      });
    }
  }

  return {
    proof,
    uploadedFileRecord,
  };
};

const removeStoredPaymentProof = async (payment: Payment) => {
  await paymentProofStorage.delete(payment.proof_file_path);
  await deleteUploadedFileById(payment.proof_file_id);
  await deleteUploadedFileByPath(payment.proof_file_path);
};

class PaymentsController {
  static async index(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const payments = await prisma.payment.findMany({
      where: { user_id: userId },
      include: {
        invoice: {
          select: {
            id: true,
            invoice_number: true,
            status: true,
            total: true,
            due_date: true,
            customer: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: [{ paid_at: "desc" }, { created_at: "desc" }],
    });

    return sendResponse(res, 200, {
      data: payments.map(serializePayment),
    });
  }

  static async checkTransactionReference(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const transactionId = normalizeTransactionReference(
      typeof req.query.transaction_id === "string"
        ? req.query.transaction_id
        : null,
    );
    const paymentId =
      typeof req.query.payment_id === "string"
        ? Number(req.query.payment_id)
        : undefined;

    if (!transactionId) {
      return sendResponse(res, 400, {
        message: "Transaction reference is required.",
      });
    }

    const existingPayment = await findPaymentByTransactionReference({
      userId,
      transactionId,
      excludePaymentId:
        typeof paymentId === "number" && Number.isFinite(paymentId)
          ? paymentId
          : null,
    });

    return sendResponse(res, 200, {
      data: {
        exists: Boolean(existingPayment),
      },
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
        void invalidateCustomerListCaches(businessId, userId);
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
      orderBy: [{ paid_at: "desc" }, { created_at: "desc" }],
    });

    return sendResponse(res, 200, { data: payments.map(serializePayment) });
  }

  static async update(req: Request, res: Response) {
    const userId = req.user?.id;
    const businessId = req.user?.businessId?.trim();
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
        req,
      });

      const computedStatus = computeInvoiceStatus(
        result.paidAmount,
        result.totalAmount,
      );

      void invalidateCustomerListCaches(businessId, userId);
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

  static async uploadProof(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const paymentId = Number(req.params.id);
    if (!req.file) {
      return sendResponse(res, 400, { message: "Payment proof is required." });
    }

    const existingPayment = await prisma.payment.findFirst({
      where: { id: paymentId, user_id: userId },
    });

    if (!existingPayment) {
      return sendResponse(res, 404, { message: "Payment not found" });
    }

    const uploadedBy =
      req.user?.name?.trim() ||
      req.user?.email?.trim() ||
      req.user?.actorId?.trim() ||
      `user:${userId}`;
    const previousProofPath = existingPayment.proof_file_path;
    const previousProofFileId = existingPayment.proof_file_id;
    let nextProofPath: string | null = null;
    let nextProofFileId: string | null = null;
    let proofCommitted = false;

    try {
      const { proof, uploadedFileRecord } = await persistPaymentProof({
        userId,
        paymentProof: req.file,
      });
      nextProofPath = proof.filePath;
      nextProofFileId = uploadedFileRecord?.id ?? null;

      const updatedPayment = await prisma.payment.update({
        where: { id: paymentId },
        data: {
          proof_url: proof.url,
          proof_file_name: req.file.originalname,
          proof_file_path: proof.filePath,
          proof_file_id: uploadedFileRecord?.id ?? null,
          proof_mime_type: req.file.mimetype,
          proof_size: req.file.size,
          proof_uploaded_at: new Date(),
          proof_uploaded_by: uploadedBy,
        },
      });
      proofCommitted = true;

      if (previousProofPath || previousProofFileId) {
        await paymentProofStorage.delete(previousProofPath);
        await deleteUploadedFileById(previousProofFileId);
        await deleteUploadedFileByPath(previousProofPath);
      }

      await recordAuditLog({
        req,
        userId,
        actorId: req.user?.actorId ?? String(userId),
        actorType: req.user?.accountType ?? "OWNER",
        action: "payment.proof.upload",
        resourceType: "payment",
        resourceId: String(updatedPayment.id),
        status: "success",
        metadata: {
          invoiceId: updatedPayment.invoice_id,
          fileName: updatedPayment.proof_file_name,
          mimeType: updatedPayment.proof_mime_type,
          size: updatedPayment.proof_size,
        },
      });

      nextProofPath = null;
      nextProofFileId = null;

      return sendResponse(res, 200, {
        message: "Payment proof uploaded",
        data: serializePayment(updatedPayment),
      });
    } catch (error) {
      captureServerException(error, req, {
        level: "error",
        tags: {
          flow: "payments.proof.upload",
          payment_id: paymentId,
          invoice_id: existingPayment.invoice_id,
        },
        extra: {
          userId,
          fileName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
        },
      });
      if (!proofCommitted) {
        await paymentProofStorage.delete(nextProofPath);
        await deleteUploadedFileById(nextProofFileId);
        await deleteUploadedFileByPath(nextProofPath);
      }
      throw error;
    }
  }

  static async deleteProof(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const paymentId = Number(req.params.id);
    const existingPayment = await prisma.payment.findFirst({
      where: { id: paymentId, user_id: userId },
    });

    if (!existingPayment) {
      return sendResponse(res, 404, { message: "Payment not found" });
    }

    if (!existingPayment.proof_url && !existingPayment.proof_file_id) {
      return sendResponse(res, 200, {
        message: "Payment proof removed",
        data: serializePayment(existingPayment),
      });
    }

    await removeStoredPaymentProof(existingPayment);

    const updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        proof_url: null,
        proof_file_name: null,
        proof_file_path: null,
        proof_file_id: null,
        proof_mime_type: null,
        proof_size: null,
        proof_uploaded_at: null,
        proof_uploaded_by: null,
      },
    });

    await recordAuditLog({
      req,
      userId,
      actorId: req.user?.actorId ?? String(userId),
      actorType: req.user?.accountType ?? "OWNER",
      action: "payment.proof.delete",
      resourceType: "payment",
      resourceId: String(updatedPayment.id),
      status: "success",
      metadata: {
        invoiceId: updatedPayment.invoice_id,
      },
    });

    return sendResponse(res, 200, {
      message: "Payment proof removed",
      data: serializePayment(updatedPayment),
    });
  }

  static async destroy(req: Request, res: Response) {
    const userId = req.user?.id;
    const businessId = req.user?.businessId?.trim();
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const paymentId = Number(req.params.id);

    try {
      const result = await runPaymentDeleteTransaction({ userId, paymentId });
      await removeStoredPaymentProof(result.deletedPayment);

      const computedStatus = computeInvoiceStatus(
        result.paidAmount,
        result.totalAmount,
      );

      void invalidateCustomerListCaches(businessId, userId);
      emitDashboardUpdate({ userId, source: "payment.delete" });
      emitRealtimeInvoiceUpdated({
        userId,
        invoiceId: result.invoiceId,
        status: result.invoiceStatus,
        totalPaid: result.paidAmount,
        computedStatus,
        source: "payment.delete",
      });

      await recordAuditLog({
        req,
        userId,
        actorId: req.user?.actorId ?? String(userId),
        actorType: req.user?.accountType ?? "OWNER",
        action: "payment.delete",
        resourceType: "payment",
        resourceId: String(result.deletedPayment.id),
        status: "success",
        metadata: {
          invoiceId: result.invoiceId,
          amount: Number(result.deletedPayment.amount),
          method: result.deletedPayment.method,
        },
      });

      return sendResponse(res, 200, {
        message: "Payment deleted",
        data: {
          id: result.deletedPayment.id,
          invoiceId: result.invoiceId,
        },
      });
    } catch (error) {
      captureServerException(error, req, {
        level: "error",
        tags: {
          flow: "payments.delete",
          payment_id: paymentId,
        },
        extra: {
          userId,
        },
      });
      throw error;
    }
  }
}

export default PaymentsController;
