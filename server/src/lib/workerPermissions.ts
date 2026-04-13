import prisma from "../config/db.config.js";

export type WorkerAccessRole = "ADMIN" | "SALESPERSON" | "STAFF" | "VIEWER";
export type BillingAction = "read" | "create" | "update" | "delete";

export const getWorkerAccessRole = async (
  workerId: string,
): Promise<WorkerAccessRole | null> => {
  try {
    const rows = await prisma.$queryRaw<Array<{ access_role: string }>>`
      SELECT "access_role"
      FROM "worker_profiles"
      WHERE "worker_id" = ${workerId}
      LIMIT 1
    `;

    const role = rows[0]?.access_role;
    if (
      role === "ADMIN" ||
      role === "SALESPERSON" ||
      role === "STAFF" ||
      role === "VIEWER"
    ) {
      return role;
    }

    return null;
  } catch {
    // Backward-compatible fallback when migration is not yet applied.
    return null;
  }
};

export const canWorkerPerformBillingAction = (
  accessRole: WorkerAccessRole,
  action: BillingAction,
) => {
  if (accessRole === "ADMIN" || accessRole === "SALESPERSON") {
    return true;
  }

  if (accessRole === "STAFF") {
    return action === "read" || action === "create" || action === "update";
  }

  return action === "read";
};
