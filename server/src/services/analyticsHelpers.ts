import { Prisma } from "@prisma/client";
import prisma from "../config/db.config.js";

const toNumber = (value: unknown) => Number(value ?? 0);

/**
 * Helper functions for analytics calculations based on Sales and Purchases
 * with proper payment status handling
 */

export interface RevenueMetrics {
    totalRevenue: number;
    paidRevenue: number;
    partiallyPaidRevenue: number;
    pendingReceivables: number;
    completedTransactions: number;
    pendingTransactions: number;
}

export interface ExpenseMetrics {
    totalExpenses: number;
    paidExpenses: number;
    partiallyPaidExpenses: number;
    pendingPayables: number;
    settledTransactions: number;
    pendingTransactions: number;
}

export interface ProfitMetrics {
    realizedRevenue: number;
    realizedExpenses: number;
    realizedProfit: number;
    pendingReceivables: number;
    pendingPayables: number;
}

/**
 * Calculate revenue metrics from Sales data
 * PAID: count 100% of totalAmount
 * PARTIALLY_PAID: count only paidAmount (rest is receivable)
 * UNPAID: not counted as realized revenue
 */
export const calculateRevenueMetrics = async (
    userId: number,
    from?: Date,
    to?: Date,
): Promise<RevenueMetrics> => {
    // Aggregate PAID sales
    const paidSalesAgg = await prisma.sale.aggregate({
        where: {
            user_id: userId,
            paymentStatus: "PAID",
            ...(from && to && { sale_date: { gte: from, lt: to } }),
            ...(!from && !to && {}),
        },
        _sum: { totalAmount: true },
    });

    // Aggregate PARTIALLY_PAID sales (only paid portion counts)
    const partiallyPaidSalesAgg = await prisma.sale.aggregate({
        where: {
            user_id: userId,
            paymentStatus: "PARTIALLY_PAID",
            ...(from && to && { sale_date: { gte: from, lt: to } }),
        },
        _sum: { paidAmount: true },
    });

    // Count pending receivables (unpaid portions)
    const unpaidSalesAgg = await prisma.sale.aggregate({
        where: {
            user_id: userId,
            paymentStatus: { in: ["PARTIALLY_PAID", "UNPAID"] },
            ...(from && to && { sale_date: { gte: from, lt: to } }),
        },
        _sum: { pendingAmount: true },
    });

    const paidCount = await prisma.sale.count({
        where: {
            user_id: userId,
            paymentStatus: "PAID",
            ...(from && to && { sale_date: { gte: from, lt: to } }),
        },
    });

    const partiallyPaidCount = await prisma.sale.count({
        where: {
            user_id: userId,
            paymentStatus: "PARTIALLY_PAID",
            ...(from && to && { sale_date: { gte: from, lt: to } }),
        },
    });

    const unpaidCount = await prisma.sale.count({
        where: {
            user_id: userId,
            paymentStatus: "UNPAID",
            ...(from && to && { sale_date: { gte: from, lt: to } }),
        },
    });

    const paidRevenue = toNumber(paidSalesAgg._sum.totalAmount);
    const partiallyPaidRevenue = toNumber(partiallyPaidSalesAgg._sum.paidAmount);
    const totalRevenue = paidRevenue + partiallyPaidRevenue;
    const pendingReceivables = toNumber(unpaidSalesAgg._sum.pendingAmount);

    return {
        totalRevenue,
        paidRevenue,
        partiallyPaidRevenue,
        pendingReceivables,
        completedTransactions: paidCount + partiallyPaidCount,
        pendingTransactions: unpaidCount,
    };
};

/**
 * Calculate expense metrics from Purchases data
 * PAID: count 100% of totalAmount
 * PARTIALLY_PAID: count only paidAmount (rest is payable)
 * UNPAID: not counted as realized expense
 */
export const calculateExpenseMetrics = async (
    userId: number,
    from?: Date,
    to?: Date,
): Promise<ExpenseMetrics> => {
    // Aggregate PAID purchases
    const paidPurchasesAgg = await prisma.purchase.aggregate({
        where: {
            user_id: userId,
            paymentStatus: "PAID",
            ...(from && to && { purchase_date: { gte: from, lt: to } }),
        },
        _sum: { totalAmount: true },
    });

    // Aggregate PARTIALLY_PAID purchases (only paid portion counts)
    const partiallyPaidPurchasesAgg = await prisma.purchase.aggregate({
        where: {
            user_id: userId,
            paymentStatus: "PARTIALLY_PAID",
            ...(from && to && { purchase_date: { gte: from, lt: to } }),
        },
        _sum: { paidAmount: true },
    });

    // Count pending payables
    const unpaidPurchasesAgg = await prisma.purchase.aggregate({
        where: {
            user_id: userId,
            paymentStatus: { in: ["PARTIALLY_PAID", "UNPAID"] },
            ...(from && to && { purchase_date: { gte: from, lt: to } }),
        },
        _sum: { pendingAmount: true },
    });

    const paidCount = await prisma.purchase.count({
        where: {
            user_id: userId,
            paymentStatus: "PAID",
            ...(from && to && { purchase_date: { gte: from, lt: to } }),
        },
    });

    const partiallyPaidCount = await prisma.purchase.count({
        where: {
            user_id: userId,
            paymentStatus: "PARTIALLY_PAID",
            ...(from && to && { purchase_date: { gte: from, lt: to } }),
        },
    });

    const unpaidCount = await prisma.purchase.count({
        where: {
            user_id: userId,
            paymentStatus: "UNPAID",
            ...(from && to && { purchase_date: { gte: from, lt: to } }),
        },
    });

    const paidExpenses = toNumber(paidPurchasesAgg._sum.totalAmount);
    const partiallyPaidExpenses = toNumber(
        partiallyPaidPurchasesAgg._sum.paidAmount,
    );
    const totalExpenses = paidExpenses + partiallyPaidExpenses;
    const pendingPayables = toNumber(unpaidPurchasesAgg._sum.pendingAmount);

    return {
        totalExpenses,
        paidExpenses,
        partiallyPaidExpenses,
        pendingPayables,
        settledTransactions: paidCount + partiallyPaidCount,
        pendingTransactions: unpaidCount,
    };
};

/**
 * Calculate profit metrics combining Sales and Purchases
 */
export const calculateProfitMetrics = async (
    userId: number,
    from?: Date,
    to?: Date,
): Promise<ProfitMetrics> => {
    const revenue = await calculateRevenueMetrics(userId, from, to);
    const expenses = await calculateExpenseMetrics(userId, from, to);

    return {
        realizedRevenue: revenue.totalRevenue,
        realizedExpenses: expenses.totalExpenses,
        realizedProfit: revenue.totalRevenue - expenses.totalExpenses,
        pendingReceivables: revenue.pendingReceivables,
        pendingPayables: expenses.pendingPayables,
    };
};

/**
 * Get period-based revenue breakdown
 */
export const getRevenuePeriods = async (
    userId: number,
    periods: Array<{ label: string; from: Date; to: Date }>,
): Promise<Array<{ period: string; revenue: number }>> => {
    const results = [];

    for (const p of periods) {
        const metrics = await calculateRevenueMetrics(userId, p.from, p.to);
        results.push({
            period: p.label,
            revenue: metrics.totalRevenue,
        });
    }

    return results;
};

/**
 * Get expense breakdown by period
 */
export const getExpensePeriods = async (
    userId: number,
    periods: Array<{ label: string; from: Date; to: Date }>,
): Promise<Array<{ period: string; expenses: number }>> => {
    const results = [];

    for (const p of periods) {
        const metrics = await calculateExpenseMetrics(userId, p.from, p.to);
        results.push({
            period: p.label,
            expenses: metrics.totalExpenses,
        });
    }

    return results;
};

/**
 * Get category-wise revenue from sales items
 */
export const getCategoryRevenue = async (
    userId: number,
    limit = 10,
): Promise<Array<{ category: string; revenue: number; transactionCount: number }>> => {
    const results = await prisma.$queryRaw<
        Array<{
            category: string | null;
            revenue: Prisma.Decimal;
            count: BigInt;
        }>
    >`
    SELECT 
      c.name as category,
      COALESCE(SUM(
        CASE 
          WHEN s.payment_status = 'PAID' THEN si.line_total
          WHEN s.payment_status = 'PARTIALLY_PAID' THEN (si.line_total * s.paid_amount / s.total_amount)
          ELSE 0
        END
      ), 0) as revenue,
      COUNT(DISTINCT s.id) as count
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    LEFT JOIN products p ON si.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE s.user_id = ${userId}
      AND s.payment_status IN ('PAID', 'PARTIALLY_PAID')
    GROUP BY c.id, c.name
    ORDER BY revenue DESC
    LIMIT ${limit}
  `;

    return results.map((row) => ({
        category: row.category ?? "Uncategorized",
        revenue: toNumber(row.revenue),
        transactionCount: Number(row.count),
    }));
};

/**
 * Get top customers by revenue
 */
export const getTopCustomers = async (
    userId: number,
    limit = 10,
): Promise<Array<{ customer: string; revenue: number; count: number }>> => {
    const results = await prisma.$queryRaw<
        Array<{
            customer: string | null;
            revenue: Prisma.Decimal;
            count: BigInt;
        }>
    >`
    SELECT 
      c.name as customer,
      COALESCE(SUM(
        CASE 
          WHEN s.payment_status = 'PAID' THEN s.total_amount
          WHEN s.payment_status = 'PARTIALLY_PAID' THEN s.paid_amount
          ELSE 0
        END
      ), 0) as revenue,
      COUNT(s.id) as count
    FROM sales s
    LEFT JOIN customers c ON s.customer_id = c.id
    WHERE s.user_id = ${userId}
      AND s.payment_status IN ('PAID', 'PARTIALLY_PAID')
    GROUP BY c.id, c.name
    ORDER BY revenue DESC
    LIMIT ${limit}
  `;

    return results.map((row) => ({
        customer: row.customer ?? "Walk-in Customer",
        revenue: toNumber(row.revenue),
        count: Number(row.count),
    }));
};

/**
 * Get top suppliers by spending
 */
export const getTopSuppliers = async (
    userId: number,
    limit = 10,
): Promise<Array<{ supplier: string; expenses: number; count: number; pending: number }>> => {
    const results = await prisma.$queryRaw<
        Array<{
            supplier: string | null;
            expenses: Prisma.Decimal;
            count: BigInt;
            pending: Prisma.Decimal;
        }>
    >`
    SELECT 
      s.name as supplier,
      COALESCE(SUM(
        CASE 
          WHEN p.payment_status = 'PAID' THEN p.total_amount
          WHEN p.payment_status = 'PARTIALLY_PAID' THEN p.paid_amount
          ELSE 0
        END
      ), 0) as expenses,
      COUNT(p.id) as count,
      COALESCE(SUM(p.pending_amount), 0) as pending
    FROM purchases p
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    WHERE p.user_id = ${userId}
    GROUP BY s.id, s.name
    ORDER BY expenses DESC
    LIMIT ${limit}
  `;

    return results.map((row) => ({
        supplier: row.supplier ?? "Unknown Supplier",
        expenses: toNumber(row.expenses),
        count: Number(row.count),
        pending: toNumber(row.pending),
    }));
};

/**
 * Get pending receivables detailed list
 */
export const getPendingReceivables = async (
    userId: number,
    limit = 20,
): Promise<
    Array<{
        saleId: number;
        customer: string;
        totalAmount: number;
        paidAmount: number;
        pendingAmount: number;
        saleDate: Date;
    }>
> => {
    const sales = await prisma.sale.findMany({
        where: {
            user_id: userId,
            paymentStatus: { in: ["PARTIALLY_PAID", "UNPAID"] },
        },
        select: {
            id: true,
            totalAmount: true,
            paidAmount: true,
            pendingAmount: true,
            sale_date: true,
            customer: { select: { name: true } },
        },
        orderBy: { sale_date: "desc" },
        take: limit,
    });

    return sales.map((sale) => ({
        saleId: sale.id,
        customer: sale.customer?.name ?? "Walk-in",
        totalAmount: toNumber(sale.totalAmount),
        paidAmount: toNumber(sale.paidAmount),
        pendingAmount: toNumber(sale.pendingAmount),
        saleDate: sale.sale_date,
    }));
};

/**
 * Get pending payables detailed list
 */
export const getPendingPayables = async (
    userId: number,
    limit = 20,
): Promise<
    Array<{
        purchaseId: number;
        supplier: string;
        totalAmount: number;
        paidAmount: number;
        pendingAmount: number;
        purchaseDate: Date;
    }>
> => {
    const purchases = await prisma.purchase.findMany({
        where: {
            user_id: userId,
            paymentStatus: { in: ["PARTIALLY_PAID", "UNPAID"] },
        },
        select: {
            id: true,
            totalAmount: true,
            paidAmount: true,
            pendingAmount: true,
            purchase_date: true,
            supplier: { select: { name: true } },
        },
        orderBy: { purchase_date: "desc" },
        take: limit,
    });

    return purchases.map((purchase) => ({
        purchaseId: purchase.id,
        supplier: purchase.supplier?.name ?? "Unknown",
        totalAmount: toNumber(purchase.totalAmount),
        paidAmount: toNumber(purchase.paidAmount),
        pendingAmount: toNumber(purchase.pendingAmount),
        purchaseDate: purchase.purchase_date,
    }));
};

/**
 * Cashflow analysis combining inflows (sales) and outflows (purchases)
 */
export const getCashFlowAnalysis = async (
    userId: number,
    from: Date,
    to: Date,
): Promise<{
    totalInflows: number;
    totalOutflows: number;
    netCashFlow: number;
    dailyBreakdown: Array<{
        date: string;
        inflow: number;
        outflow: number;
        netFlow: number;
    }>;
}> => {
    const inflows = await prisma.sale.findMany({
        where: {
            user_id: userId,
            paymentStatus: { in: ["PAID", "PARTIALLY_PAID"] },
            sale_date: { gte: from, lt: to },
        },
        select: {
            sale_date: true,
            totalAmount: true,
            paidAmount: true,
            paymentStatus: true,
        },
    });

    const outflows = await prisma.purchase.findMany({
        where: {
            user_id: userId,
            paymentStatus: { in: ["PAID", "PARTIALLY_PAID"] },
            purchase_date: { gte: from, lt: to },
        },
        select: {
            purchase_date: true,
            totalAmount: true,
            paidAmount: true,
            paymentStatus: true,
        },
    });

    const dailyMap = new Map<
        string,
        { inflow: number; outflow: number }
    >();

    // Process inflows
    inflows.forEach((sale) => {
        const dateKey = sale.sale_date.toISOString().slice(0, 10);
        const realized =
            sale.paymentStatus === "PAID"
                ? toNumber(sale.totalAmount)
                : toNumber(sale.paidAmount);

        const entry = dailyMap.get(dateKey) ?? { inflow: 0, outflow: 0 };
        entry.inflow += realized;
        dailyMap.set(dateKey, entry);
    });

    // Process outflows
    outflows.forEach((purchase) => {
        const dateKey = purchase.purchase_date.toISOString().slice(0, 10);
        const realized =
            purchase.paymentStatus === "PAID"
                ? toNumber(purchase.totalAmount)
                : toNumber(purchase.paidAmount);

        const entry = dailyMap.get(dateKey) ?? { inflow: 0, outflow: 0 };
        entry.outflow += realized;
        dailyMap.set(dateKey, entry);
    });

    const dailyBreakdown = Array.from(dailyMap.entries())
        .map(([date, { inflow, outflow }]) => ({
            date,
            inflow,
            outflow,
            netFlow: inflow - outflow,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

    const totalInflows = dailyBreakdown.reduce((sum, d) => sum + d.inflow, 0);
    const totalOutflows = dailyBreakdown.reduce(
        (sum, d) => sum + d.outflow,
        0,
    );

    return {
        totalInflows,
        totalOutflows,
        netCashFlow: totalInflows - totalOutflows,
        dailyBreakdown,
    };
};
