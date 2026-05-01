import { Prisma } from "@prisma/client";
import type { Request, Response } from "express";
import prisma from "../config/db.config.js";
import { sendResponse } from "../utils/sendResponse.js";
import { getCache, setCache } from "../redis/cache.js";
import {
  buildAnalyticsCachePrefix,
  buildAnalyticsOverviewRedisKey,
} from "../redis/cacheKeys.js";
import { getAnalyticsDailyStatsRange } from "../services/analyticsDailyStats.service.js";

const toNumber = (value: unknown) => Number(value ?? 0);

const getMonthKey = (date: Date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

const getMonthLabel = (date: Date) =>
  date.toLocaleString("en-US", { month: "short", year: "numeric" });

const getLast12Months = () => {
  const now = new Date();
  const months: { key: string; label: string; start: Date }[] = [];

  for (let offset = 11; offset >= 0; offset -= 1) {
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1),
    );
    months.push({
      key: getMonthKey(start),
      label: getMonthLabel(start),
      start,
    });
  }

  return months;
};

class AnalyticsController {
  static async overview(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const cacheKey = buildAnalyticsOverviewRedisKey(userId);
    const cached = await getCache(cacheKey);
    if (cached) {
      return sendResponse(res, 200, { data: cached });
    }

    const now = new Date();
    const months = getLast12Months();
    const firstMonthStart =
      months[0]?.start ??
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const [monthlyStats, invoiceTotalsRows] = await Promise.all([
      getAnalyticsDailyStatsRange({
        userId,
        start: firstMonthStart,
        endExclusive: new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
        ),
      }),
      prisma.$queryRaw<
        Array<{
          total_revenue: Prisma.Decimal | number | null;
          pending_receivables: Prisma.Decimal | number | null;
          total_sales_transactions: bigint | number | null;
          completed_sales: bigint | number | null;
        }>
      >`
        WITH payment_totals AS (
          SELECT
            "invoice_id",
            COALESCE(SUM("amount"), 0) AS paid_total
          FROM "payments"
          WHERE "user_id" = ${userId}
          GROUP BY "invoice_id"
        )
        SELECT
          COALESCE(SUM(
            LEAST(
              COALESCE(pt.paid_total, CASE WHEN i."status" = 'PAID'::"InvoiceStatus" THEN i."total" ELSE 0 END),
              COALESCE(i."total", 0)
            )
          ), 0) AS total_revenue,
          COALESCE(SUM(
            CASE
              WHEN i."status" IN ('DRAFT'::"InvoiceStatus", 'VOID'::"InvoiceStatus")
                THEN 0
              ELSE GREATEST(
                COALESCE(i."total", 0) - LEAST(
                  COALESCE(pt.paid_total, CASE WHEN i."status" = 'PAID'::"InvoiceStatus" THEN i."total" ELSE 0 END),
                  COALESCE(i."total", 0)
                ),
                0
              )
            END
          ), 0) AS pending_receivables,
          COUNT(*) FILTER (
            WHERE i."status" NOT IN ('DRAFT'::"InvoiceStatus", 'VOID'::"InvoiceStatus")
          ) AS total_sales_transactions,
          COUNT(*) FILTER (
            WHERE LEAST(
              COALESCE(pt.paid_total, CASE WHEN i."status" = 'PAID'::"InvoiceStatus" THEN i."total" ELSE 0 END),
              COALESCE(i."total", 0)
            ) > 0
          ) AS completed_sales
        FROM "invoices" AS i
        LEFT JOIN payment_totals AS pt
          ON pt."invoice_id" = i."id"
        WHERE i."user_id" = ${userId}
      `,
    ]);

    const invoiceTotals = invoiceTotalsRows[0];
    const allTimeRevenue = toNumber(invoiceTotals?.total_revenue ?? 0);
    const pendingReceivables = toNumber(
      invoiceTotals?.pending_receivables ?? 0,
    );
    const totalSalesTransactions = Number(
      invoiceTotals?.total_sales_transactions ?? 0,
    );
    const completedSales = Number(invoiceTotals?.completed_sales ?? 0);

    const monthlyMap = new Map<string, number>(
      months.map((month) => [month.key, 0]),
    );

    // Calculate monthly expenses (PAID + PARTIALLY_PAID portions of purchases)
    const monthlyExpensesMap = new Map<string, number>(
      months.map((month) => [month.key, 0]),
    );

    for (const row of monthlyStats) {
      const key = getMonthKey(row.date);
      if (monthlyMap.has(key)) {
        monthlyMap.set(
          key,
          (monthlyMap.get(key) ?? 0) + row.invoiceCollections,
        );
      }
      if (monthlyExpensesMap.has(key)) {
        monthlyExpensesMap.set(
          key,
          (monthlyExpensesMap.get(key) ?? 0) + row.cashOutPurchases,
        );
      }
    }

    const monthlyRevenue = months.map((month) => {
      const revenue = monthlyMap.get(month.key) ?? 0;
      const expenses = monthlyExpensesMap.get(month.key) ?? 0;
      return {
        month: month.label,
        revenue,
        expenses,
        profit: revenue - expenses,
      };
    });

    const data = {
      totalRevenue: allTimeRevenue,
      pendingReceivables,
      completedSales,
      totalSalesTransactions,
      monthlyRevenue,
    };

    void setCache(cacheKey, data, 60, {
      invalidationPrefixes: [buildAnalyticsCachePrefix(userId)],
    });

    return sendResponse(res, 200, { data });
  }
}

export default AnalyticsController;
