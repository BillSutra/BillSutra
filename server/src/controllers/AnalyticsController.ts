import type { Request, Response } from "express";
import prisma from "../config/db.config.js";
import { sendResponse } from "../utils/sendResponse.js";

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

    const now = new Date();
    const months = getLast12Months();
    const firstMonthStart =
      months[0]?.start ??
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    // Fetch all necessary data for sales and purchases based on payment status
    const [
      paidSalesAgg,
      partiallyPaidSalesAgg,
      unpaidSalesAgg,
      paidSalesCount,
      partiallyPaidSalesCount,
      unpaidSalesCount,
      paidSalesInLast12Months,
      partiallyPaidSalesInLast12Months,
      purchasesInLast12Months,
    ] = await Promise.all([
      // PAID sales: count 100% of totalAmount
      prisma.sale.aggregate({
        where: {
          user_id: userId,
          paymentStatus: "PAID",
        },
        _sum: { totalAmount: true },
      }),
      // PARTIALLY_PAID sales: count only paidAmount
      prisma.sale.aggregate({
        where: {
          user_id: userId,
          paymentStatus: "PARTIALLY_PAID",
        },
        _sum: { paidAmount: true },
      }),
      // UNPAID sales: for pending receivables calculation
      prisma.sale.aggregate({
        where: {
          user_id: userId,
          paymentStatus: "UNPAID",
        },
        _sum: { totalAmount: true },
      }),
      prisma.sale.count({
        where: {
          user_id: userId,
          paymentStatus: "PAID",
        },
      }),
      prisma.sale.count({
        where: {
          user_id: userId,
          paymentStatus: "PARTIALLY_PAID",
        },
      }),
      prisma.sale.count({
        where: {
          user_id: userId,
          paymentStatus: "UNPAID",
        },
      }),
      // PAID sales in last 12 months
      prisma.sale.findMany({
        where: {
          user_id: userId,
          paymentStatus: "PAID",
          sale_date: { gte: firstMonthStart },
        },
        select: {
          sale_date: true,
          totalAmount: true,
        },
      }),
      // PARTIALLY_PAID sales in last 12 months (count only paid portion)
      prisma.sale.findMany({
        where: {
          user_id: userId,
          paymentStatus: "PARTIALLY_PAID",
          sale_date: { gte: firstMonthStart },
        },
        select: {
          sale_date: true,
          paidAmount: true,
        },
      }),
      // All purchases in last 12 months for expenses
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

    // Calculate total realized revenue (PAID + PARTIALLY_PAID portions)
    const paidRevenue = toNumber(paidSalesAgg._sum.totalAmount);
    const partiallyPaidRevenue = toNumber(partiallyPaidSalesAgg._sum.paidAmount);
    const totalRevenue = paidRevenue + partiallyPaidRevenue;

    // Calculate pending receivables (unpaid portions)
    const pendingReceivables = toNumber(unpaidSalesAgg._sum.totalAmount);

    // Total sales metrics
    const totalSalesTransactions = paidSalesCount + partiallyPaidSalesCount + unpaidSalesCount;
    const completedSales = paidSalesCount + partiallyPaidSalesCount;

    // Build monthly revenue map
    const monthlyMap = new Map<string, number>(
      months.map((month) => [month.key, 0]),
    );

    // Add PAID sales
    for (const sale of paidSalesInLast12Months) {
      const key = getMonthKey(sale.sale_date);
      if (monthlyMap.has(key)) {
        monthlyMap.set(
          key,
          (monthlyMap.get(key) ?? 0) + toNumber(sale.totalAmount),
        );
      }
    }

    // Add PARTIALLY_PAID sales (only paid portion)
    for (const sale of partiallyPaidSalesInLast12Months) {
      const key = getMonthKey(sale.sale_date);
      if (monthlyMap.has(key)) {
        monthlyMap.set(
          key,
          (monthlyMap.get(key) ?? 0) + toNumber(sale.paidAmount),
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

    return sendResponse(res, 200, {
      data: {
        totalRevenue,
        pendingReceivables,
        completedSales,
        totalSalesTransactions,
        monthlyRevenue,
      },
    });
  }
}

export default AnalyticsController;
