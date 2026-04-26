import { Prisma } from "@prisma/client";
import prisma from "../config/db.config.js";
import { ensureEmailLogCompatibility } from "../lib/schemaCompatibility.js";

export type EmailAuditContext = {
  userId?: number | null;
  invoiceId?: number | null;
  customerId?: number | null;
  metadata?: Prisma.InputJsonValue;
};

const isEmailLogPersistenceError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  (error.code === "P2021" || error.code === "P2022");

const logPersistenceWarning = (
  action: "create" | "sent" | "failed" | "query",
  error: unknown,
) => {
  console.warn("[email] log persistence skipped", {
    action,
    message: error instanceof Error ? error.message : String(error),
  });
};

export const createPendingEmailLog = async (params: {
  type: string;
  recipientEmail: string;
  subject?: string | null;
  audit?: EmailAuditContext;
}) => {
  try {
    await ensureEmailLogCompatibility();
    return await prisma.emailLog.create({
      data: {
        type: params.type,
        recipient_email: params.recipientEmail,
        subject: params.subject ?? null,
        status: "PENDING",
        user_id: params.audit?.userId ?? null,
        invoice_id: params.audit?.invoiceId ?? null,
        customer_id: params.audit?.customerId ?? null,
        metadata: params.audit?.metadata,
      },
      select: { id: true },
    });
  } catch (error) {
    if (isEmailLogPersistenceError(error)) {
      logPersistenceWarning("create", error);
      return null;
    }

    throw error;
  }
};

export const markEmailLogSent = async (params: {
  logId: string;
  providerMessageId?: string | null;
}) => {
  try {
    await ensureEmailLogCompatibility();
    await prisma.emailLog.update({
      where: { id: params.logId },
      data: {
        status: "SENT",
        sent_at: new Date(),
        provider_message_id: params.providerMessageId ?? null,
      },
    });
  } catch (error) {
    if (isEmailLogPersistenceError(error)) {
      logPersistenceWarning("sent", error);
      return;
    }

    throw error;
  }
};

export const markEmailLogFailed = async (params: {
  logId: string;
  errorMessage: string;
}) => {
  try {
    await ensureEmailLogCompatibility();
    await prisma.emailLog.update({
      where: { id: params.logId },
      data: {
        status: "FAILED",
        error_message: params.errorMessage.slice(0, 1000),
      },
    });
  } catch (error) {
    if (isEmailLogPersistenceError(error)) {
      logPersistenceWarning("failed", error);
      return;
    }

    throw error;
  }
};

export const hasSuccessfulEmailLogSince = async (params: {
  type: string;
  since: Date;
  userId?: number | null;
  invoiceId?: number | null;
  customerId?: number | null;
  recipientEmail?: string | null;
}) => {
  try {
    await ensureEmailLogCompatibility();
    const match = await prisma.emailLog.findFirst({
      where: {
        type: params.type,
        status: "SENT",
        created_at: { gte: params.since },
        ...(params.userId ? { user_id: params.userId } : {}),
        ...(params.invoiceId ? { invoice_id: params.invoiceId } : {}),
        ...(params.customerId ? { customer_id: params.customerId } : {}),
        ...(params.recipientEmail
          ? { recipient_email: params.recipientEmail }
          : {}),
      },
      select: { id: true },
    });

    return Boolean(match);
  } catch (error) {
    if (isEmailLogPersistenceError(error)) {
      logPersistenceWarning("query", error);
      return false;
    }

    throw error;
  }
};
