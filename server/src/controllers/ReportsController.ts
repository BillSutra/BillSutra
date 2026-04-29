import type { Request, Response } from "express";
import { sendResponse } from "../utils/sendResponse.js";
import prisma from "../config/db.config.js";
import { Prisma } from "@prisma/client";
import { getCache, setCache } from "../redis/cache.js";
import {
  buildReportsCachePrefix,
  buildReportsSummaryRedisKey,
} from "../redis/cacheKeys.js";
import {
  ensureAnalyticsCoverage,
  sumAnalyticsDailyStatsRange,
} from "../services/analyticsDailyStats.service.js";

class ReportsController {
  static async summary(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const cacheKey = buildReportsSummaryRedisKey(userId);
    const cached = await getCache(cacheKey);
    if (cached) {
      return sendResponse(res, 200, { data: cached });
    }

    const [coverage, products, overdueRows] = await Promise.all([
      ensureAnalyticsCoverage({ userId }),
      prisma.product.findMany({
        where: { user_id: userId },
        select: {
          id: true,
          name: true,
          sku: true,
          stock_on_hand: true,
          reorder_level: true,
        },
      }),
      prisma.$queryRaw<Array<{ total: bigint | number | null }>>(Prisma.sql`
        WITH payment_totals AS (
          SELECT
            "invoice_id",
            COALESCE(SUM("amount"), 0) AS paid_total
          FROM "payments"
          WHERE "user_id" = ${userId}
          GROUP BY "invoice_id"
        )
        SELECT COUNT(*) AS total
        FROM "invoices" AS i
        LEFT JOIN payment_totals AS pt
          ON pt."invoice_id" = i."id"
        WHERE i."user_id" = ${userId}
          AND i."status" NOT IN ('DRAFT'::"InvoiceStatus", 'VOID'::"InvoiceStatus")
          AND i."due_date" IS NOT NULL
          AND i."due_date" < NOW()
          AND GREATEST(
            COALESCE(i."total", 0) - LEAST(COALESCE(pt.paid_total, 0), COALESCE(i."total", 0)),
            0
          ) > 0
      `),
    ]);

    const summaryTotals = coverage
      ? await sumAnalyticsDailyStatsRange({
          userId,
          start: coverage.start,
          endExclusive: coverage.endExclusive,
          refreshIfDirty: false,
        })
      : null;

    const lowStock = products.filter(
      (product) => product.stock_on_hand <= product.reorder_level,
    );

    const data = {
      invoices: summaryTotals?.invoiceCount ?? 0,
      total_billed: summaryTotals?.invoiceBilled ?? 0,
      total_paid: summaryTotals?.invoiceCollections ?? 0,
      sales: summaryTotals?.saleCount ?? 0,
      total_sales: summaryTotals?.bookedSales ?? 0,
      purchases: summaryTotals?.purchaseCount ?? 0,
      total_purchases: summaryTotals?.bookedPurchases ?? 0,
      profit:
        (summaryTotals?.invoiceCollections ?? 0) -
        (summaryTotals?.cashOutPurchases ?? 0),
      overdue: Number(overdueRows[0]?.total ?? 0),
      low_stock: lowStock,
    };

    void setCache(cacheKey, data, 60, {
      invalidationPrefixes: [buildReportsCachePrefix(userId)],
    });

    return sendResponse(res, 200, { data });
  }
}

export default ReportsController;
