import cron from "node-cron";
import {
  InvoiceStatus,
  RecurrenceFrequency,
  type Prisma,
} from "@prisma/client";
import prisma from "../config/db.config.js";
import {
  calculateTotals,
  type InvoiceCalcItem,
} from "../utils/calculateTotals.js";
import { generateInvoiceNumber } from "../utils/generateInvoiceNumber.js";

const isInvoiceItemArray = (value: unknown): value is InvoiceCalcItem[] => {
  if (!Array.isArray(value)) {
    return false;
  }

  return value.every((item) => {
    if (!item || typeof item !== "object") {
      return false;
    }

    const record = item as Record<string, unknown>;
    return (
      typeof record.name === "string" &&
      typeof record.quantity === "number" &&
      typeof record.price === "number"
    );
  });
};

const addFrequency = (
  date: Date,
  frequency: RecurrenceFrequency,
  intervalCount: number,
) => {
  const safeInterval = Math.max(1, intervalCount);
  const next = new Date(date);

  switch (frequency) {
    case RecurrenceFrequency.DAILY:
      next.setDate(next.getDate() + safeInterval);
      break;
    case RecurrenceFrequency.WEEKLY:
      next.setDate(next.getDate() + safeInterval * 7);
      break;
    case RecurrenceFrequency.MONTHLY:
      next.setMonth(next.getMonth() + safeInterval);
      break;
    case RecurrenceFrequency.YEARLY:
      next.setFullYear(next.getFullYear() + safeInterval);
      break;
    default:
      next.setMonth(next.getMonth() + safeInterval);
      break;
  }

  return next;
};

const processTemplate = async (template: {
  id: number;
  user_id: number;
  customer_id: number;
  discount: Prisma.Decimal;
  notes: string | null;
  due_in_days: number;
  next_run_date: Date;
  frequency: RecurrenceFrequency;
  interval_count: number;
  items: Prisma.JsonValue;
}) => {
  if (!isInvoiceItemArray(template.items)) {
    console.error(
      `[RecurringInvoiceJob] Template ${template.id} has invalid items payload`,
    );
    return;
  }

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + Math.max(0, template.due_in_days));

  const totals = calculateTotals(template.items, Number(template.discount));
  const nextRunDate = addFrequency(
    template.next_run_date,
    template.frequency,
    template.interval_count,
  );

  await prisma.$transaction(async (tx) => {
    const latest = await tx.invoice.findFirst({
      where: { user_id: template.user_id },
      orderBy: { createdAt: "desc" },
      select: { invoice_number: true },
    });

    const invoiceNumber = generateInvoiceNumber(latest?.invoice_number);

    await tx.invoice.create({
      data: {
        user_id: template.user_id,
        customer_id: template.customer_id,
        invoice_number: invoiceNumber,
        status: InvoiceStatus.DRAFT,
        date: new Date(),
        due_date: dueDate,
        subtotal: totals.subtotal,
        tax: totals.tax,
        discount: totals.discount,
        total: totals.total,
        notes: template.notes ?? undefined,
        items: {
          create: totals.items.map((item) => ({
            product_id: item.product_id ?? undefined,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            tax_rate: item.tax_rate ?? undefined,
            total: item.total,
          })),
        },
      },
    });

    await tx.recurringInvoiceTemplate.update({
      where: { id: template.id },
      data: {
        last_run_date: new Date(),
        next_run_date: nextRunDate,
      },
    });
  });
};

export const runRecurringInvoiceJob = async () => {
  const now = new Date();

  const templates = await prisma.recurringInvoiceTemplate.findMany({
    where: {
      is_active: true,
      next_run_date: { lte: now },
    },
    select: {
      id: true,
      user_id: true,
      customer_id: true,
      discount: true,
      notes: true,
      due_in_days: true,
      next_run_date: true,
      frequency: true,
      interval_count: true,
      items: true,
    },
  });

  for (const template of templates) {
    try {
      await processTemplate(template);
    } catch (error) {
      console.error(
        `[RecurringInvoiceJob] Failed processing template ${template.id}`,
        error,
      );
    }
  }
};

export const startRecurringInvoiceCron = () => {
  // Runs once daily at midnight server time.
  cron.schedule("0 0 * * *", async () => {
    await runRecurringInvoiceJob();
  });
};
