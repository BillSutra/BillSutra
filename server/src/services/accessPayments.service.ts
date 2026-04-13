import crypto from "crypto";
import {
  AccessPaymentMethod,
  AccessPaymentStatus,
  type AccessPayment,
} from "@prisma/client";
import prisma from "../config/db.config.js";
import {
  type AccessBillingCycle,
  type AccessPlanId,
  listAccessPlans,
  resolveAccessPlanQuote,
} from "../config/accessPlans.js";
import AppError from "../utils/AppError.js";
import { paymentProofStorage } from "./storage/paymentProofStorage.js";
import { getBackendAppUrl, getFrontendAppUrl } from "../lib/appUrls.js";
import { sendEmail } from "../emails/index.js";
import {
  applySubscriptionGrant,
  getSubscriptionSnapshot,
  hasPaidAccess,
} from "./subscription.service.js";

const UTR_REGEX = /^[A-Z0-9]{8,22}$/i;
const RAZORPAY_API_BASE = "https://api.razorpay.com/v1";

type RazorpayOrderResponse = {
  id: string;
  entity: "order";
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt?: string;
  status: string;
};

type RazorpayPaymentEntity = {
  id: string;
  order_id?: string;
  amount: number;
  currency?: string;
  status?: string;
  email?: string;
  contact?: string;
  method?: string;
  notes?: Record<string, string>;
};

const getRazorpayCredentials = () => {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();

  if (!keyId || !keySecret) {
    throw new AppError(
      "Razorpay credentials are missing. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
      503,
    );
  }

  return { keyId, keySecret };
};

const getRazorpayWebhookSecret = () => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    throw new AppError(
      "Razorpay webhook secret is missing. Set RAZORPAY_WEBHOOK_SECRET.",
      503,
    );
  }

  return webhookSecret;
};

const normalizeStatus = (status: AccessPaymentStatus) => status.toLowerCase();
const normalizeMethod = (method: AccessPaymentMethod) => method.toLowerCase();

const toAbsoluteUploadUrl = (value?: string | null) => {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `${getBackendAppUrl()}${value.startsWith("/") ? value : `/${value}`}`;
};

const serializePayment = (payment: AccessPayment) => ({
  id: payment.id,
  userId: payment.user_id,
  planId: payment.plan_id,
  billingCycle: payment.billing_cycle,
  method: normalizeMethod(payment.method),
  amount: Number(payment.amount),
  status: normalizeStatus(payment.status),
  name: payment.name,
  utr: payment.utr,
  screenshotUrl: toAbsoluteUploadUrl(payment.screenshot_url),
  paymentId: payment.provider_payment_id,
  orderId: payment.provider_order_id,
  provider: payment.provider,
  providerReference: payment.provider_reference,
  reviewedByAdminId: payment.reviewed_by_admin_id,
  reviewedByAdminEmail: payment.reviewed_by_admin_email,
  reviewedAt: payment.reviewed_at?.toISOString() ?? null,
  createdAt: payment.created_at.toISOString(),
  updatedAt: payment.updated_at.toISOString(),
});

const safeCompareSignature = (expected: string, received: string) => {
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
};

const createRazorpaySignature = (
  orderId: string,
  paymentId: string,
  keySecret: string,
) =>
  crypto
    .createHmac("sha256", keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

const createWebhookSignature = (body: Buffer, webhookSecret: string) =>
  crypto.createHmac("sha256", webhookSecret).update(body).digest("hex");

const buildUpiConfig = () => {
  const upiId = process.env.UPI_ID?.trim() || "payments@billsutra";
  const payeeName = process.env.UPI_PAYEE_NAME?.trim() || "BillSutra";

  return { upiId, payeeName };
};

const buildUpiLink = ({
  upiId,
  payeeName,
  amount,
  planName,
  billingCycle,
}: {
  upiId: string;
  payeeName: string;
  amount: number;
  planName: string;
  billingCycle: string;
}) => {
  const url = new URL("upi://pay");
  url.searchParams.set("pa", upiId);
  url.searchParams.set("pn", payeeName);
  url.searchParams.set("am", amount.toFixed(2));
  url.searchParams.set("cu", "INR");
  url.searchParams.set("tn", `${planName} ${billingCycle} access payment`);
  return url.toString();
};

const requestRazorpay = async <T>(
  endpoint: string,
  init: RequestInit = {},
): Promise<T> => {
  const { keyId, keySecret } = getRazorpayCredentials();
  const headers = new Headers(init.headers);
  headers.set(
    "Authorization",
    `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
  );
  headers.set("Content-Type", "application/json");

  const response = await fetch(`${RAZORPAY_API_BASE}${endpoint}`, {
    ...init,
    headers,
  });

  const payload = (await response.json().catch(() => null)) as {
    error?: { description?: string };
  } | null;

  if (!response.ok) {
    throw new AppError(
      payload?.error?.description || "Unable to complete the Razorpay request.",
      502,
    );
  }

  return payload as T;
};

const findAccessGrant = async (userId: number) =>
  prisma.accessPayment.findFirst({
    where: {
      user_id: userId,
      status: {
        in: [AccessPaymentStatus.APPROVED, AccessPaymentStatus.SUCCESS],
      },
    },
    orderBy: [{ reviewed_at: "desc" }, { updated_at: "desc" }],
  });

const getPaymentHistory = async (userId: number) =>
  prisma.accessPayment.findMany({
    where: { user_id: userId },
    orderBy: { created_at: "desc" },
    take: 10,
  });

export const hasPaymentAccess = async (userId: number) => hasPaidAccess(userId);

export const getAccessPaymentStatus = async (userId: number) => {
  const [activePayment, payments, hasAccess, subscription] = await Promise.all([
    findAccessGrant(userId),
    getPaymentHistory(userId),
    hasPaidAccess(userId),
    getSubscriptionSnapshot(userId),
  ]);
  const { upiId, payeeName } = buildUpiConfig();
  const plans = listAccessPlans().map((plan) => ({
    ...plan,
    upiLink: {
      monthly: buildUpiLink({
        upiId,
        payeeName,
        amount: plan.amounts.monthly,
        planName: plan.name,
        billingCycle: "monthly",
      }),
      yearly: buildUpiLink({
        upiId,
        payeeName,
        amount: plan.amounts.yearly,
        planName: plan.name,
        billingCycle: "yearly",
      }),
    },
  }));

  return {
    hasAccess,
    activePayment: activePayment ? serializePayment(activePayment) : null,
    subscription,
    payments: payments.map(serializePayment),
    upi: {
      upiId,
      payeeName,
    },
    razorpay: {
      keyId: process.env.RAZORPAY_KEY_ID?.trim() ?? null,
      enabled: Boolean(
        process.env.RAZORPAY_KEY_ID?.trim() &&
        process.env.RAZORPAY_KEY_SECRET?.trim(),
      ),
    },
    plans,
  };
};

export const createAccessRazorpayOrder = async ({
  userId,
  planId,
  billingCycle,
}: {
  userId: number;
  planId: AccessPlanId;
  billingCycle: AccessBillingCycle;
}) => {
  const quote = resolveAccessPlanQuote(planId, billingCycle);
  const receipt = `acc_${userId}_${Date.now()}`.slice(0, 40);

  const order = await requestRazorpay<RazorpayOrderResponse>("/orders", {
    method: "POST",
    body: JSON.stringify({
      amount: quote.amountPaise,
      currency: quote.currency,
      receipt,
      notes: {
        flow: "access_payment",
        userId: String(userId),
        planId,
        billingCycle,
      },
    }),
  });

  const payment = await prisma.accessPayment.create({
    data: {
      user_id: userId,
      plan_id: planId,
      billing_cycle: billingCycle,
      method: AccessPaymentMethod.RAZORPAY,
      amount: quote.amount,
      status: AccessPaymentStatus.PENDING,
      provider: "razorpay",
      provider_order_id: order.id,
      provider_reference: order.receipt,
      metadata: {
        flow: "access_payment",
        razorpayOrderStatus: order.status,
      },
    },
  });

  return {
    paymentRecordId: payment.id,
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    plan: {
      planId,
      billingCycle,
      amount: quote.amount,
      currency: quote.currency,
      name: quote.name,
    },
  };
};

export const verifyAccessRazorpayPayment = async ({
  userId,
  orderId,
  paymentId,
  signature,
}: {
  userId: number;
  orderId: string;
  paymentId: string;
  signature: string;
}) => {
  const { keySecret } = getRazorpayCredentials();
  const expectedSignature = createRazorpaySignature(
    orderId,
    paymentId,
    keySecret,
  );

  if (!safeCompareSignature(expectedSignature, signature)) {
    throw new AppError("Invalid Razorpay payment signature.", 400);
  }

  const payment = await prisma.accessPayment.findFirst({
    where: {
      user_id: userId,
      provider_order_id: orderId,
      method: AccessPaymentMethod.RAZORPAY,
    },
  });

  if (!payment) {
    throw new AppError("Payment order not found.", 404);
  }

  const updated = await prisma.accessPayment.update({
    where: { id: payment.id },
    data: {
      status: AccessPaymentStatus.SUCCESS,
      provider_payment_id: paymentId,
      provider_signature: signature,
      metadata: {
        ...(typeof payment.metadata === "object" && payment.metadata
          ? (payment.metadata as Record<string, unknown>)
          : {}),
        verifiedAt: new Date().toISOString(),
        verifiedVia: "frontend_callback",
      },
    },
  });

  await applySubscriptionGrant({
    userId,
    planId: updated.plan_id === "pro-plus" ? "pro-plus" : "pro",
    billingCycle: updated.billing_cycle === "yearly" ? "yearly" : "monthly",
    paymentId: updated.id,
    metadata: {
      source: "razorpay_verify",
      accessPaymentId: updated.id,
      providerPaymentId: updated.provider_payment_id,
    },
  });

  return serializePayment(updated);
};

export const submitAccessUpiPayment = async ({
  userId,
  planId,
  billingCycle,
  name,
  utr,
  screenshot,
}: {
  userId: number;
  planId: AccessPlanId;
  billingCycle: AccessBillingCycle;
  name: string;
  utr: string;
  screenshot?: Express.Multer.File;
}) => {
  const normalizedUtr = utr.trim().toUpperCase();

  if (!UTR_REGEX.test(normalizedUtr)) {
    throw new AppError(
      "Enter a valid UTR number with 8 to 22 letters or digits.",
      422,
    );
  }

  const existingPayment = await prisma.accessPayment.findFirst({
    where: { utr: normalizedUtr },
    select: { id: true },
  });

  if (existingPayment) {
    throw new AppError("This UTR number has already been submitted.", 409);
  }

  const quote = resolveAccessPlanQuote(planId, billingCycle);
  const proof = screenshot
    ? await paymentProofStorage.save(userId, screenshot)
    : null;

  const payment = await prisma.accessPayment.create({
    data: {
      user_id: userId,
      plan_id: planId,
      billing_cycle: billingCycle,
      method: AccessPaymentMethod.UPI,
      amount: quote.amount,
      status: AccessPaymentStatus.PENDING,
      name: name.trim(),
      utr: normalizedUtr,
      screenshot_url: proof?.url,
      screenshot_path: proof?.filePath,
      provider: "manual_upi",
      provider_reference: normalizedUtr,
    },
  });

  return serializePayment(payment);
};

export const listAdminUpiPayments = async () => {
  const payments = await prisma.accessPayment.findMany({
    where: { method: AccessPaymentMethod.UPI },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: [{ created_at: "desc" }],
  });

  return payments.map((payment) => ({
    ...serializePayment(payment),
    user: payment.user,
  }));
};

export const reviewAdminUpiPayment = async ({
  admin,
  paymentId,
  status,
}: {
  admin: AdminAuthUser;
  paymentId: string;
  status: "approved" | "rejected";
}) => {
  const payment = await prisma.accessPayment.findFirst({
    where: {
      id: paymentId,
      method: AccessPaymentMethod.UPI,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!payment) {
    throw new AppError("UPI payment request not found.", 404);
  }

  const nextStatus =
    status === "approved"
      ? AccessPaymentStatus.APPROVED
      : AccessPaymentStatus.REJECTED;

  const updated = await prisma.accessPayment.update({
    where: { id: payment.id },
    data: {
      status: nextStatus,
      reviewed_at: new Date(),
      reviewed_by_admin_id: admin.adminId,
      reviewed_by_admin_email: admin.email,
    },
  });

  if (nextStatus === AccessPaymentStatus.APPROVED) {
    await applySubscriptionGrant({
      userId: payment.user.id,
      planId: updated.plan_id === "pro-plus" ? "pro-plus" : "pro",
      billingCycle: updated.billing_cycle === "yearly" ? "yearly" : "monthly",
      paymentId: updated.id,
      metadata: {
        source: "admin_upi_review",
        reviewer: admin.email,
      },
    });
  }

  if (nextStatus === AccessPaymentStatus.APPROVED && payment.user.email) {
    try {
      await sendEmail("payment_access_approved", {
        email: payment.user.email,
        user_name: payment.user.name,
        plan_name: payment.plan_id === "pro-plus" ? "Pro Plus" : "Pro",
        amount: Number(payment.amount),
        status_page_url: `${getFrontendAppUrl()}/payments`,
      });
    } catch (error) {
      console.warn("[payments] approval email failed", {
        paymentId: payment.id,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  return serializePayment(updated);
};

export const handleRazorpayWebhook = async (
  body: Buffer,
  signatureHeader?: string,
) => {
  if (!signatureHeader?.trim()) {
    throw new AppError("Missing Razorpay webhook signature.", 400);
  }

  const webhookSecret = getRazorpayWebhookSecret();
  const expectedSignature = createWebhookSignature(body, webhookSecret);

  if (!safeCompareSignature(expectedSignature, signatureHeader.trim())) {
    throw new AppError("Invalid Razorpay webhook signature.", 400);
  }

  const payload = JSON.parse(body.toString("utf8")) as {
    event?: string;
    payload?: {
      payment?: { entity?: RazorpayPaymentEntity };
    };
  };

  const event = payload.event?.trim();
  const entity = payload.payload?.payment?.entity;

  if (!event || !entity?.id) {
    return { handled: false, reason: "Invalid webhook payload" };
  }

  if (!["payment.captured", "order.paid"].includes(event)) {
    return { handled: true, ignored: true, event };
  }

  const orderId = entity.order_id?.trim() || null;
  const userId = Number(entity.notes?.userId ?? 0);
  const planId = entity.notes?.planId === "pro-plus" ? "pro-plus" : "pro";
  const billingCycle =
    entity.notes?.billingCycle === "yearly" ? "yearly" : "monthly";

  const existing = await prisma.accessPayment.findFirst({
    where: {
      OR: [
        { provider_payment_id: entity.id },
        ...(orderId ? [{ provider_order_id: orderId }] : []),
      ],
    },
  });

  if (existing) {
    const updated = await prisma.accessPayment.update({
      where: { id: existing.id },
      data: {
        status: AccessPaymentStatus.SUCCESS,
        provider: "razorpay",
        provider_payment_id: entity.id,
        provider_order_id: orderId ?? existing.provider_order_id,
        metadata: {
          webhookEvent: event,
          method: entity.method ?? null,
          currency: entity.currency ?? "INR",
          rawStatus: entity.status ?? null,
        },
      },
    });

    await applySubscriptionGrant({
      userId: updated.user_id,
      planId: updated.plan_id === "pro-plus" ? "pro-plus" : "pro",
      billingCycle: updated.billing_cycle === "yearly" ? "yearly" : "monthly",
      paymentId: updated.id,
      metadata: {
        source: "razorpay_webhook_existing",
        webhookEvent: event,
      },
    });

    return { handled: true, paymentId: existing.id, event };
  }

  if (!userId || !orderId) {
    return { handled: true, ignored: true, event };
  }

  const quote = resolveAccessPlanQuote(
    planId as AccessPlanId,
    billingCycle as AccessBillingCycle,
  );

  const created = await prisma.accessPayment.create({
    data: {
      user_id: userId,
      plan_id: planId,
      billing_cycle: billingCycle,
      method: AccessPaymentMethod.RAZORPAY,
      amount: Number((entity.amount / 100).toFixed(2)) || quote.amount,
      status: AccessPaymentStatus.SUCCESS,
      provider: "razorpay",
      provider_payment_id: entity.id,
      provider_order_id: orderId,
      metadata: {
        webhookEvent: event,
        method: entity.method ?? null,
        currency: entity.currency ?? "INR",
        rawStatus: entity.status ?? null,
      },
    },
  });

  await applySubscriptionGrant({
    userId,
    planId,
    billingCycle,
    paymentId: created.id,
    metadata: {
      source: "razorpay_webhook_create",
      webhookEvent: event,
    },
  });

  return { handled: true, paymentId: created.id, event };
};
