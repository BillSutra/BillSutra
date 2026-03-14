import type { Request, Response } from "express";
import { sendResponse } from "../utils/sendResponse.js";
import prisma from "../config/db.config.js";
import { InvoiceStatus } from "@prisma/client";

class ReportsController {
  static async summary(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const [invoiceStats, paymentsStats, purchaseStats, saleStats, products] =
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
      ]);

    const lowStock = products.filter(
      (product) => product.stock_on_hand <= product.reorder_level,
    );

    const overdueCount = await prisma.invoice.count({
      where: { user_id: userId, status: InvoiceStatus.OVERDUE },
    });

    const totalSales = Number(saleStats._sum.total ?? 0);
    const totalPurchases = Number(purchaseStats._sum.total ?? 0);

    return sendResponse(res, 200, {
      data: {
        invoices: invoiceStats._count.id,
        total_billed: invoiceStats._sum.total ?? 0,
        total_paid: paymentsStats._sum.amount ?? 0,
        sales: saleStats._count.id,
        total_sales: totalSales,
        purchases: purchaseStats._count.id,
        total_purchases: totalPurchases,
        profit: totalSales - totalPurchases,
        overdue: overdueCount,
        low_stock: lowStock,
      },
    });
  }
}

export default ReportsController;
