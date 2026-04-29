import type { Request, Response } from "express";
import { AuthMethod, Prisma } from "@prisma/client";
import prisma from "../config/db.config.js";
import { sendResponse } from "../utils/sendResponse.js";
import { recordAuthEvent } from "../lib/modernAuth.js";
import { ensureUserPreferenceCompatibility } from "../lib/schemaCompatibility.js";
import {
  respondWithRedisCachedData,
  setRedisResourceCache,
} from "../lib/redisResourceCache.js";
import { measureRequestPhase } from "../lib/requestPerformance.js";
import {
  clearAuthCookies,
  revokeAllRefreshTokensForUser,
} from "../lib/authCookies.js";
import {
  getCurrentRefreshSessionId,
  listActiveDeviceSessions,
  revokeOtherRefreshSessions,
  revokeRefreshSessionById,
} from "../services/deviceSessions.service.js";
import { recordAuditLog } from "../services/auditLog.service.js";
import {
  buildSettingsPreferencesCachePrefix,
  buildSettingsPreferencesRedisKey,
} from "../redis/cacheKeys.js";

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

const SETTINGS_PREFERENCES_CACHE_TTL_SECONDS = Math.max(
  Number(process.env.SETTINGS_PREFERENCES_CACHE_TTL_SECONDS ?? 900),
  30,
);
const SETTINGS_PREFERENCES_CACHE_SWR_SECONDS = Math.max(
  Number(process.env.SETTINGS_PREFERENCES_CACHE_SWR_SECONDS ?? 300),
  0,
);

const readRouteParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const getOrCreatePreference = async (userId: number) => {
  await ensureUserPreferenceCompatibility();

  const existing = await prisma.userPreference.findUnique({
    where: { user_id: userId },
  });

  if (existing) {
    return existing;
  }

  return prisma.userPreference.create({
    data: {
      user_id: userId,
    },
  });
};

class SettingsController {
  private static ensureOwnerSecurityAccess(req: Request, res: Response) {
    if (!req.user?.ownerUserId) {
      sendResponse(res, 401, { message: "Unauthorized" });
      return null;
    }

    if (req.user.accountType !== "OWNER") {
      sendResponse(res, 403, {
        message: "Security session controls are available only for owner accounts.",
      });
      return null;
    }

    return req.user.ownerUserId;
  }

  static async preferences(req: Request, res: Response) {
    const userId = req.user?.id;
    const businessId = req.user?.businessId?.trim();
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    return respondWithRedisCachedData({
      req,
      res,
      key: buildSettingsPreferencesRedisKey({ businessId, userId }),
      label: "settings-preferences",
      ttlSeconds: SETTINGS_PREFERENCES_CACHE_TTL_SECONDS,
      staleWhileRevalidateSeconds: SETTINGS_PREFERENCES_CACHE_SWR_SECONDS,
      invalidationPrefixes: [
        buildSettingsPreferencesCachePrefix({ businessId, userId }),
      ],
      resolver: async () => {
        const preference = await measureRequestPhase(
          "settings.db.preferences",
          () => getOrCreatePreference(userId),
        );
        return measureRequestPhase(
          "settings.serialize.preferences",
          async () => mapPreferenceResponse(preference),
        );
      },
    });
  }

  static async savePreferences(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const body = (req.body ?? {}) as SettingsPayload;
    await ensureUserPreferenceCompatibility();

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

    const responseData = mapPreferenceResponse(updated);
    void setRedisResourceCache(
      buildSettingsPreferencesRedisKey({
        businessId: req.user?.businessId?.trim(),
        userId,
      }),
      {
        value: responseData,
        ttlSeconds: SETTINGS_PREFERENCES_CACHE_TTL_SECONDS,
        staleWhileRevalidateSeconds: SETTINGS_PREFERENCES_CACHE_SWR_SECONDS,
        invalidationPrefixes: [
          buildSettingsPreferencesCachePrefix({
            businessId: req.user?.businessId?.trim(),
            userId,
          }),
        ],
      },
    );

    return sendResponse(res, 200, {
      message: "Settings saved",
      data: responseData,
    });
  }

  static async securityActivity(req: Request, res: Response) {
    const userId = SettingsController.ensureOwnerSecurityAccess(req, res);
    if (!userId) return;

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

  static async securitySessions(req: Request, res: Response) {
    const userId = SettingsController.ensureOwnerSecurityAccess(req, res);
    if (!userId) return;

    const sessions = await listActiveDeviceSessions(userId, req);

    return sendResponse(res, 200, {
      data: sessions,
    });
  }

  static async logoutOthers(req: Request, res: Response) {
    const userId = SettingsController.ensureOwnerSecurityAccess(req, res);
    if (!userId) return;

    const currentSessionId = await getCurrentRefreshSessionId(req, userId);
    const revokedCount = await revokeOtherRefreshSessions(
      userId,
      currentSessionId,
      "logout_other_devices",
    );

    await recordAuthEvent({
      req,
      userId,
      method: AuthMethod.PASSWORD,
      success: true,
      actorType: req.user?.accountType ?? "OWNER",
      metadata: {
        action: "LOGOUT_OTHER_DEVICES",
        revokedCount,
      },
    });
    await recordAuditLog({
      req,
      userId,
      actorId: req.user?.actorId ?? String(userId),
      actorType: req.user?.accountType ?? "OWNER",
      action: "security.logout_other_devices",
      resourceType: "session",
      status: "success",
      metadata: {
        revokedCount,
        currentSessionId,
      },
    });

    return sendResponse(res, 200, {
      message: revokedCount
        ? "Other device sessions have been revoked."
        : "No other active device sessions were found.",
      data: {
        revokedCount,
      },
    });
  }

  static async revokeSession(req: Request, res: Response) {
    const userId = SettingsController.ensureOwnerSecurityAccess(req, res);
    if (!userId) return;

    const sessionId = readRouteParam(req.params.id)?.trim();
    if (!sessionId) {
      return sendResponse(res, 422, { message: "Session id is required" });
    }

    const currentSessionId = await getCurrentRefreshSessionId(req, userId);
    const revoked = await revokeRefreshSessionById(
      userId,
      sessionId,
      sessionId === currentSessionId
        ? "manual_logout_current_session"
        : "manual_logout_other_session",
    );

    if (!revoked) {
      return sendResponse(res, 404, {
        message: "Session not found",
      });
    }

    if (sessionId === currentSessionId) {
      clearAuthCookies(res);
    }

    await recordAuditLog({
      req,
      userId,
      actorId: req.user?.actorId ?? String(userId),
      actorType: req.user?.accountType ?? "OWNER",
      action:
        sessionId === currentSessionId
          ? "security.logout_current_session"
          : "security.logout_session",
      resourceType: "session",
      resourceId: sessionId,
      status: "success",
    });

    return sendResponse(res, 200, {
      message:
        sessionId === currentSessionId
          ? "Current session logged out."
          : "Device session revoked.",
    });
  }

  static async logoutAll(req: Request, res: Response) {
    const userId = SettingsController.ensureOwnerSecurityAccess(req, res);
    if (!userId) return;

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

    await revokeAllRefreshTokensForUser(userId, "logout_all_devices");
    clearAuthCookies(res);

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
    await recordAuditLog({
      req,
      userId,
      actorId: req.user?.actorId ?? String(userId),
      actorType: req.user?.accountType ?? "OWNER",
      action: "security.logout_all_devices",
      resourceType: "session",
      status: "success",
    });

    return sendResponse(res, 200, {
      message: "All active sessions have been revoked.",
    });
  }
}

export default SettingsController;
