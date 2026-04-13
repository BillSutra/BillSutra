import type { Request, Response } from "express";
import { Prisma, type WorkerRole } from "@prisma/client";
import prisma from "../config/db.config.js";
import { sendResponse } from "../utils/sendResponse.js";
import bcrypt from "bcryptjs";
import {
  ensureBusinessForUser,
  isBusinessTableAvailable,
  isWorkersTableAvailable,
} from "../lib/authSession.js";

const WORKER_MIGRATION_MESSAGE =
  "Worker management requires the latest database migration. Run Prisma migrations and restart the server.";

const normalizeWorkerPhone = (value: string) => value.replace(/\D/g, "");
const readRouteParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

type WorkerAccessRole = "ADMIN" | "SALESPERSON" | "STAFF" | "VIEWER";
type WorkerStatus = "ACTIVE" | "INACTIVE";
type WorkerIncentiveType = "NONE" | "PERCENTAGE" | "PER_SALE";

type WorkerProfileRow = {
  workerId: string;
  accessRole: WorkerAccessRole;
  status: WorkerStatus;
  joiningDate: Date | null;
  incentiveType: WorkerIncentiveType;
  incentiveValue: number;
  lastActiveAt: Date | null;
};

const DEFAULT_WORKER_PROFILE: Omit<WorkerProfileRow, "workerId"> = {
  accessRole: "STAFF",
  status: "ACTIVE",
  joiningDate: null,
  incentiveType: "NONE",
  incentiveValue: 0,
  lastActiveAt: null,
};

const toNumber = (value: unknown) => Number(value ?? 0);

const getFilterStartDate = (period: string | undefined) => {
  const now = new Date();
  const start = new Date(now);

  if (period === "today") {
    start.setHours(0, 0, 0, 0);
    return start;
  }

  if (period === "this_week") {
    const weekday = start.getDay();
    const offset = weekday === 0 ? 6 : weekday - 1;
    start.setDate(start.getDate() - offset);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  if (period === "this_month") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  return null;
};

const parsePeriod = (value: unknown) => {
  const raw = typeof value === "string" ? value : "this_month";
  if (raw === "today" || raw === "this_week" || raw === "this_month") {
    return raw;
  }
  return "this_month";
};

const missingWorkerExtensionError = (error: unknown) => {
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase();
  return (
    message.includes("worker_profiles") ||
    (message.includes("column") && message.includes("worker_id"))
  );
};

const ensureWorkerProfilesTable = async () => {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "worker_profiles" (
      "worker_id" VARCHAR(191) PRIMARY KEY,
      "access_role" VARCHAR(32) NOT NULL DEFAULT 'STAFF',
      "status" VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
      "joining_date" TIMESTAMP(3),
      "incentive_type" VARCHAR(32) NOT NULL DEFAULT 'NONE',
      "incentive_value" NUMERIC(12,2) NOT NULL DEFAULT 0,
      "last_active_at" TIMESTAMP(3),
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;
};

const upsertWorkerProfile = async (
  workerId: string,
  payload: Partial<Omit<WorkerProfileRow, "workerId">>,
) => {
  await ensureWorkerProfilesTable();

  const accessRole = payload.accessRole ?? DEFAULT_WORKER_PROFILE.accessRole;
  const status = payload.status ?? DEFAULT_WORKER_PROFILE.status;
  const joiningDate = payload.joiningDate ?? null;
  const incentiveType =
    payload.incentiveType ?? DEFAULT_WORKER_PROFILE.incentiveType;
  const incentiveValue =
    payload.incentiveValue ?? DEFAULT_WORKER_PROFILE.incentiveValue;
  const lastActiveAt = payload.lastActiveAt ?? null;

  await prisma.$executeRaw`
    INSERT INTO "worker_profiles" (
      "worker_id",
      "access_role",
      "status",
      "joining_date",
      "incentive_type",
      "incentive_value",
      "last_active_at"
    )
    VALUES (
      ${workerId},
      ${accessRole},
      ${status},
      ${joiningDate},
      ${incentiveType},
      ${incentiveValue},
      ${lastActiveAt}
    )
    ON CONFLICT ("worker_id") DO UPDATE SET
      "access_role" = EXCLUDED."access_role",
      "status" = EXCLUDED."status",
      "joining_date" = EXCLUDED."joining_date",
      "incentive_type" = EXCLUDED."incentive_type",
      "incentive_value" = EXCLUDED."incentive_value",
      "last_active_at" = COALESCE(EXCLUDED."last_active_at", "worker_profiles"."last_active_at"),
      "updated_at" = CURRENT_TIMESTAMP
  `;
};

const loadWorkerProfiles = async (workerIds: string[]) => {
  if (!workerIds.length) {
    return new Map<string, WorkerProfileRow>();
  }

  try {
    await ensureWorkerProfilesTable();
    const rows = await prisma.$queryRaw<
      Array<{
        worker_id: string;
        access_role: string;
        status: string;
        joining_date: Date | null;
        incentive_type: string;
        incentive_value: Prisma.Decimal | number;
        last_active_at: Date | null;
      }>
    >(Prisma.sql`
      SELECT
        "worker_id",
        "access_role",
        "status",
        "joining_date",
        "incentive_type",
        "incentive_value",
        "last_active_at"
      FROM "worker_profiles"
      WHERE "worker_id" IN (${Prisma.join(workerIds.map((id) => Prisma.sql`${id}`))})
    `);

    return new Map(
      rows.map((row) => [
        row.worker_id,
        {
          workerId: row.worker_id,
          accessRole: (row.access_role as WorkerAccessRole) ?? "STAFF",
          status: (row.status as WorkerStatus) ?? "ACTIVE",
          joiningDate: row.joining_date,
          incentiveType: (row.incentive_type as WorkerIncentiveType) ?? "NONE",
          incentiveValue: toNumber(row.incentive_value),
          lastActiveAt: row.last_active_at,
        },
      ]),
    );
  } catch (error) {
    if (!missingWorkerExtensionError(error)) {
      throw error;
    }

    return new Map<string, WorkerProfileRow>();
  }
};

const calculateIncentive = (
  incentiveType: WorkerIncentiveType,
  incentiveValue: number,
  totalSales: number,
  totalOrders: number,
) => {
  if (incentiveType === "PERCENTAGE") {
    return (incentiveValue / 100) * totalSales;
  }

  if (incentiveType === "PER_SALE") {
    return incentiveValue * totalOrders;
  }

  return 0;
};

const listWorkerSalesAgg = async (
  workerIds: string[],
  startDate: Date | null,
) => {
  if (!workerIds.length)
    return new Map<string, { total: number; count: number }>();

  const dateFilter = startDate
    ? Prisma.sql`AND s."created_at" >= ${startDate}`
    : Prisma.sql``;

  const rows = await prisma.$queryRaw<
    Array<{
      worker_id: string;
      total_amount: Prisma.Decimal | number;
      order_count: bigint | number;
    }>
  >(Prisma.sql`
    SELECT
      s."worker_id",
      COALESCE(SUM(s."total_amount"), 0) AS total_amount,
      COUNT(*) AS order_count
    FROM "sales" s
    WHERE s."worker_id" IN (${Prisma.join(workerIds.map((id) => Prisma.sql`${id}`))})
      ${dateFilter}
    GROUP BY s."worker_id"
  `);

  return new Map(
    rows.map((row) => [
      row.worker_id,
      {
        total: toNumber(row.total_amount),
        count: Number(row.order_count),
      },
    ]),
  );
};

const listWorkerInvoicesAgg = async (
  workerIds: string[],
  startDate: Date | null,
) => {
  if (!workerIds.length)
    return new Map<string, { total: number; count: number }>();

  const dateFilter = startDate
    ? Prisma.sql`AND i."created_at" >= ${startDate}`
    : Prisma.sql``;

  const rows = await prisma.$queryRaw<
    Array<{
      worker_id: string;
      total_amount: Prisma.Decimal | number;
      order_count: bigint | number;
    }>
  >(Prisma.sql`
    SELECT
      i."worker_id",
      COALESCE(SUM(i."total"), 0) AS total_amount,
      COUNT(*) AS order_count
    FROM "invoices" i
    WHERE i."worker_id" IN (${Prisma.join(workerIds.map((id) => Prisma.sql`${id}`))})
      ${dateFilter}
    GROUP BY i."worker_id"
  `);

  return new Map(
    rows.map((row) => [
      row.worker_id,
      {
        total: toNumber(row.total_amount),
        count: Number(row.order_count),
      },
    ]),
  );
};

const buildWorkerPerformance = async (
  workers: Array<{
    id: string;
    name: string;
    email: string;
    phone: string | null;
    role: WorkerRole;
    businessId: string;
    createdAt: Date;
  }>,
  period: string,
) => {
  const workerIds = workers.map((worker) => worker.id);
  const startDate = getFilterStartDate(period);
  const thisMonthStart = getFilterStartDate("this_month");

  try {
    const [profiles, salesMap, invoicesMap, monthlySalesMap] =
      await Promise.all([
        loadWorkerProfiles(workerIds),
        listWorkerSalesAgg(workerIds, startDate),
        listWorkerInvoicesAgg(workerIds, startDate),
        listWorkerSalesAgg(workerIds, thisMonthStart),
      ]);

    const workerCards = workers.map((worker) => {
      const profile = profiles.get(worker.id) ?? {
        workerId: worker.id,
        ...DEFAULT_WORKER_PROFILE,
      };
      const saleAgg = salesMap.get(worker.id) ?? { total: 0, count: 0 };
      const invoiceAgg = invoicesMap.get(worker.id) ?? { total: 0, count: 0 };
      const monthAgg = monthlySalesMap.get(worker.id) ?? { total: 0, count: 0 };
      const totalSales = saleAgg.total + invoiceAgg.total;
      const totalOrders = saleAgg.count + invoiceAgg.count;
      const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
      const incentiveEarned = calculateIncentive(
        profile.incentiveType,
        profile.incentiveValue,
        totalSales,
        totalOrders,
      );

      return {
        ...worker,
        roleLabel: profile.accessRole,
        status: profile.status,
        joiningDate: profile.joiningDate,
        incentiveType: profile.incentiveType,
        incentiveValue: profile.incentiveValue,
        lastActiveAt: profile.lastActiveAt,
        metrics: {
          totalSales,
          totalInvoices: invoiceAgg.count,
          totalOrders,
          averageOrderValue,
          incentiveEarned,
          thisMonthSales: monthAgg.total,
        },
      };
    });

    const summary = workerCards.reduce(
      (acc, worker) => {
        acc.totalSales += worker.metrics.totalSales;
        acc.totalOrders += worker.metrics.totalOrders;
        acc.incentiveEarned += worker.metrics.incentiveEarned;
        acc.thisMonthSales += worker.metrics.thisMonthSales;
        return acc;
      },
      { totalSales: 0, totalOrders: 0, incentiveEarned: 0, thisMonthSales: 0 },
    );

    return { workerCards, summary };
  } catch (error) {
    if (!missingWorkerExtensionError(error)) {
      throw error;
    }

    const workerCards = workers.map((worker) => ({
      ...worker,
      roleLabel: DEFAULT_WORKER_PROFILE.accessRole,
      status: DEFAULT_WORKER_PROFILE.status,
      joiningDate: null,
      incentiveType: DEFAULT_WORKER_PROFILE.incentiveType,
      incentiveValue: DEFAULT_WORKER_PROFILE.incentiveValue,
      lastActiveAt: null,
      metrics: {
        totalSales: 0,
        totalInvoices: 0,
        totalOrders: 0,
        averageOrderValue: 0,
        incentiveEarned: 0,
        thisMonthSales: 0,
      },
    }));

    return {
      workerCards,
      summary: {
        totalSales: 0,
        totalOrders: 0,
        incentiveEarned: 0,
        thisMonthSales: 0,
      },
    };
  }
};

const loadRecentWorkerActivity = async (workerIds: string[]) => {
  if (!workerIds.length) return [];

  try {
    const rows = await prisma.$queryRaw<
      Array<{
        worker_id: string;
        activity_type: "SALE" | "INVOICE";
        reference: string;
        amount: Prisma.Decimal | number;
        created_at: Date;
      }>
    >(Prisma.sql`
      SELECT
        s."worker_id",
        'SALE'::text AS activity_type,
        CONCAT('SALE-', s."id") AS reference,
        s."total_amount" AS amount,
        s."created_at" AS created_at
      FROM "sales" s
      WHERE s."worker_id" IN (${Prisma.join(workerIds.map((id) => Prisma.sql`${id}`))})

      UNION ALL

      SELECT
        i."worker_id",
        'INVOICE'::text AS activity_type,
        i."invoice_number" AS reference,
        i."total" AS amount,
        i."created_at" AS created_at
      FROM "invoices" i
      WHERE i."worker_id" IN (${Prisma.join(workerIds.map((id) => Prisma.sql`${id}`))})

      ORDER BY created_at DESC
      LIMIT 12
    `);

    return rows.map((row) => ({
      workerId: row.worker_id,
      activityType: row.activity_type,
      reference: row.reference,
      amount: toNumber(row.amount),
      createdAt: row.created_at,
    }));
  } catch (error) {
    if (!missingWorkerExtensionError(error)) {
      throw error;
    }

    return [];
  }
};

const ensureWorkerTablesReady = async (res: Response) => {
  const [hasBusinessTable, hasWorkersTable] = await Promise.all([
    isBusinessTableAvailable(),
    isWorkersTableAvailable(),
  ]);

  if (hasBusinessTable && hasWorkersTable) {
    return true;
  }

  sendResponse(res, 503, {
    message: WORKER_MIGRATION_MESSAGE,
  });
  return false;
};

const resolveWorkerRouteBusinessId = async (req: Request) => {
  if (!req.user) {
    return null;
  }

  if (req.user.accountType === "OWNER") {
    const business = await ensureBusinessForUser(
      req.user.ownerUserId,
      req.user.name,
    );
    return business.id;
  }

  return req.user.businessId;
};

class WorkersController {
  static async index(req: Request, res: Response) {
    if (!(await ensureWorkerTablesReady(res))) {
      return;
    }

    const businessId = await resolveWorkerRouteBusinessId(req);

    if (!businessId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const period = parsePeriod(req.query.period);

    const workers = await prisma.worker.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        businessId: true,
        createdAt: true,
      },
    });

    const { workerCards } = await buildWorkerPerformance(workers, period);

    return sendResponse(res, 200, { data: workerCards });
  }

  static async overview(req: Request, res: Response) {
    if (!(await ensureWorkerTablesReady(res))) {
      return;
    }

    const businessId = await resolveWorkerRouteBusinessId(req);
    if (!businessId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const period = parsePeriod(req.query.period);

    const workers = await prisma.worker.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        businessId: true,
        createdAt: true,
      },
    });

    const { workerCards, summary } = await buildWorkerPerformance(
      workers,
      period,
    );
    const recentActivity = await loadRecentWorkerActivity(
      workerCards.map((worker) => worker.id),
    );
    const workerMap = new Map(
      workerCards.map((worker) => [worker.id, worker.name]),
    );

    const leaderboard = [...workerCards]
      .sort((left, right) => right.metrics.totalSales - left.metrics.totalSales)
      .slice(0, 5)
      .map((worker, index) => ({
        rank: index + 1,
        workerId: worker.id,
        name: worker.name,
        totalSales: worker.metrics.totalSales,
        totalOrders: worker.metrics.totalOrders,
      }));

    return sendResponse(res, 200, {
      data: {
        workers: workerCards,
        summary,
        recentActivity: recentActivity.map((activity) => ({
          ...activity,
          workerName: workerMap.get(activity.workerId) ?? "Unknown",
        })),
        leaderboard,
      },
    });
  }

  static async store(req: Request, res: Response) {
    if (!(await ensureWorkerTablesReady(res))) {
      return;
    }

    const businessId = await resolveWorkerRouteBusinessId(req);

    if (!businessId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const {
      name,
      email,
      phone,
      password,
      accessRole,
      status,
      joiningDate,
      incentiveType,
      incentiveValue,
    } = req.body as {
      name: string;
      email: string;
      phone: string;
      password: string;
      accessRole?: WorkerAccessRole;
      status?: WorkerStatus;
      joiningDate?: Date;
      incentiveType?: WorkerIncentiveType;
      incentiveValue?: number;
    };
    const normalizedPhone = normalizeWorkerPhone(phone);

    const existingWorker = await prisma.worker.findFirst({
      where: {
        OR: [{ email }, { phone: normalizedPhone }],
      },
      select: { id: true, email: true, phone: true },
    });
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser || existingWorker?.email === email) {
      return sendResponse(res, 422, {
        message: "Worker email already registered",
        errors: { email: "Worker email already registered" },
      });
    }

    if (existingWorker?.phone === normalizedPhone) {
      return sendResponse(res, 422, {
        message: "Worker phone number already registered",
        errors: { phone: "Worker phone number already registered" },
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const worker = await prisma.worker.create({
      data: {
        name,
        email,
        phone: normalizedPhone,
        role: (accessRole === "ADMIN" ? "ADMIN" : "WORKER") as WorkerRole,
        businessId,
        password: hashedPassword,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        businessId: true,
        createdAt: true,
      },
    });

    await upsertWorkerProfile(worker.id, {
      accessRole: accessRole ?? "STAFF",
      status: status ?? "ACTIVE",
      joiningDate: joiningDate ?? null,
      incentiveType: incentiveType ?? "NONE",
      incentiveValue: incentiveValue ?? 0,
    });

    return sendResponse(res, 201, {
      message: "Worker created successfully",
      data: worker,
    });
  }

  static async update(req: Request, res: Response) {
    if (!(await ensureWorkerTablesReady(res))) {
      return;
    }

    const businessId = await resolveWorkerRouteBusinessId(req);
    const workerId = readRouteParam(req.params.id);

    if (!businessId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    if (!workerId) {
      return sendResponse(res, 422, { message: "Worker id is required" });
    }

    const {
      name,
      email,
      phone,
      password,
      accessRole,
      status,
      joiningDate,
      incentiveType,
      incentiveValue,
    } = req.body as {
      name?: string;
      email?: string;
      phone?: string;
      password?: string;
      accessRole?: WorkerAccessRole;
      status?: WorkerStatus;
      joiningDate?: Date;
      incentiveType?: WorkerIncentiveType;
      incentiveValue?: number;
    };
    const normalizedPhone = phone ? normalizeWorkerPhone(phone) : undefined;

    const worker = await prisma.worker.findFirst({
      where: {
        id: workerId,
        businessId,
      },
      select: { id: true, email: true },
    });

    if (!worker) {
      return sendResponse(res, 404, { message: "Worker not found" });
    }

    if (normalizedPhone) {
      const workerWithPhone = await prisma.worker.findFirst({
        where: {
          phone: normalizedPhone,
          NOT: { id: worker.id },
        },
        select: { id: true },
      });

      if (workerWithPhone) {
        return sendResponse(res, 422, {
          message: "Worker phone number already registered",
          errors: { phone: "Worker phone number already registered" },
        });
      }
    }

    if (email && email !== worker.email) {
      const workerWithEmail = await prisma.worker.findFirst({
        where: {
          email,
          NOT: { id: worker.id },
        },
        select: { id: true },
      });
      const existingUser = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });

      if (workerWithEmail || existingUser) {
        return sendResponse(res, 422, {
          message: "Worker email already registered",
          errors: { email: "Worker email already registered" },
        });
      }
    }

    const updatedWorker = await prisma.worker.update({
      where: { id: worker.id },
      data: {
        name: name ?? undefined,
        email: email ?? undefined,
        phone: normalizedPhone ?? undefined,
        role: accessRole
          ? ((accessRole === "ADMIN" ? "ADMIN" : "WORKER") as WorkerRole)
          : undefined,
        password: password ? await bcrypt.hash(password, 12) : undefined,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        businessId: true,
        createdAt: true,
      },
    });

    if (
      accessRole !== undefined ||
      status !== undefined ||
      joiningDate !== undefined ||
      incentiveType !== undefined ||
      incentiveValue !== undefined
    ) {
      await upsertWorkerProfile(worker.id, {
        accessRole,
        status,
        joiningDate,
        incentiveType,
        incentiveValue,
      });
    }

    return sendResponse(res, 200, {
      message: "Worker updated successfully",
      data: updatedWorker,
    });
  }

  static async destroy(req: Request, res: Response) {
    if (!(await ensureWorkerTablesReady(res))) {
      return;
    }

    const businessId = await resolveWorkerRouteBusinessId(req);
    const workerId = readRouteParam(req.params.id);

    if (!businessId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    if (!workerId) {
      return sendResponse(res, 422, { message: "Worker id is required" });
    }

    if (req.user?.workerId && req.user.workerId === workerId) {
      return sendResponse(res, 400, {
        message: "You cannot delete your own worker account",
      });
    }

    const worker = await prisma.worker.findFirst({
      where: {
        id: workerId,
        businessId,
      },
      select: { id: true },
    });

    if (!worker) {
      return sendResponse(res, 404, { message: "Worker not found" });
    }

    await prisma.$transaction([
      prisma.$executeRaw`DELETE FROM "worker_profiles" WHERE "worker_id" = ${worker.id}`,
      prisma.worker.delete({ where: { id: worker.id } }),
    ]);

    return sendResponse(res, 200, { message: "Worker deleted successfully" });
  }
}

export default WorkersController;
