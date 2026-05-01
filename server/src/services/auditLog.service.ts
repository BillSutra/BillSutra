import crypto from "crypto";
import type { Request } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../config/db.config.js";
import { getClientIpAddress } from "../lib/modernAuth.js";

type AuditLogStatus =
  | "SUCCESS"
  | "FAILURE"
  | "WARN"
  | "success"
  | "failure"
  | "warning";

type AuditLogParams = {
  req?: Request;
  userId?: number | null;
  actorId: string;
  actorType: string;
  action: string;
  resourceType: string;
  resourceId?: string | number | null;
  status?: AuditLogStatus;
  metadata?: Record<string, unknown> | null;
};

const TABLE_CACHE_TTL_MS = 60_000;
let tableAvailability: { exists: boolean; checkedAt: number } | null = null;

const isAuditLogTableMissingError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  (error.code === "P2021" || error.code === "P2022");

const isAuditLogTableAvailable = async () => {
  const now = Date.now();
  if (tableAvailability && now - tableAvailability.checkedAt < TABLE_CACHE_TTL_MS) {
    return tableAvailability.exists;
  }

  try {
    const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>(Prisma.sql`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'audit_logs'
      ) AS "exists"
    `);

    tableAvailability = {
      exists: rows[0]?.exists === true,
      checkedAt: now,
    };

    return tableAvailability.exists;
  } catch {
    tableAvailability = { exists: false, checkedAt: now };
    return false;
  }
};

export const recordAuditLog = async ({
  req,
  userId,
  actorId,
  actorType,
  action,
  resourceType,
  resourceId,
  status = "SUCCESS",
  metadata,
}: AuditLogParams) => {
  if (!(await isAuditLogTableAvailable())) {
    return;
  }

  const normalizedStatus =
    status === "success"
      ? "SUCCESS"
      : status === "failure"
        ? "FAILURE"
        : status === "warning"
          ? "WARN"
          : status;

  try {
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "audit_logs" (
        "id",
        "user_id",
        "actor_id",
        "actor_type",
        "action",
        "resource_type",
        "resource_id",
        "status",
        "ip_address",
        "user_agent",
        "metadata"
      )
      VALUES (
        ${crypto.randomUUID()},
        ${userId ?? null},
        ${actorId},
        ${actorType},
        ${action},
        ${resourceType},
        ${resourceId === undefined || resourceId === null ? null : String(resourceId)},
        ${normalizedStatus},
        ${req ? getClientIpAddress(req) ?? null : null},
        ${
          req && typeof req.headers["user-agent"] === "string"
            ? req.headers["user-agent"].slice(0, 512)
            : null
        },
        ${metadata ? (metadata as Prisma.InputJsonValue) : Prisma.JsonNull}
      )
    `);
  } catch (error) {
    if (isAuditLogTableMissingError(error)) {
      tableAvailability = { exists: false, checkedAt: Date.now() };
      return;
    }

    console.warn("[audit] unable to persist audit log", {
      action,
      resourceType,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
