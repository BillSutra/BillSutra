import type { Request, Response } from "express";
import { sendResponse } from "../utils/sendResponse.js";
import prisma from "../config/db.config.js";
import {
  computeInvoicePaymentSnapshotFromPayments,
} from "../utils/invoicePaymentSnapshot.js";
import { getCache, setCache } from "../redis/cache.js";
import { buildReportsSummaryRedisKey } from "../redis/cacheKeys.js";

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

    const now = new Date();
    const [
      invoiceStats,
      paymentsStats,
      purchaseStats,
      saleStats,
      products,
      purchasePayments,
      reportInvoices,
    ] =
      await Promise.all([
        prisma.invoice.aggregate({
          where: { user_id: userId },
          _count: { id: true },
          _sum: { total: true },
        }),
        prisma.payment.aggregate({
          where: { user_id: userId },
          _sum: { amount: true },
        }),
        prisma.purchase.aggregate({
          where: { user_id: userId },
          _count: { id: true },
          _sum: { total: true },
        }),
        prisma.sale.aggregate({
          where: { user_id: userId },
          _count: { id: true },
          _sum: { total: true },
        }),
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
        prisma.purchase.findMany({
          where: { user_id: userId },
          select: {
            total: true,
            totalAmount: true,
            paidAmount: true,
            paymentStatus: true,
          },
        }),
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
      ]);

    const lowStock = products.filter(
      (product) => product.stock_on_hand <= product.reorder_level,
    );

    const overdueCount = reportInvoices.reduce((count, invoice) => {
      const snapshot = computeInvoicePaymentSnapshotFromPayments({
        total: invoice.total,
        status: invoice.status,
        dueDate: invoice.due_date,
        payments: invoice.payments,
        now,
      });

      return snapshot.isOverdue ? count + 1 : count;
    }, 0);

    const totalSales = Number(saleStats._sum.total ?? 0);
    const totalPurchases = Number(purchaseStats._sum.total ?? 0);
    const realizedPurchaseSpend = purchasePayments.reduce((sum, purchase) => {
      const totalAmount = Number(purchase.totalAmount ?? purchase.total ?? 0);
      if (purchase.paymentStatus === "PAID") {
        return sum + Math.max(totalAmount, 0);
      }

      if (purchase.paymentStatus === "PARTIALLY_PAID") {
        return sum + Math.max(Number(purchase.paidAmount ?? 0), 0);
      }

      return sum;
    }, 0);
    const collectedRevenue = Number(paymentsStats._sum.amount ?? 0);

    const data = {
      invoices: invoiceStats._count.id,
      total_billed: invoiceStats._sum.total ?? 0,
      total_paid: paymentsStats._sum.amount ?? 0,
      sales: saleStats._count.id,
      total_sales: totalSales,
      purchases: purchaseStats._count.id,
      total_purchases: totalPurchases,
      profit: collectedRevenue - realizedPurchaseSpend,
      overdue: overdueCount,
      low_stock: lowStock,
    };

    void setCache(cacheKey, data, 60);

    return sendResponse(res, 200, { data });
  }
}

export default ReportsController;
