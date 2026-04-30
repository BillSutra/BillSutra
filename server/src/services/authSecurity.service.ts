import type { Request } from "express";
import prisma from "../config/db.config.js";
import { recordAuditLog } from "./auditLog.service.js";
import { getClientIpAddress } from "../lib/modernAuth.js";

const SUSPICIOUS_LOGIN_WINDOW_MS = 30 * 60 * 1000;

const normalizeUserAgent = (req: Request) =>
  typeof req.headers["user-agent"] === "string"
    ? req.headers["user-agent"].slice(0, 512)
    : null;

export const maybeHandleSuspiciousLogin = async ({
  req,
  userId,
  email,
  actorId,
  actorType,
}: {
  req: Request;
  userId: number;
  email: string;
  actorId: string;
  actorType: string;
}) => {
  const ipAddress = getClientIpAddress(req);
  const userAgent = normalizeUserAgent(req);

  if (!ipAddress && !userAgent) {
    return;
  }

  const since = new Date(Date.now() - SUSPICIOUS_LOGIN_WINDOW_MS);

  const [lastSuccess, recentFailedCount] = await Promise.all([
    prisma.authEvent.findFirst({
      where: {
        user_id: userId,
        success: true,
      },
      orderBy: { created_at: "desc" },
      select: {
        ip_address: true,
        user_agent: true,
        created_at: true,
      },
    }),
    prisma.authEvent.count({
      where: {
        user_id: userId,
        success: false,
        created_at: { gte: since },
      },
    }),
  ]);

  const previousIpAddress = lastSuccess?.ip_address ?? null;
  const previousUserAgent = lastSuccess?.user_agent ?? null;
  const previousSuccessAt = lastSuccess?.created_at ?? null;

  const ipChanged =
    Boolean(ipAddress) &&
    Boolean(previousIpAddress) &&
    previousIpAddress !== ipAddress;
  const hasBruteForcePattern = recentFailedCount >= 3;

  if (!ipChanged && !hasBruteForcePattern) {
    return;
  }

  await recordAuditLog({
    req,
    userId,
    actorId,
    actorType,
    action: "auth.suspicious_login",
    resourceType: "auth",
    resourceId: userId,
    status: "WARN",
    metadata: {
      ipChanged,
      recentFailedCount,
      currentIpAddress: ipAddress,
      previousIpAddress,
      currentUserAgent: userAgent,
      previousUserAgent,
      previousSuccessAt: previousSuccessAt?.toISOString() ?? null,
    },
  });
  console.warn("[auth] suspicious_login_alert", {
    userId,
    email,
    currentIpAddress: ipAddress ?? "Unavailable",
    previousIpAddress: previousIpAddress ?? "Unavailable",
    recentFailedCount,
  });
};
