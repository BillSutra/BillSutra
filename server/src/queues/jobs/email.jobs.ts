import { enqueueDefaultJob } from "../queue.js";

export const enqueueWelcomeEmail = async (params: { userId: number }) =>
  enqueueDefaultJob({
    jobName: "sendWelcomeEmail",
    data: params,
    jobId: `email:welcome:${params.userId}`,
  });

export const enqueueEmailVerificationEmail = async (params: {
  userId: number;
  rawToken: string;
}) =>
  enqueueDefaultJob({
    jobName: "sendEmailVerificationEmail",
    data: params,
    jobId: `email:verify:${params.userId}`,
  });

export const enqueuePlanApprovedEmail = async (params: { paymentId: string }) =>
  enqueueDefaultJob({
    jobName: "sendPlanApprovedEmail",
    data: params,
    jobId: `email:plan-approved:${params.paymentId}`,
  });

export const enqueueMonthlySalesReportEmail = async (params: {
  userId: number;
  monthKey: string;
}) =>
  enqueueDefaultJob({
    jobName: "sendMonthlySalesReportEmail",
    data: params,
    jobId: `email:monthly-report:${params.userId}:${params.monthKey}`,
  });

export const enqueuePaymentReceivedEmail = async (params: {
  paymentId: number;
}) =>
  enqueueDefaultJob({
    jobName: "sendPaymentReceivedEmail",
    data: params,
    jobId: `email:payment-received:${params.paymentId}`,
  });

export const enqueueWeeklyReportEmail = async (params: {
  userId: number;
  weekKey: string;
}) =>
  enqueueDefaultJob({
    jobName: "sendWeeklyReportEmail",
    data: params,
    jobId: `email:weekly-report:${params.userId}:${params.weekKey}`,
  });

export const enqueueLowStockAlertEmail = async (params: { userId: number }) =>
  enqueueDefaultJob({
    jobName: "sendLowStockAlertEmail",
    data: params,
    jobId: `email:low-stock:${params.userId}:${new Date().toISOString().slice(0, 10)}`,
  });
