import { Prisma, InvoiceStatus } from "@prisma/client";
import prisma from "../../config/db.config.js";

type PeriodType = "weekly" | "monthly" | "yearly";

type HistoricalDataPoint = {
    date: string;
    revenue: number;
};

type ForecastDataPoint = {
    date: string;
    predicted_revenue: number;
};

type ForecastResult = {
    historical: HistoricalDataPoint[];
    forecast: ForecastDataPoint[];
    period: PeriodType;
};

const toNumber = (value: unknown) => Number(value ?? 0);

/**
 * Get date range based on period
 */
const getDateRange = (period: PeriodType): { from: Date; to: Date } => {
    const now = new Date();
    // Create from date with UTC to avoid timezone issues
    const from = new Date(now);

    switch (period) {
        case "weekly":
            // Last 30 days for weekly
            from.setUTCDate(from.getUTCDate() - 30);
            break;
        case "monthly":
            // Last 6 months
            from.setUTCMonth(from.getUTCMonth() - 6);
            break;
        case "yearly":
            // Last 3 years
            from.setUTCFullYear(from.getUTCFullYear() - 3);
            break;
    }

    // Include through end of tomorrow to ensure all today's data is captured
    // regardless of timezone differences between server and user
    const to = new Date(now);
    to.setUTCDate(to.getUTCDate() + 1);
    to.setUTCHours(23, 59, 59, 999);

    return { from, to };
};

/**
 * Format date based on period granularity
 */
const formatDateKey = (date: Date, period: PeriodType): string => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const dayOfMonth = String(date.getUTCDate()).padStart(2, "0");

    switch (period) {
        case "weekly":
            return `${year}-${month}-${dayOfMonth}`;
        case "monthly":
            return `${year}-${month}`;
        case "yearly":
            return `${year}`;
    }
};

/**
 * Get display label for date based on period
 */
const getDateLabel = (dateStr: string, period: PeriodType): string => {
    const parts = dateStr.split("-").map(Number);

    switch (period) {
        case "weekly": {
            const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
            return date.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
            });
        }
        case "monthly": {
            const date = new Date(Date.UTC(parts[0], parts[1] - 1, 1));
            return date.toLocaleDateString("en-US", {
                month: "short",
                year: "numeric",
            });
        }
        case "yearly": {
            return dateStr;
        }
    }
};

/**
 * Get next date based on period
 */
const getNextDate = (dateStr: string, period: PeriodType): string => {
    const parts = dateStr.split("-").map(Number);

    // Handle yearly format (just year: "2026")
    // Handle monthly format (year-month: "2026-03")
    // Handle weekly format (year-month-day: "2026-03-12")
    const year = parts[0];
    const month = parts[1] ?? 1;  // Default to January if not provided
    const day = parts[2] ?? 1;    // Default to 1st if not provided

    const date = new Date(Date.UTC(year, month - 1, day));

    switch (period) {
        case "weekly":
            date.setUTCDate(date.getUTCDate() + 1);
            break;
        case "monthly":
            date.setUTCMonth(date.getUTCMonth() + 1);
            break;
        case "yearly":
            date.setUTCFullYear(date.getUTCFullYear() + 1);
            break;
    }

    return formatDateKey(date, period);
};

/**
 * Calculate rolling average for smoothing
 */
const calculateRollingAverage = (
    values: number[],
    windowSize: number = 3,
): number[] => {
    if (values.length === 0) return [];

    const averages: number[] = [];
    const window = Math.min(windowSize, values.length);

    for (let i = 0; i < values.length; i++) {
        const start = Math.max(0, i - window + 1);
        const slice = values.slice(start, i + 1);
        const average = slice.reduce((sum, val) => sum + val, 0) / slice.length;
        averages.push(average);
    }

    return averages;
};

/**
 * Forecast future values using simple moving average
 */
const forecastValues = (
    historical: number[],
    periods: number,
): number[] => {
    if (historical.length === 0) {
        return Array(periods).fill(0);
    }

    const predictions: number[] = [];
    const windowSize = Math.min(7, Math.max(2, Math.ceil(historical.length / 3)));

    // Get rolling average of historical data
    const rollingAverages = calculateRollingAverage(historical, windowSize);
    const lastAverage = rollingAverages[rollingAverages.length - 1] || 0;

    console.log(`[FORECAST] Window size: ${windowSize}, Last average: ${lastAverage}`);

    // If last average is 0 and we have no data, just return zeros
    if (lastAverage === 0 && historical.every((v) => v === 0)) {
        console.log("[FORECAST] All historical values are 0, predicting zeros");
        return Array(periods).fill(0);
    }

    // Generate predictions based on last average
    for (let i = 0; i < periods; i++) {
        // Add slight variation to avoid flat predictions
        const variation = lastAverage * 0.05 * Math.sin((i + 1) * 0.3);
        const predicted = Math.max(0, lastAverage + variation);
        predictions.push(Math.round(predicted * 100) / 100);
    }

    return predictions;
};

/**
 * Aggregate revenue based on period and payment status
 * PAID sales: count 100% of total
 * PARTIALLY_PAID sales: count only the paid portion (paid_amount)
 * UNPAID sales: not counted as realized revenue
 */
const aggregateRevenue = (
    sales: Array<{
        sale_date: Date;
        totalAmount: Prisma.Decimal;
        paidAmount: Prisma.Decimal;
        paymentStatus: string;
    }>,
    period: PeriodType,
): Map<string, number> => {
    const aggregated = new Map<string, number>();

    sales.forEach((sale) => {
        const key = formatDateKey(sale.sale_date, period);
        const current = aggregated.get(key) ?? 0;

        // Calculate realized revenue based on payment status
        let realizedRevenue = 0;
        if (sale.paymentStatus === "PAID") {
            realizedRevenue = toNumber(sale.totalAmount);
        } else if (sale.paymentStatus === "PARTIALLY_PAID") {
            // Only count the paid portion
            realizedRevenue = toNumber(sale.paidAmount);
        }
        // UNPAID sales are not counted as realized revenue

        aggregated.set(key, current + realizedRevenue);
    });

    return aggregated;
};

/**
 * Build continuous date series for the period
 */
const buildDateSeries = (
    from: Date,
    to: Date,
    period: PeriodType,
): string[] => {
    const series: string[] = [];
    // Start from the beginning of the period
    const current = new Date(from);

    // Set to start of period
    current.setUTCHours(0, 0, 0, 0);

    while (current <= to) {
        const key = formatDateKey(current, period);
        // Only add if not already in series (avoid duplicates)
        if (!series.includes(key)) {
            series.push(key);
        }

        switch (period) {
            case "weekly":
                current.setUTCDate(current.getUTCDate() + 1);
                break;
            case "monthly":
                current.setUTCMonth(current.getUTCMonth() + 1);
                break;
            case "yearly":
                current.setUTCFullYear(current.getUTCFullYear() + 1);
                break;
        }
    }

    return series;
};

/**
 * Get number of future periods to forecast
 */
const getForecastPeriods = (period: PeriodType): number => {
    switch (period) {
        case "weekly":
            return 7;
        case "monthly":
            return 6;
        case "yearly":
            return 12;
    }
};

/**
 * Main forecasting service
 * Uses Sales data based on payment status
 * PAID sales: count 100% of amount
 * PARTIALLY_PAID sales: count only paid portion
 * UNPAID sales: excluded from realized revenue
 */
export const getSalesForecast = async (
    userId: number,
    period: PeriodType = "monthly",
): Promise<ForecastResult> => {
    // Get date range
    const { from, to } = getDateRange(period);

    console.log(`[FORECAST] Fetching sales for user ${userId}, period: ${period}`);
    console.log(`[FORECAST] Date range: ${from.toISOString()} to ${to.toISOString()}`);

    // Fetch sales with PAID and PARTIALLY_PAID status only
    // These represent realized revenue
    const sales = await prisma.sale.findMany({
        where: {
            user_id: userId,
            sale_date: {
                gte: from,
                lte: to,
            },
            paymentStatus: {
                in: ["PAID", "PARTIALLY_PAID"],
            },
        },
        select: {
            sale_date: true,
            totalAmount: true,
            paidAmount: true,
            paymentStatus: true,
            id: true,
        },
        orderBy: { sale_date: "asc" },
    });

    console.log(`[FORECAST] Found ${sales.length} sales with PAID/PARTIALLY_PAID status`);
    sales.slice(0, 5).forEach((sale) => {
        const realized = sale.paymentStatus === "PAID"
            ? toNumber(sale.totalAmount)
            : toNumber(sale.paidAmount);
        console.log(`[FORECAST] Sale ${sale.id}: ${sale.sale_date} - ${sale.totalAmount} (${sale.paymentStatus}, realized: ${realized})`);
    });

    // Aggregate revenue by period
    const aggregated = aggregateRevenue(sales, period);

    console.log(`[FORECAST] Aggregated data: ${aggregated.size} periods`);

    // Build continuous date series
    const dateSeries = buildDateSeries(from, to, period);

    console.log(`[FORECAST] Date series length: ${dateSeries.length}`);

    // Build historical data with all dates (including zeros)
    const historical: HistoricalDataPoint[] = dateSeries.map((dateStr) => ({
        date: getDateLabel(dateStr, period),
        revenue: aggregated.get(dateStr) ?? 0,
    }));

    console.log(`[FORECAST] Historical data points: ${historical.length}`);
    console.log(`[FORECAST] First entry: ${historical[0]?.date} = ${historical[0]?.revenue}`);
    console.log(`[FORECAST] Last entry: ${historical[historical.length - 1]?.date} = ${historical[historical.length - 1]?.revenue}`);

    // Extract revenue values for forecasting
    const revenueValues = dateSeries.map((dateStr) => aggregated.get(dateStr) ?? 0);

    console.log(`[FORECAST] Revenue values (first 5): ${revenueValues.slice(0, 5)}`);
    console.log(`[FORECAST] Sum of all revenue: ${revenueValues.reduce((a, b) => a + b, 0)}`);

    // Generate forecasts
    const forecastPeriods = getForecastPeriods(period);
    const predictions = forecastValues(revenueValues, forecastPeriods);

    console.log(`[FORECAST] Predictions (first 3): ${predictions.slice(0, 3)}`);

    // Build forecast data points
    const forecast: ForecastDataPoint[] = (() => {
        let lastDateStr = dateSeries[dateSeries.length - 1];

        return predictions.map((predicted_revenue) => {
            lastDateStr = getNextDate(lastDateStr, period);
            return {
                date: getDateLabel(lastDateStr, period),
                predicted_revenue,
            };
        });
    })();

    console.log(`[FORECAST] Forecast complete: ${historical.length} historical, ${forecast.length} predicted`);

    return {
        historical,
        forecast,
        period,
    };
};
