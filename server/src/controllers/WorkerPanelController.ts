import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import prisma from "../config/db.config.js";
import { getTotalPages, parsePagination } from "../utils/pagination.js";
import { sendResponse } from "../utils/sendResponse.js";
import { ensureWorkerPerformanceSchema } from "../lib/workerPerformanceSchema.js";
import { storageProvider } from "../services/storage/storage.provider.js";
import { UPLOADS_ROOT, resolveUploadPath } from "../lib/uploadPaths.js";

type WorkerIncentiveType = "NONE" | "PERCENTAGE" | "PER_SALE";

type WorkerProfileData = {
  accessRole: string;
  status: string;
  joiningDate: Date | null;
  incentiveType: WorkerIncentiveType;
  incentiveValue: number;
  lastActiveAt: Date | null;
};

const toNumber = (value: unknown) => {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Prisma.Decimal) return value.toNumber();

  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
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

const loadWorkerProfile = async (
  workerId: string,
): Promise<WorkerProfileData | null> => {
  try {
    await ensureWorkerPerformanceSchema();

    const rows = await prisma.$queryRaw<
      Array<{
        access_role: string;
        status: string;
        joining_date: Date | null;
        incentive_type: string;
        incentive_value: Prisma.Decimal | number;
        last_active_at: Date | null;
      }>
    >`
      SELECT
        "access_role",
        "status",
        "joining_date",
        "incentive_type",
        "incentive_value",
        "last_active_at"
      FROM "worker_profiles"
      WHERE "worker_id" = ${workerId}
      LIMIT 1
    `;

    if (!rows[0]) return null;

    return {
      accessRole: rows[0].access_role,
      status: rows[0].status,
      joiningDate: rows[0].joining_date,
      incentiveType: rows[0].incentive_type as WorkerIncentiveType,
      incentiveValue: toNumber(rows[0].incentive_value),
      lastActiveAt: rows[0].last_active_at,
    };
  } catch (error) {
    if (!missingWorkerExtensionError(error)) {
      throw error;
    }

    return null;
  }
};

const combineFilters = (filters: Prisma.Sql[]) => {
  if (filters.length === 0) {
    return Prisma.sql``;
  }

  return Prisma.sql`WHERE ${Prisma.join(filters, " AND ")}`;
};

const parseOptionalDate = (
  value: unknown,
  options?: { endOfDay?: boolean },
) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return { value: null as Date | null, invalid: false };
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { value: null as Date | null, invalid: true };
  }

  if (options?.endOfDay) {
    parsed.setHours(23, 59, 59, 999);
  } else {
    parsed.setHours(0, 0, 0, 0);
  }

  return { value: parsed, invalid: false };
};

const parseOptionalAmount = (value: unknown) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return { value: null as number | null, invalid: false };
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { value: null as number | null, invalid: true };
  }

  return { value: parsed, invalid: false };
};

const getThisMonthStart = () => {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return start;
};

const getLast12MonthsStart = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  start.setHours(0, 0, 0, 0);
  return start;
};

const buildMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

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

const getWorkerSelfSalesAgg = async (
  workerId: string,
  startDate: Date | null,
  endDate?: Date | null,
) => {
  await ensureWorkerPerformanceSchema();

  const filters = [Prisma.sql`s."worker_id" = ${workerId}`];

  if (startDate) {
    filters.push(
      Prisma.sql`COALESCE(s."sale_date", s."created_at") >= ${startDate}`,
    );
  }

  if (endDate) {
    filters.push(
      Prisma.sql`COALESCE(s."sale_date", s."created_at") <= ${endDate}`,
    );
  }

  const whereClause = combineFilters(filters);

  const rows = await prisma.$queryRaw<
    Array<{
      total_amount: Prisma.Decimal | number;
      order_count: bigint | number;
    }>
  >(Prisma.sql`
    SELECT
      COALESCE(SUM(COALESCE(s."total_amount", s."total")), 0) AS total_amount,
      COUNT(*) AS order_count
    FROM "sales" s
    ${whereClause}
  `);

  return {
    total: toNumber(rows[0]?.total_amount ?? 0),
    count: Number(rows[0]?.order_count ?? 0),
  };
};

const getWorkerSelfInvoicesAgg = async (
  workerId: string,
  startDate: Date | null,
  endDate?: Date | null,
) => {
  await ensureWorkerPerformanceSchema();

  const filters = [Prisma.sql`i."worker_id" = ${workerId}`];

  if (startDate) {
    filters.push(
      Prisma.sql`COALESCE(i."issue_date", i."created_at") >= ${startDate}`,
    );
  }

  if (endDate) {
    filters.push(
      Prisma.sql`COALESCE(i."issue_date", i."created_at") <= ${endDate}`,
    );
  }

  const whereClause = combineFilters(filters);

  const rows = await prisma.$queryRaw<
    Array<{
      total_amount: Prisma.Decimal | number;
      order_count: bigint | number;
    }>
  >(Prisma.sql`
    SELECT
      COALESCE(SUM(i."total"), 0) AS total_amount,
      COUNT(*) AS order_count
    FROM "invoices" i
    ${whereClause}
  `);

  return {
    total: toNumber(rows[0]?.total_amount ?? 0),
    count: Number(rows[0]?.order_count ?? 0),
  };
};

const getMonthlyIncentiveData = async (
  workerId: string,
  incentiveType: WorkerIncentiveType,
  incentiveValue: number,
): Promise<Array<{ month: string; incentive: number }>> => {
  await ensureWorkerPerformanceSchema();

  const periodStart = getLast12MonthsStart();

  const [salesRows, invoiceRows] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        month_start: Date;
        total_sales: Prisma.Decimal | number;
        order_count: bigint | number;
      }>
    >(Prisma.sql`
      SELECT
        DATE_TRUNC('month', COALESCE(s."sale_date", s."created_at")) AS month_start,
        COALESCE(SUM(COALESCE(s."total_amount", s."total")), 0) AS total_sales,
        COUNT(*) AS order_count
      FROM "sales" s
      WHERE s."worker_id" = ${workerId}
        AND COALESCE(s."sale_date", s."created_at") >= ${periodStart}
      GROUP BY DATE_TRUNC('month', COALESCE(s."sale_date", s."created_at"))
    `),
    prisma.$queryRaw<
      Array<{
        month_start: Date;
        total_sales: Prisma.Decimal | number;
        order_count: bigint | number;
      }>
    >(Prisma.sql`
      SELECT
        DATE_TRUNC('month', COALESCE(i."issue_date", i."created_at")) AS month_start,
        COALESCE(SUM(i."total"), 0) AS total_sales,
        COUNT(*) AS order_count
      FROM "invoices" i
      WHERE i."worker_id" = ${workerId}
        AND COALESCE(i."issue_date", i."created_at") >= ${periodStart}
      GROUP BY DATE_TRUNC('month', COALESCE(i."issue_date", i."created_at"))
    `),
  ]);

  const monthMap = new Map<
    string,
    { date: Date; totalSales: number; totalOrders: number }
  >();

  for (let index = 0; index < 12; index += 1) {
    const monthDate = new Date(
      periodStart.getFullYear(),
      periodStart.getMonth() + index,
      1,
    );

    monthMap.set(buildMonthKey(monthDate), {
      date: monthDate,
      totalSales: 0,
      totalOrders: 0,
    });
  }

  for (const row of salesRows) {
    const key = buildMonthKey(new Date(row.month_start));
    const entry = monthMap.get(key);
    if (!entry) continue;

    entry.totalSales += toNumber(row.total_sales);
    entry.totalOrders += Number(row.order_count);
  }

  for (const row of invoiceRows) {
    const key = buildMonthKey(new Date(row.month_start));
    const entry = monthMap.get(key);
    if (!entry) continue;

    entry.totalSales += toNumber(row.total_sales);
    entry.totalOrders += Number(row.order_count);
  }

  return Array.from(monthMap.values()).map((entry) => ({
    month: entry.date.toLocaleString("en-US", {
      month: "short",
      year: "2-digit",
    }),
    incentive: calculateIncentive(
      incentiveType,
      incentiveValue,
      entry.totalSales,
      entry.totalOrders,
    ),
  }));
};

const getIncentiveNote = (
  incentiveType: WorkerIncentiveType,
  incentiveValue: number,
  totalOrders: number,
) => {
  if (incentiveType === "PERCENTAGE") {
    return `${incentiveValue}% of invoice and sales value assigned to you`;
  }

  if (incentiveType === "PER_SALE") {
    return `Rs. ${incentiveValue} per completed invoice or sale (${totalOrders} total activities)`;
  }

  return "No incentive configured yet";
};

const ensureWorkerImageColumn = async () => {
  await prisma.$executeRaw`
    ALTER TABLE "workers"
      ADD COLUMN IF NOT EXISTS "image_url" VARCHAR(255)
  `;
};

const publicUploadUrlToFilePath = (url: string): string => {
  const relative = url.replace(/^\//, "").replace(/^uploads\//, "");
  return resolveUploadPath(UPLOADS_ROOT, relative);
};

const resolveWorkerIdFromRequest = (req: Request) => {
  if (req.user?.workerId?.trim()) {
    return req.user.workerId.trim();
  }

  const actorId = req.user?.actorId;
  if (!actorId?.startsWith("worker:")) {
    return null;
  }

  const parsedWorkerId = actorId.slice("worker:".length).trim();
  return parsedWorkerId.length > 0 ? parsedWorkerId : null;
};

const ensureWorkerSelfServiceAuth = (
  req: Request,
  res: Response,
  route: string,
) => {
  const workerId = resolveWorkerIdFromRequest(req);

  if (!req.user) {
    console.warn("[worker] request_rejected", {
      route,
      reason: "missing_auth_user",
    });
    sendResponse(res, 401, { message: "Unauthorized" });
    return null;
  }

  if (req.user.accountType !== "WORKER") {
    console.warn("[worker] request_rejected", {
      route,
      reason: "wrong_account_type",
      accountType: req.user.accountType,
      role: req.user.role,
    });
    sendResponse(res, 403, { message: "Worker access required" });
    return null;
  }

  if (!workerId) {
    console.warn("[worker] request_rejected", {
      route,
      reason: "missing_worker_id",
      decoded: req.user,
    });
    sendResponse(res, 401, {
      message: "Worker session is missing worker identity. Please sign in again.",
      code: "WORKER_ID_MISSING",
    });
    return null;
  }

  return workerId;
};

const getWorkerPendingPayments = async (workerId: string) => {
  await ensureWorkerPerformanceSchema();

  const [salesRows, invoiceRows] = await Promise.all([
    prisma.$queryRaw<Array<{ pending_amount: Prisma.Decimal | number }>>(
      Prisma.sql`
        SELECT
          COALESCE(
            SUM(
              GREATEST(
                COALESCE(s."pending_amount", s."total" - COALESCE(s."paid_amount", 0), s."total"),
                0
              )
            ),
            0
          ) AS pending_amount
        FROM "sales" s
        WHERE s."worker_id" = ${workerId}
          AND COALESCE(s."payment_status"::text, 'UNPAID') <> 'PAID'
      `,
    ),
    prisma.$queryRaw<Array<{ pending_amount: Prisma.Decimal | number }>>(
      Prisma.sql`
        SELECT
          COALESCE(SUM(GREATEST(i."total" - COALESCE(payment_totals."paid_amount", 0), 0)), 0) AS pending_amount
        FROM "invoices" i
        LEFT JOIN (
          SELECT
            p."invoice_id",
            COALESCE(SUM(p."amount"), 0) AS paid_amount
          FROM "payments" p
          GROUP BY p."invoice_id"
        ) AS payment_totals ON payment_totals."invoice_id" = i."id"
        WHERE i."worker_id" = ${workerId}
      `,
    ),
  ]);

  return (
    toNumber(salesRows[0]?.pending_amount ?? 0) +
    toNumber(invoiceRows[0]?.pending_amount ?? 0)
  );
};

const getWorkerCustomersServed = async (workerId: string) => {
  await ensureWorkerPerformanceSchema();

  const rows = await prisma.$queryRaw<Array<{ customer_count: bigint | number }>>(
    Prisma.sql`
      SELECT COUNT(DISTINCT customer_id) AS customer_count
      FROM (
        SELECT s."customer_id" AS customer_id
        FROM "sales" s
        WHERE s."worker_id" = ${workerId}
          AND s."customer_id" IS NOT NULL

        UNION

        SELECT i."customer_id" AS customer_id
        FROM "invoices" i
        WHERE i."worker_id" = ${workerId}
          AND i."customer_id" IS NOT NULL
      ) AS assigned_customers
    `,
  );

  return Number(rows[0]?.customer_count ?? 0);
};

const getWorkerMonthlySales = async (workerId: string) => {
  await ensureWorkerPerformanceSchema();

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  periodStart.setHours(0, 0, 0, 0);

  const rows = await prisma.$queryRaw<
    Array<{ month_start: Date; sales: Prisma.Decimal | number }>
  >(Prisma.sql`
    SELECT
      month_start,
      COALESCE(SUM(amount), 0) AS sales
    FROM (
      SELECT
        DATE_TRUNC('month', COALESCE(s."sale_date", s."created_at")) AS month_start,
        COALESCE(s."total_amount", s."total") AS amount
      FROM "sales" s
      WHERE s."worker_id" = ${workerId}
        AND COALESCE(s."sale_date", s."created_at") >= ${periodStart}

      UNION ALL

      SELECT
        DATE_TRUNC('month', COALESCE(i."issue_date", i."created_at")) AS month_start,
        i."total" AS amount
      FROM "invoices" i
      WHERE i."worker_id" = ${workerId}
        AND COALESCE(i."issue_date", i."created_at") >= ${periodStart}
    ) AS worker_monthly_sales
    GROUP BY month_start
    ORDER BY month_start ASC
  `);

  const salesByMonth = new Map(
    rows.map((row) => [
      buildMonthKey(new Date(row.month_start)),
      toNumber(row.sales),
    ]),
  );

  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(
      periodStart.getFullYear(),
      periodStart.getMonth() + index,
      1,
    );
    const key = buildMonthKey(date);
    return {
      month: date.toLocaleString("en-US", { month: "short" }),
      sales: salesByMonth.get(key) ?? 0,
    };
  });
};

const buildDayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

const getWorkerWeeklyPerformance = async (workerId: string) => {
  await ensureWorkerPerformanceSchema();

  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - 6);
  periodStart.setHours(0, 0, 0, 0);

  const rows = await prisma.$queryRaw<
    Array<{
      day_start: Date;
      sales: Prisma.Decimal | number;
      orders: bigint | number;
    }>
  >(Prisma.sql`
    SELECT
      day_start,
      COALESCE(SUM(amount), 0) AS sales,
      COUNT(*) AS orders
    FROM (
      SELECT
        DATE_TRUNC('day', COALESCE(s."sale_date", s."created_at")) AS day_start,
        COALESCE(s."total_amount", s."total") AS amount
      FROM "sales" s
      WHERE s."worker_id" = ${workerId}
        AND COALESCE(s."sale_date", s."created_at") >= ${periodStart}

      UNION ALL

      SELECT
        DATE_TRUNC('day', COALESCE(i."issue_date", i."created_at")) AS day_start,
        i."total" AS amount
      FROM "invoices" i
      WHERE i."worker_id" = ${workerId}
        AND COALESCE(i."issue_date", i."created_at") >= ${periodStart}
    ) AS worker_weekly_performance
    GROUP BY day_start
    ORDER BY day_start ASC
  `);

  const dataByDay = new Map(
    rows.map((row) => [
      buildDayKey(new Date(row.day_start)),
      { sales: toNumber(row.sales), orders: Number(row.orders) },
    ]),
  );

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(periodStart);
    date.setDate(periodStart.getDate() + index);
    const key = buildDayKey(date);
    const entry = dataByDay.get(key);
    return {
      day: date.toLocaleString("en-US", { weekday: "short" }),
      sales: entry?.sales ?? 0,
      orders: entry?.orders ?? 0,
    };
  });
};

export type WorkerProfileResponse = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  imageUrl: string | null;
  role: string;
  accessRole: string;
  status: string;
  joiningDate: string | null;
  createdAt: string;
};

export type WorkerDashboardOverviewResponse = {
  metrics: {
    totalInvoices: number;
    totalSales: number;
    totalOrders: number;
    averageOrderValue: number;
    thisMonthSales: number;
    incentiveEarned: number;
    pendingPayments: number;
    customersServed: number;
  };
  monthlySales: Array<{ month: string; sales: number }>;
  weeklyPerformance: Array<{ day: string; sales: number; orders: number }>;
};

export type WorkerIncentiveResponse = {
  totalIncentiveEarned: number;
  incentiveType: WorkerIncentiveType;
  incentiveValue: number;
  calculationNote: string;
  monthlyBreakdown: Array<{ month: string; incentive: number }>;
};

export type WorkerHistoryEntry = {
  id: string;
  type: "INVOICE" | "SALE";
  reference: string;
  customerName: string | null;
  amount: number;
  status: string;
  date: string;
};

export type WorkerHistoryResponse = {
  entries: WorkerHistoryEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

class WorkerPanelController {
  static async getProfile(req: Request, res: Response) {
    const workerId = ensureWorkerSelfServiceAuth(req, res, "/api/worker/profile");

    if (!workerId) {
      return;
    }

    console.info("[worker] profile_auth_context", {
      route: "/api/worker/profile",
      decoded: req.user,
      workerId,
    });

    await ensureWorkerImageColumn();

    const worker = await prisma.worker.findUnique({
      where: { id: workerId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        imageUrl: true,
        role: true,
        createdAt: true,
      },
    });

    if (!worker) {
      return sendResponse(res, 404, { message: "Worker not found" });
    }

    const profile = await loadWorkerProfile(workerId);

    return sendResponse(res, 200, {
      data: {
        id: worker.id,
        name: worker.name,
        email: worker.email,
        phone: worker.phone,
        imageUrl: worker.imageUrl,
        role: worker.role,
        accessRole: profile?.accessRole ?? "STAFF",
        status: profile?.status ?? "ACTIVE",
        joiningDate: profile?.joiningDate?.toISOString() ?? null,
        createdAt: worker.createdAt.toISOString(),
      } satisfies WorkerProfileResponse,
    });
  }

  static async updateProfile(req: Request, res: Response) {
    const workerId = ensureWorkerSelfServiceAuth(req, res, "/api/worker/profile");

    if (!workerId) {
      return;
    }

    const { name, email, phone } = req.body as {
      name?: string;
      email?: string;
      phone?: string;
    };

    const updateData: { name?: string; email?: string; phone?: string } = {};

    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;

    if (Object.keys(updateData).length === 0) {
      return sendResponse(res, 400, { message: "No fields to update" });
    }

    await ensureWorkerImageColumn();

    if (email) {
      const existing = await prisma.worker.findFirst({
        where: { email, id: { not: workerId } },
      });

      if (existing) {
        return sendResponse(res, 422, {
          message: "Email already in use",
          errors: { email: "This email is already registered" },
        });
      }
    }

    if (phone) {
      const existing = await prisma.worker.findFirst({
        where: { phone, id: { not: workerId } },
      });

      if (existing) {
        return sendResponse(res, 422, {
          message: "Phone number already in use",
          errors: { phone: "This phone number is already registered" },
        });
      }
    }

    const updated = await prisma.worker.update({
      where: { id: workerId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        imageUrl: true,
        role: true,
        createdAt: true,
      },
    });

    const profile = await loadWorkerProfile(workerId);

    return sendResponse(res, 200, {
      message: "Profile updated",
      data: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
        imageUrl: updated.imageUrl,
        role: updated.role,
        accessRole: profile?.accessRole ?? "STAFF",
        status: profile?.status ?? "ACTIVE",
        joiningDate: profile?.joiningDate?.toISOString() ?? null,
        createdAt: updated.createdAt.toISOString(),
      } satisfies WorkerProfileResponse,
    });
  }

  static async changePassword(req: Request, res: Response) {
    const workerId = ensureWorkerSelfServiceAuth(req, res, "/api/worker/password");

    if (!workerId) {
      return;
    }

    const { current_password, password } = req.body as {
      current_password: string;
      password: string;
    };

    const worker = await prisma.worker.findUnique({
      where: { id: workerId },
      select: { password: true },
    });

    if (!worker) {
      return sendResponse(res, 404, { message: "Worker not found" });
    }

    const valid = await bcrypt.compare(current_password, worker.password);
    if (!valid) {
      return sendResponse(res, 422, {
        message: "Current password is incorrect",
        errors: { current_password: "Incorrect password" },
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.worker.update({
      where: { id: workerId },
      data: { password: passwordHash },
    });

    return sendResponse(res, 200, { message: "Password updated" });
  }

  static async getDashboardOverview(req: Request, res: Response) {
    const workerId = ensureWorkerSelfServiceAuth(
      req,
      res,
      "/api/worker/dashboard/overview",
    );

    if (!workerId) {
      return;
    }

    const profile = await loadWorkerProfile(workerId);
    const incentiveType = profile?.incentiveType ?? "NONE";
    const incentiveValue = profile?.incentiveValue ?? 0;
    const thisMonthStart = getThisMonthStart();

    const [
      [allTimeSales, allTimeInvoices],
      [thisMonthSalesAgg, thisMonthInvoicesAgg],
      pendingPayments,
      customersServed,
      monthlySales,
      weeklyPerformance,
    ] = await Promise.all([
      Promise.all([
        getWorkerSelfSalesAgg(workerId, null),
        getWorkerSelfInvoicesAgg(workerId, null),
      ]),
      Promise.all([
        getWorkerSelfSalesAgg(workerId, thisMonthStart),
        getWorkerSelfInvoicesAgg(workerId, thisMonthStart),
      ]),
      getWorkerPendingPayments(workerId),
      getWorkerCustomersServed(workerId),
      getWorkerMonthlySales(workerId),
      getWorkerWeeklyPerformance(workerId),
    ]);

    const totalSales = allTimeSales.total + allTimeInvoices.total;
    const totalOrders = allTimeSales.count + allTimeInvoices.count;
    const totalInvoices = allTimeInvoices.count;
    const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
    const thisMonthSales = thisMonthSalesAgg.total + thisMonthInvoicesAgg.total;
    const incentiveEarned = calculateIncentive(
      incentiveType,
      incentiveValue,
      totalSales,
      totalOrders,
    );

    return sendResponse(res, 200, {
      data: {
        metrics: {
          totalInvoices,
          totalSales,
          totalOrders,
          averageOrderValue,
          thisMonthSales,
          incentiveEarned,
          pendingPayments,
          customersServed,
        },
        monthlySales,
        weeklyPerformance,
      } satisfies WorkerDashboardOverviewResponse,
    });
  }

  static async uploadPhoto(req: Request, res: Response) {
    const workerId = ensureWorkerSelfServiceAuth(req, res, "/api/worker/profile/photo");
    const userId = req.user?.id;

    if (!workerId) {
      return;
    }

    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    if (!req.file) {
      return sendResponse(res, 400, { message: "No photo uploaded." });
    }

    console.info("[worker] profile_photo_update_started", {
      route: "/api/worker/profile/photo",
      fileSize: req.file.size,
      mime: req.file.mimetype,
      workerId,
    });

    await ensureWorkerImageColumn();

    const worker = await prisma.worker.findUnique({
      where: { id: workerId },
      select: { id: true, imageUrl: true },
    });

    if (!worker) {
      return sendResponse(res, 404, { message: "Worker not found" });
    }

    let url: string;
    try {
      ({ url } = await storageProvider.save(userId, req.file));
    } catch (error) {
      const status = (error as { status?: number }).status ?? 500;
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : "Unable to save profile photo.";
      console.warn("[worker] profile_photo_storage_failed", {
        route: "/api/worker/profile/photo",
        workerId,
        status,
        message,
      });
      return sendResponse(res, status, { message });
    }

    await prisma.worker.update({
      where: { id: worker.id },
      data: { imageUrl: url },
    });

    if (worker.imageUrl) {
      await storageProvider.delete(publicUploadUrlToFilePath(worker.imageUrl));
    }

    return sendResponse(res, 200, {
      message: "Profile photo updated",
      data: { imageUrl: url, photoUrl: url },
    });
  }

  static async getIncentives(req: Request, res: Response) {
    const workerId = ensureWorkerSelfServiceAuth(
      req,
      res,
      "/api/worker/dashboard/incentives",
    );

    if (!workerId) {
      return;
    }

    const profile = await loadWorkerProfile(workerId);
    const incentiveType = profile?.incentiveType ?? "NONE";
    const incentiveValue = profile?.incentiveValue ?? 0;

    const [salesAgg, invoicesAgg] = await Promise.all([
      getWorkerSelfSalesAgg(workerId, null),
      getWorkerSelfInvoicesAgg(workerId, null),
    ]);

    const totalSales = salesAgg.total + invoicesAgg.total;
    const totalOrders = salesAgg.count + invoicesAgg.count;
    const totalIncentiveEarned = calculateIncentive(
      incentiveType,
      incentiveValue,
      totalSales,
      totalOrders,
    );

    const monthlyBreakdown = await getMonthlyIncentiveData(
      workerId,
      incentiveType,
      incentiveValue,
    );

    return sendResponse(res, 200, {
      data: {
        totalIncentiveEarned,
        incentiveType,
        incentiveValue,
        calculationNote: getIncentiveNote(
          incentiveType,
          incentiveValue,
          totalOrders,
        ),
        monthlyBreakdown,
      } satisfies WorkerIncentiveResponse,
    });
  }

  static async getWorkHistory(req: Request, res: Response) {
    const workerId = ensureWorkerSelfServiceAuth(
      req,
      res,
      "/api/worker/dashboard/history",
    );

    if (!workerId) {
      return;
    }

    const { page, limit, skip } = parsePagination(req.query, {
      defaultLimit: 10,
      maxLimit: 25,
    });

    const startDateResult = parseOptionalDate(req.query.startDate);
    const endDateResult = parseOptionalDate(req.query.endDate, {
      endOfDay: true,
    });
    const minAmountResult = parseOptionalAmount(req.query.minAmount);
    const maxAmountResult = parseOptionalAmount(req.query.maxAmount);
    const search =
      typeof req.query.search === "string" ? req.query.search.trim() : "";

    if (startDateResult.invalid || endDateResult.invalid) {
      return sendResponse(res, 422, {
        message: "Please provide valid start and end dates",
      });
    }

    if (minAmountResult.invalid || maxAmountResult.invalid) {
      return sendResponse(res, 422, {
        message: "Amount filters must be valid positive numbers",
      });
    }

    if (
      startDateResult.value &&
      endDateResult.value &&
      startDateResult.value > endDateResult.value
    ) {
      return sendResponse(res, 422, {
        message: "Start date cannot be after end date",
      });
    }

    if (
      minAmountResult.value !== null &&
      maxAmountResult.value !== null &&
      minAmountResult.value > maxAmountResult.value
    ) {
      return sendResponse(res, 422, {
        message: "Minimum amount cannot be greater than maximum amount",
      });
    }

    const salesFilters = [Prisma.sql`s."worker_id" = ${workerId}`];
    const invoiceFilters = [Prisma.sql`i."worker_id" = ${workerId}`];

    if (startDateResult.value) {
      salesFilters.push(
        Prisma.sql`COALESCE(s."sale_date", s."created_at") >= ${startDateResult.value}`,
      );
      invoiceFilters.push(
        Prisma.sql`COALESCE(i."issue_date", i."created_at") >= ${startDateResult.value}`,
      );
    }

    if (endDateResult.value) {
      salesFilters.push(
        Prisma.sql`COALESCE(s."sale_date", s."created_at") <= ${endDateResult.value}`,
      );
      invoiceFilters.push(
        Prisma.sql`COALESCE(i."issue_date", i."created_at") <= ${endDateResult.value}`,
      );
    }

    if (minAmountResult.value !== null) {
      salesFilters.push(
        Prisma.sql`COALESCE(s."total_amount", s."total") >= ${minAmountResult.value}`,
      );
      invoiceFilters.push(
        Prisma.sql`i."total" >= ${minAmountResult.value}`,
      );
    }

    if (maxAmountResult.value !== null) {
      salesFilters.push(
        Prisma.sql`COALESCE(s."total_amount", s."total") <= ${maxAmountResult.value}`,
      );
      invoiceFilters.push(
        Prisma.sql`i."total" <= ${maxAmountResult.value}`,
      );
    }

    if (search.length > 0) {
      const searchTerm = `%${search}%`;

      salesFilters.push(
        Prisma.sql`COALESCE(c."name", '') ILIKE ${searchTerm}`,
      );
      invoiceFilters.push(
        Prisma.sql`COALESCE(c."name", '') ILIKE ${searchTerm}`,
      );
    }

    const salesWhereClause = combineFilters(salesFilters);
    const invoiceWhereClause = combineFilters(invoiceFilters);

    await ensureWorkerPerformanceSchema();

    const combinedActivityQuery = Prisma.sql`
      SELECT
        CAST(s."id" AS TEXT) AS id,
        'SALE'::TEXT AS type,
        CONCAT('SALE-', s."id") AS reference,
        c."name" AS customer_name,
        COALESCE(s."total_amount", s."total") AS amount,
        CASE
          WHEN s."payment_status" = 'PAID' THEN 'PAID'
          WHEN s."payment_status" = 'PARTIALLY_PAID' THEN 'PARTIALLY_PAID'
          ELSE 'PENDING'
        END AS status,
        COALESCE(s."sale_date", s."created_at") AS activity_date
      FROM "sales" s
      LEFT JOIN "customers" c ON c."id" = s."customer_id"
      ${salesWhereClause}

      UNION ALL

      SELECT
        CAST(i."id" AS TEXT) AS id,
        'INVOICE'::TEXT AS type,
        i."invoice_number" AS reference,
        c."name" AS customer_name,
        i."total" AS amount,
        CASE
          WHEN COALESCE(payment_totals."paid_amount", 0) >= i."total" THEN 'PAID'
          WHEN COALESCE(payment_totals."paid_amount", 0) > 0 THEN 'PARTIALLY_PAID'
          ELSE 'PENDING'
        END AS status,
        COALESCE(i."issue_date", i."created_at") AS activity_date
      FROM "invoices" i
      LEFT JOIN "customers" c ON c."id" = i."customer_id"
      LEFT JOIN (
        SELECT
          p."invoice_id",
          COALESCE(SUM(p."amount"), 0) AS paid_amount
        FROM "payments" p
        GROUP BY p."invoice_id"
      ) AS payment_totals ON payment_totals."invoice_id" = i."id"
      ${invoiceWhereClause}
    `;

    const [historyRows, countRows] = await Promise.all([
      prisma.$queryRaw<
        Array<{
          id: string;
          type: "INVOICE" | "SALE";
          reference: string;
          customer_name: string | null;
          amount: Prisma.Decimal | number;
          status: string;
          activity_date: Date;
        }>
      >(Prisma.sql`
        SELECT *
        FROM (${combinedActivityQuery}) AS activity
        ORDER BY activity."activity_date" DESC, activity."id" DESC
        LIMIT ${limit}
        OFFSET ${skip}
      `),
      prisma.$queryRaw<Array<{ count: bigint | number }>>(Prisma.sql`
        SELECT COUNT(*) AS count
        FROM (${combinedActivityQuery}) AS activity
      `),
    ]);

    const total = Number(countRows[0]?.count ?? 0);
    const totalPages = Math.max(1, getTotalPages(total, limit));

    const entries: WorkerHistoryEntry[] = historyRows.map((row) => ({
      id: row.id,
      type: row.type,
      reference: row.reference,
      customerName: row.customer_name,
      amount: toNumber(row.amount),
      status: row.status,
      date: new Date(row.activity_date).toISOString(),
    }));

    return sendResponse(res, 200, {
      data: {
        entries,
        total,
        page,
        limit,
        totalPages,
      } satisfies WorkerHistoryResponse,
    });
  }
}

export default WorkerPanelController;
