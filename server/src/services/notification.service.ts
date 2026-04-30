import {
  NotificationType,
  Prisma,
  SubscriptionStatus,
  type Notification,
} from "@prisma/client";
import prisma from "../config/db.config.js";
import { getInventoryInsights } from "./inventoryInsights.service.js";
import { enqueueNotificationCreation } from "../queues/jobs/notification.jobs.js";
import {
  emitRealtimeNotificationCreated,
  emitRealtimeNotificationDeleted,
  emitRealtimeNotificationsReadAll,
  emitRealtimeNotificationUpdated,
} from "./realtimeSocket.service.js";
import { invalidateRedisResourceCacheByPrefix } from "../lib/redisResourceCache.js";
import { buildNotificationsCachePrefix } from "../redis/cacheKeys.js";
import {
  findBusinessByOwnerIdIfAvailable,
} from "../lib/authSession.js";
import { getUserPermissions } from "./subscription.service.js";

const PAYMENT_DUE_LOOKAHEAD_DAYS = 2;
const SUBSCRIPTION_WARNING_DAYS = 5;
const NOTIFICATION_TABLE_CHECK_TTL_MS = 60_000;
const NOTIFICATION_SYNC_TTL_MS = Number(
  process.env.NOTIFICATION_SYNC_TTL_MS ?? 45_000,
);
const LARGE_OUTSTANDING_AMOUNT = Number(
  process.env.NOTIFICATION_LARGE_OUTSTANDING_AMOUNT ?? 10_000,
);
const LARGE_SUPPLIER_DUE_AMOUNT = Number(
  process.env.NOTIFICATION_LARGE_SUPPLIER_DUE_AMOUNT ?? 15_000,
);
const DAILY_CLOSING_REMINDER_HOUR = Math.min(
  23,
  Math.max(0, Number(process.env.DAILY_CLOSING_REMINDER_HOUR ?? 19)),
);
const NO_SALES_WARNING_HOUR = Math.min(
  23,
  Math.max(0, Number(process.env.NO_SALES_WARNING_HOUR ?? 15)),
);

const notificationTypeMap = {
  payment: NotificationType.PAYMENT,
  inventory: NotificationType.INVENTORY,
  customer: NotificationType.CUSTOMER,
  subscription: NotificationType.SUBSCRIPTION,
  worker: NotificationType.WORKER,
  security: NotificationType.SECURITY,
  system: NotificationType.SYSTEM,
} as const;

export type AppNotificationType = keyof typeof notificationTypeMap;
export type AppNotificationPriority =
  | "critical"
  | "warning"
  | "info"
  | "success";

const notificationApiTypeMap: Record<NotificationType, AppNotificationType> = {
  PAYMENT: "payment",
  INVENTORY: "inventory",
  CUSTOMER: "customer",
  SUBSCRIPTION: "subscription",
  WORKER: "worker",
  SECURITY: "security",
  SYSTEM: "system",
};

const notificationPriorityValues = new Set<AppNotificationPriority>([
  "critical",
  "warning",
  "info",
  "success",
]);

const notificationTypeDefaults: Record<
  AppNotificationType,
  { title: string; actionUrl: string }
> = {
  payment: { title: "Payment alert", actionUrl: "/invoices/history" },
  inventory: { title: "Inventory alert", actionUrl: "/inventory" },
  customer: { title: "Customer alert", actionUrl: "/customers" },
  subscription: { title: "Subscription alert", actionUrl: "/pricing" },
  worker: { title: "Worker alert", actionUrl: "/workers" },
  security: { title: "Security alert", actionUrl: "/settings?tab=security" },
  system: { title: "System alert", actionUrl: "/dashboard" },
};

const toIsoDateKey = (value: Date) => value.toISOString().slice(0, 10);
const toStartOfDay = (value: Date) => {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
};
const addDays = (value: Date, days: number) => {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
};
const dayDifference = (left: Date, right: Date) =>
  Math.round(
    (toStartOfDay(left).getTime() - toStartOfDay(right).getTime()) /
      (24 * 60 * 60 * 1000),
  );
const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
const formatDateLabel = (value: Date) =>
  value.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
const toNotificationNumber = (value: Prisma.Decimal | number | null | undefined) =>
  Number(value ?? 0);
const normalizeNotificationTitle = (
  title: string | null | undefined,
  type: AppNotificationType,
) => {
  const trimmed = title?.trim();
  return trimmed ? trimmed.slice(0, 191) : notificationTypeDefaults[type].title;
};
const normalizeNotificationActionUrl = (
  actionUrl: string | null | undefined,
  type: AppNotificationType,
) => {
  const trimmed = actionUrl?.trim();
  if (trimmed && trimmed.startsWith("/")) {
    return trimmed.slice(0, 255);
  }
  return notificationTypeDefaults[type].actionUrl;
};
const normalizeNotificationPriority = (
  priority: AppNotificationPriority | string | null | undefined,
): AppNotificationPriority =>
  notificationPriorityValues.has(priority as AppNotificationPriority)
    ? (priority as AppNotificationPriority)
    : "info";

const notificationContentChanged = (
  notification: Pick<
    Notification,
    "type" | "title" | "message" | "action_url" | "priority"
  >,
  next: {
    type: NotificationType;
    title: string;
    message: string;
    actionUrl: string;
    priority: AppNotificationPriority;
  },
) =>
  notification.type !== next.type ||
  (notification.title ?? "") !== next.title ||
  notification.message !== next.message ||
  (notification.action_url ?? "") !== next.actionUrl ||
  normalizeNotificationPriority(notification.priority) !== next.priority;

let notificationTableAvailability:
  | { exists: boolean; checkedAt: number }
  | null = null;
const notificationSyncState = new Map<
  number,
  { syncedAt: number; inFlight: Promise<void> | null }
>();

export const invalidateNotificationCaches = (
  businessId: string | undefined,
  userId: number,
) =>
  invalidateRedisResourceCacheByPrefix(
    buildNotificationsCachePrefix({ businessId, userId }),
  );

const isNotificationTableMissingError = (error: unknown) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2021" || error.code === "P2022";
  }

  if (error instanceof Error) {
    return /notifications/i.test(error.message);
  }

  return false;
};

const hasNotificationTable = async () => {
  const now = Date.now();
  if (
    notificationTableAvailability &&
    now - notificationTableAvailability.checkedAt <
      NOTIFICATION_TABLE_CHECK_TTL_MS
  ) {
    return notificationTableAvailability.exists;
  }

  const result = await prisma.$queryRaw<Array<{ table_name: string | null }>>`
    SELECT to_regclass('public.notifications')::text AS table_name
  `;
  const exists = Boolean(result[0]?.table_name);

  notificationTableAvailability = {
    exists,
    checkedAt: now,
  };

  return exists;
};

export const serializeNotification = (notification: Pick<
  Notification,
  | "id"
  | "business_id"
  | "type"
  | "title"
  | "message"
  | "action_url"
  | "priority"
  | "is_read"
  | "created_at"
>) => ({
  id: notification.id,
  businessId: notification.business_id,
  type: notificationApiTypeMap[notification.type],
  title: normalizeNotificationTitle(
    notification.title,
    notificationApiTypeMap[notification.type],
  ),
  message: notification.message,
  actionUrl: normalizeNotificationActionUrl(
    notification.action_url,
    notificationApiTypeMap[notification.type],
  ),
  priority: normalizeNotificationPriority(notification.priority),
  isRead: notification.is_read,
  createdAt: notification.created_at.toISOString(),
});

type CreateNotificationInput = {
  userId: number;
  businessId: string;
  type: AppNotificationType;
  title?: string | null;
  message: string;
  actionUrl?: string | null;
  priority?: AppNotificationPriority;
  referenceKey?: string | null;
};

type ListNotificationsParams = {
  userId: number;
  page?: number;
  limit?: number;
  type?: AppNotificationType | null;
  isRead?: boolean | null;
};

const serializeAndEmitCreated = (
  notification: Pick<
    Notification,
    | "id"
    | "business_id"
    | "type"
    | "title"
    | "message"
    | "action_url"
    | "priority"
    | "is_read"
    | "created_at"
  >,
  userId: number,
) => {
  emitRealtimeNotificationCreated({
    userId,
    notification: serializeNotification(notification),
  });
};

const serializeAndEmitUpdated = (
  notification: Pick<
    Notification,
    | "id"
    | "business_id"
    | "type"
    | "title"
    | "message"
    | "action_url"
    | "priority"
    | "is_read"
    | "created_at"
  >,
  userId: number,
) => {
  emitRealtimeNotificationUpdated({
    userId,
    notification: serializeNotification(notification),
  });
};

export const createNotification = async ({
  userId,
  businessId,
  type,
  title,
  message,
  actionUrl,
  priority,
  referenceKey,
}: CreateNotificationInput) => {
  if (!(await hasNotificationTable())) {
    return null;
  }

  const normalizedTitle = normalizeNotificationTitle(title, type);
  const normalizedActionUrl = normalizeNotificationActionUrl(actionUrl, type);
  const normalizedPriority = normalizeNotificationPriority(priority);
  const normalizedType = notificationTypeMap[type];
  const data: Prisma.NotificationUncheckedCreateInput = {
    user_id: userId,
    business_id: businessId,
    type: normalizedType,
    title: normalizedTitle,
    message,
    action_url: normalizedActionUrl,
    priority: normalizedPriority,
    reference_key: referenceKey ?? null,
  };

  if (referenceKey) {
    try {
      const existing = await prisma.notification.findUnique({
        where: {
          business_id_reference_key: {
            business_id: businessId,
            reference_key: referenceKey,
          },
        },
      });

      if (existing) {
        if (
          !notificationContentChanged(existing, {
            type: normalizedType,
            title: normalizedTitle,
            message,
            actionUrl: normalizedActionUrl,
            priority: normalizedPriority,
          })
        ) {
          return existing;
        }

        const notification = await prisma.notification.update({
          where: { id: existing.id },
          data: {
            title: normalizedTitle,
            message,
            action_url: normalizedActionUrl,
            priority: normalizedPriority,
            type: normalizedType,
          },
        });
        void invalidateNotificationCaches(businessId, userId);
        serializeAndEmitUpdated(notification, userId);
        return notification;
      }

      const notification = await prisma.notification.create({ data });
      void invalidateNotificationCaches(businessId, userId);
      serializeAndEmitCreated(notification, userId);
      return notification;
    } catch (error) {
      if (isNotificationTableMissingError(error)) {
        notificationTableAvailability = {
          exists: false,
          checkedAt: Date.now(),
        };
        return null;
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const existing = await prisma.notification.findUnique({
          where: {
            business_id_reference_key: {
              business_id: businessId,
              reference_key: referenceKey,
            },
          },
        });

        if (existing) {
          if (
            !notificationContentChanged(existing, {
              type: normalizedType,
              title: normalizedTitle,
              message,
              actionUrl: normalizedActionUrl,
              priority: normalizedPriority,
            })
          ) {
            return existing;
          }

          const notification = await prisma.notification.update({
            where: { id: existing.id },
            data: {
              title: normalizedTitle,
              message,
              action_url: normalizedActionUrl,
              priority: normalizedPriority,
              type: normalizedType,
            },
          });
          void invalidateNotificationCaches(businessId, userId);
          serializeAndEmitUpdated(notification, userId);
          return notification;
        }
      }

      throw error;
    }
  }

  try {
    const notification = await prisma.notification.create({ data });
    void invalidateNotificationCaches(businessId, userId);
    serializeAndEmitCreated(notification, userId);
    return notification;
  } catch (error) {
    if (isNotificationTableMissingError(error)) {
      notificationTableAvailability = {
        exists: false,
        checkedAt: Date.now(),
      };
      return null;
    }
    throw error;
  }
};

export const dispatchNotification = async (input: CreateNotificationInput) => {
  const queued = await enqueueNotificationCreation({
    ...input,
    context: {
      businessId: input.businessId,
      userId: input.userId,
      metadata: {
        type: input.type,
        referenceKey: input.referenceKey ?? null,
      },
    },
  });
  if (queued.queued) {
    return null;
  }

  return createNotification(input);
};

export const listNotifications = async ({
  userId,
  page = 1,
  limit = 10,
  type = null,
  isRead = null,
}: ListNotificationsParams) => {
  const safePage = Math.max(1, Math.trunc(page));
  const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 50));
  const skip = (safePage - 1) * safeLimit;
  const where: Prisma.NotificationWhereInput = {
    user_id: userId,
    ...(type ? { type: notificationTypeMap[type] } : {}),
    ...(typeof isRead === "boolean" ? { is_read: isRead } : {}),
  };
  if (!(await hasNotificationTable())) {
    return { notifications: [], total: 0, page: safePage, limit: safeLimit };
  }

  try {
    const [notifications, total] = await prisma.$transaction([
      prisma.notification.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip,
        take: safeLimit,
      }),
      prisma.notification.count({ where }),
    ]);

    return { notifications, total, page: safePage, limit: safeLimit };
  } catch (error) {
    if (isNotificationTableMissingError(error)) {
      notificationTableAvailability = {
        exists: false,
        checkedAt: Date.now(),
      };
      return { notifications: [], total: 0, page: safePage, limit: safeLimit };
    }
    throw error;
  }
};

export const countUnreadNotifications = async (userId: number) =>
  {
    if (!(await hasNotificationTable())) {
      return 0;
    }

    try {
      return await prisma.notification.count({
        where: { user_id: userId, is_read: false },
      });
    } catch (error) {
      if (isNotificationTableMissingError(error)) {
        notificationTableAvailability = {
          exists: false,
          checkedAt: Date.now(),
        };
        return 0;
      }
      throw error;
    }
  };

export const updateNotificationReadState = async (
  userId: number,
  id: string,
  isRead: boolean,
) =>
  {
    if (!(await hasNotificationTable())) {
      return null;
    }

    try {
      const notification = await prisma.notification.findFirst({
        where: { id, user_id: userId },
      });

      if (!notification) {
        return null;
      }

      const updated = await prisma.notification.update({
        where: { id: notification.id },
        data: { is_read: isRead },
      });
      void invalidateNotificationCaches(notification.business_id, userId);
      serializeAndEmitUpdated(updated, userId);
      return updated;
    } catch (error) {
      if (isNotificationTableMissingError(error)) {
        notificationTableAvailability = {
          exists: false,
          checkedAt: Date.now(),
        };
        return null;
      }
      throw error;
    }
  };

export const markAllNotificationsAsRead = async (userId: number) =>
  {
    if (!(await hasNotificationTable())) {
      return { count: 0 };
    }

    try {
      const result = await prisma.notification.updateMany({
        where: { user_id: userId, is_read: false },
        data: { is_read: true },
      });
      if (result.count > 0) {
        const businessIds = await prisma.notification.findMany({
          where: { user_id: userId },
          select: { business_id: true },
          distinct: ["business_id"],
        });
        for (const business of businessIds) {
          void invalidateNotificationCaches(business.business_id, userId);
        }
        emitRealtimeNotificationsReadAll({ userId });
      }
      return result;
    } catch (error) {
      if (isNotificationTableMissingError(error)) {
        notificationTableAvailability = {
          exists: false,
          checkedAt: Date.now(),
        };
        return { count: 0 };
      }
      throw error;
    }
  };

export const deleteNotification = async (userId: number, id: string) => {
  if (!(await hasNotificationTable())) {
    return { count: 0 };
  }

  try {
    const notification = await prisma.notification.findFirst({
      where: { id, user_id: userId },
      select: { business_id: true },
    });

    if (!notification) {
      return { count: 0 };
    }

    const deleted = await prisma.notification.deleteMany({
      where: { id, user_id: userId },
    });

    if (deleted.count > 0) {
      void invalidateNotificationCaches(notification.business_id, userId);
      emitRealtimeNotificationDeleted({
        userId,
        notificationId: id,
      });
    }

    return deleted;
  } catch (error) {
    if (isNotificationTableMissingError(error)) {
      notificationTableAvailability = {
        exists: false,
        checkedAt: Date.now(),
      };
      return { count: 0 };
    }
    throw error;
  }
};

const buildInvoiceActionUrl = (invoiceId: number) =>
  `/invoices/history/${invoiceId}`;

const buildPurchaseActionUrl = () => "/purchases";

const buildInventoryActionUrl = (warehouseId?: number | null) =>
  warehouseId ? `/inventory?warehouse=${warehouseId}` : "/inventory";

const buildNotificationStageMessage = (daysUntilDue: number) => {
  if (daysUntilDue < 0) {
    const overdueDays = Math.abs(daysUntilDue);
    return {
      title: "Overdue payment",
      priority: "critical" as const,
      timingLabel: `${overdueDays} day${overdueDays === 1 ? "" : "s"} overdue`,
    };
  }

  if (daysUntilDue === 0) {
    return {
      title: "Payment due today",
      priority: "warning" as const,
      timingLabel: "due today",
    };
  }

  if (daysUntilDue === 1) {
    return {
      title: "Payment due tomorrow",
      priority: "warning" as const,
      timingLabel: "due tomorrow",
    };
  }

  return {
    title: "Upcoming payment due",
    priority: "info" as const,
    timingLabel: `due in ${daysUntilDue} days`,
  };
};

const buildInventoryInsightNotification = (insight: Awaited<
  ReturnType<typeof getInventoryInsights>
>["insights"][number]) => {
  switch (insight.type) {
    case "out_of_stock":
      return {
        title: "Out of stock",
        priority: "critical" as const,
      };
    case "low_stock":
      return {
        title: "Low stock",
        priority:
          insight.severity === "critical" ? ("critical" as const) : ("warning" as const),
      };
    case "prediction":
      return {
        title: "Restock soon",
        priority:
          insight.severity === "critical" ? ("critical" as const) : ("warning" as const),
      };
    case "reorder_reminder":
      return {
        title: "Restock recommended",
        priority: "info" as const,
      };
    case "supplier_suggestion":
      return {
        title: "Supplier suggestion",
        priority: "info" as const,
      };
    case "slow_moving":
      return {
        title: "Slow moving stock",
        priority: "warning" as const,
      };
    default:
      return {
        title: "Inventory alert",
        priority: "info" as const,
      };
  }
};

export const syncNotifications = async (params: {
  userId: number;
  businessId: string;
}) => {
  const { userId, businessId } = params;
  if (!(await hasNotificationTable())) {
    return;
  }

  const now = new Date();
  const today = toStartOfDay(now);
  const tomorrow = addDays(today, 1);
  const dueThreshold = addDays(today, PAYMENT_DUE_LOOKAHEAD_DAYS + 1);
  const subscriptionThreshold = addDays(today, SUBSCRIPTION_WARNING_DAYS + 1);
  const [prefs, invoiceCandidates, subscription, pendingPurchases, workerCounts, salesToday] =
    await Promise.all([
      prisma.userPreference.findUnique({
        where: { user_id: userId },
        select: {
          notification_due_invoice_alerts: true,
          notification_low_stock_alerts: true,
          notification_payment_reminders: true,
        },
      }),
      prisma.invoice.findMany({
        where: {
          user_id: userId,
          due_date: { not: null, lte: dueThreshold },
          status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] },
        },
        select: {
          id: true,
          invoice_number: true,
          due_date: true,
          total: true,
          customer: { select: { name: true } },
        },
        orderBy: { due_date: "asc" },
        take: 12,
      }),
      prisma.subscription.findUnique({
        where: { user_id: userId },
        select: {
          plan_id: true,
          status: true,
          current_period_end: true,
          expires_at: true,
          trial_ends_at: true,
        },
      }),
      prisma.purchase.findMany({
        where: {
          user_id: userId,
          pendingAmount: { gt: 0 },
        },
        select: {
          id: true,
          purchase_date: true,
          pendingAmount: true,
          totalAmount: true,
          supplier: { select: { name: true } },
        },
        orderBy: { pendingAmount: "desc" },
        take: 5,
      }),
      prisma.worker.count({
        where: { businessId },
      }).then((total) => ({
        total,
      })),
      prisma.sale.count({
        where: {
          user_id: userId,
          status: "COMPLETED",
          sale_date: { gte: today, lt: tomorrow },
        },
      }),
    ]);
  const paymentGroups =
    invoiceCandidates.length > 0
      ? await prisma.payment.groupBy({
          by: ["invoice_id"],
          where: {
            user_id: userId,
            invoice_id: { in: invoiceCandidates.map((invoice) => invoice.id) },
          },
          _sum: {
            amount: true,
          },
        })
      : [];
  const inventoryInsights = await getInventoryInsights(userId);
  const permissions = await getUserPermissions(businessId);
  const paymentTotalsByInvoiceId = new Map(
    paymentGroups.map((payment) => [
      payment.invoice_id,
      toNotificationNumber(payment._sum.amount),
    ]),
  );
  const todayKey = toIsoDateKey(today);
  const dueInvoiceAlertsEnabled = prefs?.notification_due_invoice_alerts !== false;
  const paymentRemindersEnabled =
    prefs?.notification_payment_reminders !== false;
  const lowStockAlertsEnabled = prefs?.notification_low_stock_alerts !== false;

  if (dueInvoiceAlertsEnabled || paymentRemindersEnabled) {
    await Promise.all(
      invoiceCandidates
        .filter((invoice) => invoice.due_date)
        .flatMap((invoice) => {
          const dueDate = invoice.due_date as Date;
          const daysUntilDue = dayDifference(dueDate, today);
          const paidAmount = paymentTotalsByInvoiceId.get(invoice.id) ?? 0;
          const totalAmount = toNotificationNumber(invoice.total);
          const outstandingAmount = Math.max(0, totalAmount - paidAmount);

          if (outstandingAmount <= 0) {
            return [];
          }

          const stage = buildNotificationStageMessage(daysUntilDue);
          const notifications: Array<Promise<unknown>> = [];

          if (dueInvoiceAlertsEnabled) {
            notifications.push(
              dispatchNotification({
                userId,
                businessId,
                type: "payment",
                title: stage.title,
                message: `Invoice ${invoice.invoice_number} from ${invoice.customer.name} is ${stage.timingLabel}. ${formatCurrency(outstandingAmount)} is pending.`,
                actionUrl: buildInvoiceActionUrl(invoice.id),
                priority: stage.priority,
                referenceKey: `invoice-payment-status:${invoice.id}:${todayKey}`,
              }),
            );
          }

          if (
            paymentRemindersEnabled &&
            paidAmount > 0 &&
            outstandingAmount > 0 &&
            daysUntilDue <= 0
          ) {
            notifications.push(
              dispatchNotification({
                userId,
                businessId,
                type: "payment",
                title: "Partial payment pending",
                message: `${formatCurrency(outstandingAmount)} is still pending on partially paid invoice ${invoice.invoice_number}.`,
                actionUrl: buildInvoiceActionUrl(invoice.id),
                priority: "warning",
                referenceKey: `invoice-partial-pending:${invoice.id}:${todayKey}`,
              }),
            );
          }

          if (
            paymentRemindersEnabled &&
            outstandingAmount >= LARGE_OUTSTANDING_AMOUNT &&
            daysUntilDue <= 0
          ) {
            notifications.push(
              dispatchNotification({
                userId,
                businessId,
                type: "payment",
                title: "Large outstanding amount",
                message: `${invoice.customer.name} still owes ${formatCurrency(outstandingAmount)} on invoice ${invoice.invoice_number}.`,
                actionUrl: buildInvoiceActionUrl(invoice.id),
                priority: "critical",
                referenceKey: `invoice-large-outstanding:${invoice.id}:${todayKey}`,
              }),
            );
          }

          return notifications;
        }),
    );
  }

  if (lowStockAlertsEnabled) {
    await Promise.all(
      inventoryInsights.insights
        .filter((insight) =>
          [
            "low_stock",
            "out_of_stock",
            "prediction",
            "reorder_reminder",
            "supplier_suggestion",
          ].includes(insight.type),
        )
        .slice(0, 15)
        .map((insight) => {
          const notificationMeta = buildInventoryInsightNotification(insight);
          return (
          dispatchNotification({
            userId,
            businessId,
            type: "inventory",
            title: notificationMeta.title,
            message: insight.message,
            actionUrl: buildInventoryActionUrl(insight.warehouseId),
            priority: notificationMeta.priority,
            referenceKey: `${insight.referenceKey}:${todayKey}`,
          })
        );
        }),
    );
  }

  if (paymentRemindersEnabled) {
    await Promise.all(
      pendingPurchases
        .filter((purchase) => toNotificationNumber(purchase.pendingAmount) > 0)
        .map((purchase) => {
          const pendingAmount = toNotificationNumber(purchase.pendingAmount);
          const supplierName = purchase.supplier?.name?.trim() || "a supplier";
          const isLargeDue = pendingAmount >= LARGE_SUPPLIER_DUE_AMOUNT;

          return dispatchNotification({
            userId,
            businessId,
            type: "system",
            title: isLargeDue ? "Large supplier due" : "Supplier payment pending",
            message: `${formatCurrency(pendingAmount)} is pending to ${supplierName} from purchase on ${formatDateLabel(purchase.purchase_date)}.`,
            actionUrl: buildPurchaseActionUrl(),
            priority: isLargeDue ? "warning" : "info",
            referenceKey: `supplier-due:${purchase.id}:${todayKey}`,
          });
        }),
    );
  }

  const subscriptionEnd =
    subscription?.expires_at ??
    subscription?.current_period_end ??
    subscription?.trial_ends_at;

  if (
    subscription &&
    subscriptionEnd &&
    subscription.status !== SubscriptionStatus.CANCELLED &&
    subscription.status !== SubscriptionStatus.EXPIRED &&
    subscriptionEnd <= subscriptionThreshold
  ) {
    const daysLeft = Math.max(0, dayDifference(subscriptionEnd, today));
    const isTrial = Boolean(subscription.trial_ends_at);
    await dispatchNotification({
      userId,
      businessId,
      type: "subscription",
      title: isTrial ? "Trial ending soon" : "Renewal upcoming",
      message: isTrial
        ? `Your BillSutra trial ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"} on ${formatDateLabel(subscriptionEnd)}. Upgrade to keep premium features active.`
        : `Your BillSutra plan renews on ${formatDateLabel(subscriptionEnd)}. Review billing to avoid interruptions.`,
      actionUrl: "/pricing",
      priority: daysLeft <= 1 ? "critical" : "warning",
      referenceKey: `subscription-warning:${toIsoDateKey(subscriptionEnd)}`,
    });
  }

  if (!permissions.features.teamAccess && workerCounts.total > 0) {
    await dispatchNotification({
      userId,
      businessId,
      type: "subscription",
      title: "Worker access needs an upgrade",
      message: `Your current plan does not include worker management. Upgrade to keep team access fully available.`,
      actionUrl: "/pricing",
      priority: "warning",
      referenceKey: `worker-plan-access:${todayKey}`,
    });
  }

  const pendingCollectionsCount = invoiceCandidates.filter((invoice) => {
    const paidAmount = paymentTotalsByInvoiceId.get(invoice.id) ?? 0;
    return Math.max(0, toNotificationNumber(invoice.total) - paidAmount) > 0;
  }).length;

  if (paymentRemindersEnabled && now.getHours() >= DAILY_CLOSING_REMINDER_HOUR) {
    await dispatchNotification({
      userId,
      businessId,
      type: "system",
      title: "Today's closing pending",
      message:
        pendingCollectionsCount > 0
          ? `Review today's closing. ${pendingCollectionsCount} payment${pendingCollectionsCount === 1 ? " is" : "s are"} still pending across open invoices.`
          : "Today's closing is pending. Review cash, UPI, and bank entries before wrapping up.",
      actionUrl: "/dashboard",
      priority: pendingCollectionsCount > 0 ? "warning" : "info",
      referenceKey: `daily-closing:${todayKey}`,
    });
  }

  if (now.getHours() >= NO_SALES_WARNING_HOUR && salesToday === 0) {
    await dispatchNotification({
      userId,
      businessId,
      type: "system",
      title: "No sales recorded today",
      message:
        "No completed sales have been recorded yet today. Review walk-ins, billing activity, and staff follow-up.",
      actionUrl: "/dashboard",
      priority: "info",
      referenceKey: `no-sales-today:${todayKey}`,
    });
  }
};

export const syncNotificationsForAllUsers = async () => {
  if (!(await hasNotificationTable())) {
    return;
  }

  const users = await prisma.user.findMany({
    where: { deleted_at: null },
    select: {
      id: true,
      name: true,
    },
  });

  for (const user of users) {
    try {
      const business = await findBusinessByOwnerIdIfAvailable(user.id);
      await syncNotifications({
        userId: user.id,
        businessId: business?.id ?? `legacy-business-${user.id}`,
      });
    } catch (error) {
      console.warn("[notifications] scheduled sync failed", {
        userId: user.id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
};

export const syncNotificationsIfStale = async (params: {
  userId: number;
  businessId: string;
}) => {
  const current = notificationSyncState.get(params.userId);
  const now = Date.now();

  if (current?.inFlight) {
    return current.inFlight;
  }

  if (current && now - current.syncedAt < NOTIFICATION_SYNC_TTL_MS) {
    return Promise.resolve();
  }

  const inFlight = syncNotifications(params)
    .catch((error) => {
      console.error(
        "[Notifications] Sync failed, serving cached notifications",
        error,
      );
    })
    .finally(() => {
      notificationSyncState.set(params.userId, {
        syncedAt: Date.now(),
        inFlight: null,
      });
    });

  notificationSyncState.set(params.userId, {
    syncedAt: current?.syncedAt ?? 0,
    inFlight,
  });

  return inFlight;
};
