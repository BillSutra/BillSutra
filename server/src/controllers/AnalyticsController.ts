import type { Request, Response } from "express";
import prisma from "../config/db.config.js";
import { sendResponse } from "../utils/sendResponse.js";
import {
  computeInvoicePaymentSnapshotFromPayments,
} from "../utils/invoicePaymentSnapshot.js";
import { getCache, setCache } from "../redis/cache.js";
import { buildAnalyticsOverviewRedisKey } from "../redis/cacheKeys.js";

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

    const [
      invoices,
      paymentsInLast12Months,
      purchasesInLast12Months,
    ] = await Promise.all([
      prisma.invoice.findMany({
        where: { user_id: userId },
        select: {
          total: true,
          status: true,
          due_date: true,
          payments: {
            select: {
              amount: true,
            },
          },
        },
      }),
      prisma.payment.findMany({
        where: {
          user_id: userId,
          paid_at: { gte: firstMonthStart },
        },
        select: {
          paid_at: true,
          amount: true,
        },
      }),
      prisma.purchase.findMany({
        where: {
          user_id: userId,
          purchase_date: { gte: firstMonthStart },
        },
        select: {
          purchase_date: true,
          totalAmount: true,
          paymentStatus: true,
          paidAmount: true,
        },
      }),
    ]);

    const invoiceSnapshots = invoices.map((invoice) =>
      computeInvoicePaymentSnapshotFromPayments({
        total: invoice.total,
        status: invoice.status,
        dueDate: invoice.due_date,
        payments: invoice.payments,
      }),
    );

    const allTimeRevenue = invoiceSnapshots.reduce(
      (sum, invoice) => sum + invoice.paidAmount,
      0,
    );
    const pendingReceivables = invoiceSnapshots.reduce(
      (sum, invoice) => sum + invoice.pendingAmount,
      0,
    );

    const totalSalesTransactions = invoiceSnapshots.filter(
      (invoice) => invoice.isCollectible,
    ).length;
    const completedSales = invoiceSnapshots.filter(
      (invoice) => invoice.paymentStatus !== "UNPAID",
    ).length;

    const monthlyMap = new Map<string, number>(
      months.map((month) => [month.key, 0]),
    );

    for (const payment of paymentsInLast12Months) {
      const key = getMonthKey(payment.paid_at);
      if (monthlyMap.has(key)) {
        monthlyMap.set(
          key,
          (monthlyMap.get(key) ?? 0) + toNumber(payment.amount),
        );
      }
    }

    // Calculate monthly expenses (PAID + PARTIALLY_PAID portions of purchases)
    const monthlyExpensesMap = new Map<string, number>(
      months.map((month) => [month.key, 0]),
    );

    for (const purchase of purchasesInLast12Months) {
      const key = getMonthKey(purchase.purchase_date);
      if (monthlyExpensesMap.has(key)) {
        let expense = 0;
        if (purchase.paymentStatus === "PAID") {
          expense = toNumber(purchase.totalAmount);
        } else if (purchase.paymentStatus === "PARTIALLY_PAID") {
          expense = toNumber(purchase.paidAmount);
        }
        monthlyExpensesMap.set(key, (monthlyExpensesMap.get(key) ?? 0) + expense);
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

    void setCache(cacheKey, data, 60);

    return sendResponse(res, 200, { data });
  }
}

export default AnalyticsController;
