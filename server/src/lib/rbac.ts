import { Prisma } from "@prisma/client";
import type { Request } from "express";
import prisma from "../config/db.config.js";
import { ensureWorkerPerformanceSchema } from "./workerPerformanceSchema.js";

export type RbacAction =
  | "invoice:create"
  | "invoice:view"
  | "invoice:edit"
  | "invoice:delete";

type WorkerPermissionContext = {
  status: string;
  accessRole: string;
  businessId: string | null;
  permissions: string[];
  reason: string | null;
};

export type RbacDecision = {
  allowed: boolean;
  reason: string;
  permissions: string[];
  worker?: WorkerPermissionContext;
};

const DEFAULT_WORKER_STATUS = "ACTIVE";
const DEFAULT_WORKER_ACCESS_ROLE = "STAFF";

const WORKER_ROLE_PERMISSIONS: Record<string, RbacAction[]> = {
  ADMIN: ["invoice:create", "invoice:view", "invoice:edit"],
  SALESPERSON: ["invoice:create", "invoice:view", "invoice:edit"],
  STAFF: ["invoice:create", "invoice:view"],
  VIEWER: ["invoice:view"],
};

const normalizeRole = (value: unknown) =>
  typeof value === "string" ? value.trim().toUpperCase() : "";

const normalizeWorkerAccessRole = (
  accessRole: unknown,
  workerRole: unknown,
) => {
  const profileRole = normalizeRole(accessRole);
  if (WORKER_ROLE_PERMISSIONS[profileRole]) {
    return profileRole;
  }

  const baseRole = normalizeRole(workerRole);
  if (baseRole === "ADMIN") {
    return "ADMIN";
  }

  if (baseRole === "WORKER" || profileRole === "WORKER") {
    return DEFAULT_WORKER_ACCESS_ROLE;
  }

  return DEFAULT_WORKER_ACCESS_ROLE;
};

const loadWorkerPermissionContext = async (
  workerId: string,
  businessId?: string | null,
): Promise<WorkerPermissionContext> => {
  try {
    await ensureWorkerPerformanceSchema();
    const rows = await prisma.$queryRaw<
      Array<{
        business_id: string | null;
        worker_role: string | null;
        status: string | null;
        access_role: string | null;
      }>
    >(Prisma.sql`
      SELECT
        w."business_id",
        w."role"::text AS "worker_role",
        wp."status",
        wp."access_role"
      FROM "workers" w
      LEFT JOIN "worker_profiles" wp ON wp."worker_id" = w."id"
      WHERE w."id" = ${workerId}
      LIMIT 1
    `);

    if (!rows.length) {
      return {
        status: "MISSING",
        accessRole: DEFAULT_WORKER_ACCESS_ROLE,
        businessId: null,
        permissions: [],
        reason: "worker_not_found",
      };
    }

    const row = rows[0];
    const status = normalizeRole(rows[0]?.status) || DEFAULT_WORKER_STATUS;
    const accessRole = normalizeWorkerAccessRole(
      row.access_role,
      row.worker_role,
    );
    const permissions = WORKER_ROLE_PERMISSIONS[accessRole] ?? [];
    const resolvedBusinessId = row.business_id?.trim() || null;
    const tokenBusinessId = businessId?.trim() || null;
    const reason =
      tokenBusinessId &&
      resolvedBusinessId &&
      tokenBusinessId !== resolvedBusinessId
        ? "business_mismatch"
        : null;

    return {
      status,
      accessRole,
      businessId: resolvedBusinessId,
      permissions,
      reason,
    };
  } catch (error) {
    return {
      status: DEFAULT_WORKER_STATUS,
      accessRole: DEFAULT_WORKER_ACCESS_ROLE,
      businessId: businessId?.trim() || null,
      permissions: WORKER_ROLE_PERMISSIONS[DEFAULT_WORKER_ACCESS_ROLE],
      reason: error instanceof Error ? error.message : String(error),
    };
  }
};

export const can = async (
  user: AuthUser | undefined,
  action: RbacAction,
): Promise<RbacDecision> => {
  if (!user) {
    return {
      allowed: false,
      reason: "unauthenticated",
      permissions: [],
    };
  }

  const accountType = normalizeRole(user.accountType);
  const role = normalizeRole(user.role);

  if (accountType === "OWNER") {
    return {
      allowed: true,
      reason: "owner_allowed",
      permissions: ["*"],
    };
  }

  if (accountType !== "WORKER") {
    return {
      allowed: false,
      reason: "unsupported_account_type",
      permissions: [],
    };
  }

  if (!user.workerId) {
    return {
      allowed: false,
      reason: "worker_id_missing",
      permissions: [],
    };
  }

  const worker = await loadWorkerPermissionContext(
    user.workerId,
    user.businessId,
  );
  if (worker.reason === "worker_not_found") {
    return {
      allowed: false,
      reason: worker.reason,
      permissions: worker.permissions,
      worker,
    };
  }

  if (worker.reason === "business_mismatch") {
    return {
      allowed: false,
      reason: worker.reason,
      permissions: worker.permissions,
      worker,
    };
  }

  if (worker.status !== "ACTIVE") {
    return {
      allowed: false,
      reason: "worker_inactive",
      permissions: worker.permissions,
      worker,
    };
  }

  const permissions =
    role === "ADMIN"
      ? Array.from(
          new Set([
            ...worker.permissions,
            ...WORKER_ROLE_PERMISSIONS.ADMIN,
          ]),
        )
      : worker.permissions;
  const allowed = permissions.includes(action);

  return {
    allowed,
    reason: allowed ? "worker_permission_allowed" : "worker_permission_denied",
    permissions,
    worker: {
      ...worker,
      permissions,
    },
  };
};

export const buildRbacLogContext = (
  req: Request,
  decision: RbacDecision,
) => ({
  role: req.user?.role ?? null,
  accountType: req.user?.accountType ?? null,
  workerId: req.user?.workerId ?? null,
  ownerUserId: req.user?.ownerUserId ?? null,
  businessId: req.user?.businessId ?? null,
  permissions: decision.permissions,
  reason: decision.reason,
  workerStatus: decision.worker?.status ?? null,
  workerAccessRole: decision.worker?.accessRole ?? null,
  workerBusinessId: decision.worker?.businessId ?? null,
});
