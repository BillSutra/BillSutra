import { enqueueQueueJob } from "../queue.js";
import type { AppQueueContextInput } from "../types.js";

export const enqueueWelcomeEmail = async (params: {
  userId: number;
  context?: AppQueueContextInput;
}) =>
  enqueueQueueJob({
    jobName: "sendWelcomeEmail",
    payload: {},
    context: {
      userId: params.userId,
      ...params.context,
      metadata: {
        ...(params.context?.metadata ?? {}),
        task: "welcome_email",
      },
    },
    jobId: `email:welcome:${params.userId}`,
  });

export const enqueueEmailVerificationEmail = async (params: {
  userId: number;
  reason?: "signup" | "manual";
  context?: AppQueueContextInput;
}) =>
  enqueueQueueJob({
    jobName: "sendEmailVerificationEmail",
    payload: {
      reason: params.reason,
    },
    context: {
      userId: params.userId,
      ...params.context,
      metadata: {
        ...(params.context?.metadata ?? {}),
        task: "email_verification",
        reason: params.reason ?? "manual",
      },
    },
    jobId: `email:verify:${params.userId}`,
  });

export const enqueuePlanApprovedEmail = async (params: {
  paymentId: string;
  context?: AppQueueContextInput;
}) =>
  enqueueQueueJob({
    jobName: "sendPlanApprovedEmail",
    payload: {
      paymentId: params.paymentId,
    },
    context: {
      ...params.context,
      metadata: {
        ...(params.context?.metadata ?? {}),
        paymentId: params.paymentId,
        task: "plan_approved_email",
      },
    },
    jobId: `email:plan-approved:${params.paymentId}`,
  });

export const enqueueMonthlySalesReportEmail = async (params: {
  userId: number;
  monthKey: string;
  context?: AppQueueContextInput;
}) =>
  enqueueQueueJob({
    jobName: "sendMonthlySalesReportEmail",
    payload: {
      monthKey: params.monthKey,
    },
    context: {
      userId: params.userId,
      ...params.context,
      metadata: {
        ...(params.context?.metadata ?? {}),
        monthKey: params.monthKey,
        task: "monthly_sales_report_email",
      },
    },
    jobId: `email:monthly-report:${params.userId}:${params.monthKey}`,
  });

export const enqueuePaymentReceivedEmail = async (params: {
  paymentId: number;
  context?: AppQueueContextInput;
}) =>
  enqueueQueueJob({
    jobName: "sendPaymentReceivedEmail",
    payload: {
      paymentId: params.paymentId,
    },
    context: {
      ...params.context,
      metadata: {
        ...(params.context?.metadata ?? {}),
        paymentId: params.paymentId,
        task: "payment_received_email",
      },
    },
    jobId: `email:payment-received:${params.paymentId}`,
  });

export const enqueueWeeklyReportEmail = async (params: {
  userId: number;
  weekKey: string;
  context?: AppQueueContextInput;
}) =>
  enqueueQueueJob({
    jobName: "sendWeeklyReportEmail",
    payload: {
      weekKey: params.weekKey,
    },
    context: {
      userId: params.userId,
      ...params.context,
      metadata: {
        ...(params.context?.metadata ?? {}),
        weekKey: params.weekKey,
        task: "weekly_report_email",
      },
    },
    jobId: `email:weekly-report:${params.userId}:${params.weekKey}`,
  });

export const enqueueLowStockAlertEmail = async (params: {
  userId: number;
  context?: AppQueueContextInput;
}) =>
  enqueueQueueJob({
    jobName: "sendLowStockAlertEmail",
    payload: {},
    context: {
      userId: params.userId,
      ...params.context,
      metadata: {
        ...(params.context?.metadata ?? {}),
        task: "low_stock_alert_email",
      },
    },
    jobId: `email:low-stock:${params.userId}:${new Date().toISOString().slice(0, 10)}`,
  });
