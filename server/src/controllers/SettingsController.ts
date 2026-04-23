import type { Request, Response } from "express";
import { AuthMethod, Prisma } from "@prisma/client";
import prisma from "../config/db.config.js";
import { sendResponse } from "../utils/sendResponse.js";
import { recordAuthEvent } from "../lib/modernAuth.js";

type SettingsPayload = {
  appPreferences?: {
    language?: "en" | "hi";
    currency?: "INR" | "USD";
    dateFormat?: "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
  };
  inventory?: {
    allowNegativeStock?: boolean;
  };
  notifications?: {
    paymentReminders?: boolean;
    lowStockAlerts?: boolean;
    dueInvoiceAlerts?: boolean;
  };
  backup?: {
    autoBackupEnabled?: boolean;
  };
  branding?: {
    templateId?: string;
    themeColor?: string;
    terms?: string;
    signature?: string;
  };
};

const parseTemplateId = (value: string | undefined) => {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const mapPreferenceResponse = (pref: {
  language: string;
  currency: string;
  date_format: string;
  allowNegativeStock: boolean;
  notification_payment_reminders: boolean;
  notification_low_stock_alerts: boolean;
  notification_due_invoice_alerts: boolean;
  backup_auto_enabled: boolean;
  branding_template_id: number | null;
  branding_theme_color: string | null;
  branding_terms: string | null;
  branding_signature: string | null;
}) => ({
  appPreferences: {
    language: pref.language,
    currency: pref.currency,
    dateFormat: pref.date_format,
  },
  inventory: {
    allowNegativeStock: pref.allowNegativeStock,
  },
  notifications: {
    paymentReminders: pref.notification_payment_reminders,
    lowStockAlerts: pref.notification_low_stock_alerts,
    dueInvoiceAlerts: pref.notification_due_invoice_alerts,
  },
  backup: {
    autoBackupEnabled: pref.backup_auto_enabled,
  },
  branding: {
    templateId: pref.branding_template_id
      ? String(pref.branding_template_id)
      : "",
    themeColor: pref.branding_theme_color ?? "#1f4b7f",
    terms:
      pref.branding_terms ??
      "Payment due within 7 days. Goods once sold will not be taken back.",
    signature: pref.branding_signature ?? "Authorized Signatory",
  },
});

const getOrCreatePreference = async (userId: number) =>
  prisma.userPreference.upsert({
    where: { user_id: userId },
    update: {},
    create: {
      user_id: userId,
    },
  });

class SettingsController {
  static async preferences(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const preference = await getOrCreatePreference(userId);

    return sendResponse(res, 200, {
      data: mapPreferenceResponse(preference),
    });
  }

  static async savePreferences(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const body = (req.body ?? {}) as SettingsPayload;

    const updated = await prisma.userPreference.upsert({
      where: { user_id: userId },
      update: {
        language: body.appPreferences?.language,
        currency: body.appPreferences?.currency,
        date_format: body.appPreferences?.dateFormat,
        allowNegativeStock: body.inventory?.allowNegativeStock,
        notification_payment_reminders: body.notifications?.paymentReminders,
        notification_low_stock_alerts: body.notifications?.lowStockAlerts,
        notification_due_invoice_alerts: body.notifications?.dueInvoiceAlerts,
        backup_auto_enabled: body.backup?.autoBackupEnabled,
        branding_template_id: parseTemplateId(body.branding?.templateId),
        branding_theme_color: body.branding?.themeColor,
        branding_terms: body.branding?.terms,
        branding_signature: body.branding?.signature,
      },
      create: {
        user_id: userId,
        language: body.appPreferences?.language ?? "en",
        currency: body.appPreferences?.currency ?? "INR",
        date_format: body.appPreferences?.dateFormat ?? "DD/MM/YYYY",
        allowNegativeStock: body.inventory?.allowNegativeStock ?? true,
        notification_payment_reminders:
          body.notifications?.paymentReminders ?? true,
        notification_low_stock_alerts:
          body.notifications?.lowStockAlerts ?? true,
        notification_due_invoice_alerts:
          body.notifications?.dueInvoiceAlerts ?? true,
        backup_auto_enabled: body.backup?.autoBackupEnabled ?? false,
        branding_template_id: parseTemplateId(body.branding?.templateId),
        branding_theme_color: body.branding?.themeColor,
        branding_terms: body.branding?.terms,
        branding_signature: body.branding?.signature,
      },
    });

    return sendResponse(res, 200, {
      message: "Settings saved",
      data: mapPreferenceResponse(updated),
    });
  }

  static async securityActivity(req: Request, res: Response) {
    const userId = req.user?.ownerUserId;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const events = await prisma.authEvent.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
      take: 12,
      select: {
        id: true,
        method: true,
        success: true,
        ip_address: true,
        user_agent: true,
        created_at: true,
      },
    });

    return sendResponse(res, 200, {
      data: events.map((event) => ({
        id: event.id,
        method: event.method,
        success: event.success,
        ipAddress: event.ip_address,
        userAgent: event.user_agent,
        createdAt: event.created_at.toISOString(),
      })),
    });
  }

  static async logoutAll(req: Request, res: Response) {
    const userId = req.user?.ownerUserId;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          session_version: {
            increment: 1,
          },
        },
        select: { id: true },
      });
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        (error.code !== "P2021" && error.code !== "P2022")
      ) {
        throw error;
      }
    }

    await recordAuthEvent({
      req,
      userId,
      method: AuthMethod.PASSWORD,
      success: true,
      actorType: "OWNER",
      metadata: {
        action: "LOGOUT_ALL_DEVICES",
      },
    });

    return sendResponse(res, 200, {
      message: "All active sessions have been revoked.",
    });
  }
}

export default SettingsController;
