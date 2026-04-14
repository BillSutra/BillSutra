import {
  NotificationType,
  Prisma,
  SubscriptionStatus,
} from "@prisma/client";
import prisma from "../config/db.config.js";
import { getInventoryInsights } from "./inventoryInsights.service.js";

const PAYMENT_DUE_LOOKAHEAD_DAYS = 2;
const SUBSCRIPTION_WARNING_DAYS = 5;
const NOTIFICATION_TABLE_CHECK_TTL_MS = 60_000;

const notificationTypeMap = {
  payment: NotificationType.PAYMENT,
  inventory: NotificationType.INVENTORY,
  customer: NotificationType.CUSTOMER,
  subscription: NotificationType.SUBSCRIPTION,
  worker: NotificationType.WORKER,
} as const;

export type AppNotificationType = keyof typeof notificationTypeMap;

const notificationApiTypeMap: Record<NotificationType, AppNotificationType> = {
  PAYMENT: "payment",
  INVENTORY: "inventory",
  CUSTOMER: "customer",
  SUBSCRIPTION: "subscription",
  WORKER: "worker",
};

const toIsoDateKey = (value: Date) => value.toISOString().slice(0, 10);

let notificationTableAvailability:
  | { exists: boolean; checkedAt: number }
  | null = null;

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

export const serializeNotification = (notification: {
  id: string;
  business_id: string;
  type: NotificationType;
  message: string;
  is_read: boolean;
  created_at: Date;
}) => ({
  id: notification.id,
  businessId: notification.business_id,
  type: notificationApiTypeMap[notification.type],
  message: notification.message,
  isRead: notification.is_read,
  createdAt: notification.created_at.toISOString(),
});

type CreateNotificationInput = {
  userId: number;
  businessId: string;
  type: AppNotificationType;
  message: string;
  referenceKey?: string | null;
};

export const createNotification = async ({
  userId,
  businessId,
  type,
  message,
  referenceKey,
}: CreateNotificationInput) => {
  if (!(await hasNotificationTable())) {
    return null;
  }

  const data: Prisma.NotificationUncheckedCreateInput = {
    user_id: userId,
    business_id: businessId,
    type: notificationTypeMap[type],
    message,
    reference_key: referenceKey ?? null,
  };

  if (referenceKey) {
    try {
      return await prisma.notification.upsert({
        where: {
          business_id_reference_key: {
            business_id: businessId,
            reference_key: referenceKey,
          },
        },
        update: {
          message,
          type: notificationTypeMap[type],
          is_read: false,
        },
        create: data,
      });
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
  }

  try {
    return await prisma.notification.create({ data });
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

export const listNotifications = async (userId: number, limit = 10) => {
  const safeLimit = Math.max(1, Math.min(limit, 50));
  if (!(await hasNotificationTable())) {
    return [];
  }

  try {
    return await prisma.notification.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
      take: safeLimit,
    });
  } catch (error) {
    if (isNotificationTableMissingError(error)) {
      notificationTableAvailability = {
        exists: false,
        checkedAt: Date.now(),
      };
      return [];
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

export const markNotificationAsRead = async (userId: number, id: string) =>
  {
    if (!(await hasNotificationTable())) {
      return { count: 0 };
    }

    try {
      return await prisma.notification.updateMany({
        where: { id, user_id: userId },
        data: { is_read: true },
      });
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

export const markAllNotificationsAsRead = async (userId: number) =>
  {
    if (!(await hasNotificationTable())) {
      return { count: 0 };
    }

    try {
      return await prisma.notification.updateMany({
        where: { user_id: userId, is_read: false },
        data: { is_read: true },
      });
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

export const syncNotifications = async (params: {
  userId: number;
  businessId: string;
}) => {
  const { userId, businessId } = params;
  if (!(await hasNotificationTable())) {
    return;
  }

  const now = new Date();
  const dueThreshold = new Date(now);
  dueThreshold.setDate(dueThreshold.getDate() + PAYMENT_DUE_LOOKAHEAD_DAYS);

  const subscriptionThreshold = new Date(now);
  subscriptionThreshold.setDate(
    subscriptionThreshold.getDate() + SUBSCRIPTION_WARNING_DAYS,
  );

  const [prefs, dueInvoices, subscription] = await prisma.$transaction([
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
          due_date: { gte: now, lte: dueThreshold },
          status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] },
        },
        select: {
          id: true,
          invoice_number: true,
          due_date: true,
          total: true,
          customer: { select: { name: true } },
        },
        take: 10,
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
    ]);
  const inventoryInsights = await getInventoryInsights(userId);

  if (prefs?.notification_due_invoice_alerts !== false) {
    await Promise.all(
      dueInvoices
        .filter((invoice) => invoice.due_date)
        .map((invoice) =>
          createNotification({
            userId,
            businessId,
            type: "payment",
            message: `Payment due soon for invoice ${invoice.invoice_number} from ${invoice.customer.name}.`,
            referenceKey: `payment-due:${invoice.id}:${toIsoDateKey(invoice.due_date as Date)}`,
          }),
        ),
    );
  }

  if (prefs?.notification_low_stock_alerts !== false) {
    await Promise.all(
      inventoryInsights.insights
        .filter((insight) =>
          ["low_stock", "out_of_stock", "prediction"].includes(insight.type),
        )
        .slice(0, 15)
        .map((insight) =>
          createNotification({
            userId,
            businessId,
            type: "inventory",
            message: insight.message,
            referenceKey: insight.referenceKey,
          }),
        ),
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
    await createNotification({
      userId,
      businessId,
      type: "subscription",
      message: `Your BillSutra subscription may expire by ${subscriptionEnd.toLocaleDateString("en-IN")}. Renew to avoid billing interruptions.`,
      referenceKey: `subscription-warning:${toIsoDateKey(subscriptionEnd)}`,
    });
  }
};
