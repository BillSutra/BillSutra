import type { Request, Response } from "express";
import { sendResponse } from "../utils/sendResponse.js";
import prisma from "../config/db.config.js";
import { getTotalPages, parsePagination } from "../utils/pagination.js";
import type { z } from "zod";
import {
  customerCreateSchema,
  customerUpdateSchema,
} from "../validations/apiValidations.js";

type CustomerCreateInput = z.infer<typeof customerCreateSchema>;
type CustomerUpdateInput = z.infer<typeof customerUpdateSchema>;

const toNumber = (value: unknown) => Number(value ?? 0);

const roundAmount = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const relevantInvoiceStatuses = new Set([
  "SENT",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
]);

const buildCustomerSummary = (
  customer: {
    created_at: Date;
    invoices: Array<{
      id: number;
      invoice_number: string;
      date: Date;
      due_date: Date | null;
      status: string;
      total: unknown;
      payments: Array<{
        id: number;
        amount: unknown;
        paid_at: Date;
      }>;
    }>;
  },
) => {
  const invoices = customer.invoices.filter((invoice) =>
    relevantInvoiceStatuses.has(invoice.status),
  );
  const totalBilled = roundAmount(
    invoices.reduce((sum, invoice) => sum + toNumber(invoice.total), 0),
  );
  const totalPaid = roundAmount(
    invoices.reduce(
      (sum, invoice) =>
        sum +
        invoice.payments.reduce(
          (paymentSum, payment) => paymentSum + toNumber(payment.amount),
          0,
        ),
      0,
    ),
  );
  const outstandingBalance = roundAmount(Math.max(totalBilled - totalPaid, 0));

  const openInvoices = invoices
    .map((invoice) => {
      const paid = invoice.payments.reduce(
        (sum, payment) => sum + toNumber(payment.amount),
        0,
      );
      const remaining = roundAmount(Math.max(toNumber(invoice.total) - paid, 0));

      return {
        id: invoice.id,
        invoiceNumber: invoice.invoice_number,
        issueDate: invoice.date,
        dueDate: invoice.due_date,
        status: invoice.status,
        total: roundAmount(toNumber(invoice.total)),
        paid: roundAmount(paid),
        remaining,
      };
    })
    .filter((invoice) => invoice.remaining > 0)
    .sort((left, right) => left.issueDate.getTime() - right.issueDate.getTime());

  const paymentDates = invoices.flatMap((invoice) =>
    invoice.payments.map((payment) => payment.paid_at),
  );
  const activityDates = [
    customer.created_at,
    ...invoices.map((invoice) => invoice.date),
    ...paymentDates,
  ];
  const lastPaymentDate =
    paymentDates.length > 0
      ? new Date(Math.max(...paymentDates.map((value) => value.getTime())))
      : null;
  const lastActivityDate = new Date(
    Math.max(...activityDates.map((value) => value.getTime())),
  );

  return {
    totalBilled,
    totalPaid,
    outstandingBalance,
    openInvoiceCount: openInvoices.length,
    settled: outstandingBalance <= 0,
    lastPaymentDate,
    lastActivityDate,
    openInvoices,
  };
};

const buildCustomerLedger = (
  customer: {
    id: number;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    created_at: Date;
    invoices: Array<{
      id: number;
      invoice_number: string;
      date: Date;
      due_date: Date | null;
      status: string;
      total: unknown;
      payments: Array<{
        id: number;
        amount: unknown;
        method: string;
        reference: string | null;
        paid_at: Date;
      }>;
    }>;
  },
) => {
  const summary = buildCustomerSummary(customer);
  const rows = customer.invoices
    .filter((invoice) => relevantInvoiceStatuses.has(invoice.status))
    .flatMap((invoice) => {
      const invoiceEntry = {
        id: `invoice-${invoice.id}`,
        sortDate: invoice.date,
        sortWeight: 0,
        type: "invoice" as const,
        invoiceId: invoice.id,
        paymentId: null,
        date: invoice.date,
        description: `Invoice ${invoice.invoice_number}`,
        note:
          invoice.status === "OVERDUE"
            ? "Overdue invoice"
            : invoice.due_date
              ? `Due ${invoice.due_date.toISOString().slice(0, 10)}`
              : "Invoice issued",
        debit: roundAmount(toNumber(invoice.total)),
        credit: 0,
      };

      const paymentEntries = invoice.payments.map((payment) => ({
        id: `payment-${payment.id}`,
        sortDate: payment.paid_at,
        sortWeight: 1,
        type: "payment" as const,
        invoiceId: invoice.id,
        paymentId: payment.id,
        date: payment.paid_at,
        description: `Payment received for ${invoice.invoice_number}`,
        note: payment.reference || payment.method || "Payment recorded",
        debit: 0,
        credit: roundAmount(toNumber(payment.amount)),
      }));

      return [invoiceEntry, ...paymentEntries];
    })
    .sort((left, right) => {
      const dateDiff = left.sortDate.getTime() - right.sortDate.getTime();
      if (dateDiff !== 0) return dateDiff;
      if (left.sortWeight !== right.sortWeight) {
        return left.sortWeight - right.sortWeight;
      }
      return left.id.localeCompare(right.id);
    });

  let runningBalance = 0;
  const entries = rows.map((entry) => {
    runningBalance = roundAmount(runningBalance + entry.debit - entry.credit);

    return {
      id: entry.id,
      type: entry.type,
      invoiceId: entry.invoiceId,
      paymentId: entry.paymentId,
      date: entry.date,
      description: entry.description,
      note: entry.note,
      debit: entry.debit,
      credit: entry.credit,
      balance: runningBalance,
    };
  });

  return {
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
    },
    summary,
    entries,
  };
};

class CustomersController {
  static async index(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const { page, limit, skip } = parsePagination({
      page: req.query.page,
      limit: req.query.limit,
    });

    const where = { user_id: userId };
    const [items, total] = await prisma.$transaction([
      prisma.customer.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip,
        take: limit,
        include: {
          invoices: {
            select: {
              id: true,
              invoice_number: true,
              date: true,
              due_date: true,
              status: true,
              total: true,
              payments: {
                select: {
                  id: true,
                  amount: true,
                  paid_at: true,
                },
              },
            },
          },
        },
      }),
      prisma.customer.count({ where }),
    ]);

    const enrichedCustomers = items.map((customer) => ({
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      created_at: customer.created_at,
      updated_at: customer.updated_at,
      ...buildCustomerSummary(customer),
    }));

    return sendResponse(res, 200, {
      data: {
        items: enrichedCustomers,
        total,
        page,
        totalPages: getTotalPages(total, limit),
      },
    });
  }

  static async store(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const body: CustomerCreateInput = req.body;
    const { name, email, phone, address } = body;

    const customer = await prisma.customer.create({
      data: {
        user_id: userId,
        name,
        email,
        phone,
        address,
      },
    });

    return sendResponse(res, 201, {
      message: "Customer created",
      data: customer,
    });
  }

  static async show(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const id = Number(req.params.id);
    const customer = await prisma.customer.findFirst({
      where: { id, user_id: userId },
      include: {
        invoices: {
          select: {
            id: true,
            invoice_number: true,
            date: true,
            due_date: true,
            status: true,
            total: true,
            payments: {
              select: {
                id: true,
                amount: true,
                method: true,
                reference: true,
                paid_at: true,
              },
            },
          },
        },
      },
    });

    if (!customer) {
      return sendResponse(res, 404, { message: "Customer not found" });
    }

    return sendResponse(res, 200, {
      data: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        created_at: customer.created_at,
        updated_at: customer.updated_at,
        ...buildCustomerSummary(customer),
      },
    });
  }

  static async ledger(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const id = Number(req.params.id);
    const customer = await prisma.customer.findFirst({
      where: { id, user_id: userId },
      include: {
        invoices: {
          orderBy: { date: "asc" },
          select: {
            id: true,
            invoice_number: true,
            date: true,
            due_date: true,
            status: true,
            total: true,
            payments: {
              orderBy: { paid_at: "asc" },
              select: {
                id: true,
                amount: true,
                method: true,
                reference: true,
                paid_at: true,
              },
            },
          },
        },
      },
    });

    if (!customer) {
      return sendResponse(res, 404, { message: "Customer not found" });
    }

    return sendResponse(res, 200, { data: buildCustomerLedger(customer) });
  }

  static async update(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const id = Number(req.params.id);
    const body: CustomerUpdateInput = req.body;
    const { name, email, phone, address } = body;

    const updated = await prisma.customer.updateMany({
      where: { id, user_id: userId },
      data: { name, email, phone, address },
    });

    if (!updated.count) {
      return sendResponse(res, 404, { message: "Customer not found" });
    }

    return sendResponse(res, 200, { message: "Customer updated" });
  }

  static async destroy(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const id = Number(req.params.id);
    const deleted = await prisma.customer.deleteMany({
      where: { id, user_id: userId },
    });

    if (!deleted.count) {
      return sendResponse(res, 404, { message: "Customer not found" });
    }

    return sendResponse(res, 200, { message: "Customer removed" });
  }
}

export default CustomersController;
