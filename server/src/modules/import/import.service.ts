import { InvoiceStatus, type Prisma } from "@prisma/client";
import { Readable } from "node:stream";
import csvParser from "csv-parser";
import * as XLSX from "xlsx";
import { z } from "zod";
import prisma from "../../config/db.config.js";

type RawRow = Record<string, unknown>;

export type ImportError = {
  row: number;
  message: string;
};

export type ImportResult = {
  imported: number;
  failed: number;
  errors: ImportError[];
};

export type ImportTemplateType =
  | "clients"
  | "products"
  | "invoices"
  | "invoice-items";

type TemplateDefinition = {
  filename: string;
  headers: string[];
};

const importTemplateDefinitions: Record<
  ImportTemplateType,
  TemplateDefinition
> = {
  clients: {
    filename: "clients-import-template.csv",
    headers: ["name", "email", "phone", "address", "gstin", "notes"],
  },
  products: {
    filename: "products-import-template.csv",
    headers: ["name", "description", "price", "taxRate"],
  },
  invoices: {
    filename: "invoices-import-template.csv",
    headers: [
      "clientEmail",
      "invoiceNumber",
      "issueDate",
      "dueDate",
      "status",
      "subtotal",
      "taxAmount",
      "discount",
      "totalAmount",
    ],
  },
  "invoice-items": {
    filename: "invoice-items-import-template.csv",
    headers: [
      "invoiceNumber",
      "productSku",
      "name",
      "quantity",
      "price",
      "taxRate",
      "total",
    ],
  },
};

export const getImportTemplateCsv = (type: ImportTemplateType) => {
  const definition = importTemplateDefinitions[type];
  const csvText = `${definition.headers.join(",")}\n`;

  return {
    fileName: definition.filename,
    content: Buffer.from(csvText, "utf-8"),
  };
};

const normalizeKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const normalizeRow = (row: RawRow): RawRow => {
  const next: RawRow = {};

  Object.entries(row).forEach(([key, value]) => {
    next[normalizeKey(String(key))] = value;
  });

  return next;
};

const valueToString = (value: unknown): string | undefined => {
  if (value === null || value === undefined) {
    return undefined;
  }

  const text = String(value).trim();
  return text.length > 0 ? text : undefined;
};

const valueToNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  const parsed = Number(String(value).trim());
  return Number.isFinite(parsed) ? parsed : undefined;
};

const excelDateToJsDate = (serial: number): Date => {
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  return new Date(utcValue * 1000);
};

const valueToDate = (value: unknown): Date | undefined => {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "number") {
    const maybeExcelDate = excelDateToJsDate(value);
    if (!Number.isNaN(maybeExcelDate.getTime())) {
      return maybeExcelDate;
    }
  }

  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const readValue = (row: RawRow, key: string): unknown => row[normalizeKey(key)];

const parseCsv = async (buffer: Buffer): Promise<RawRow[]> => {
  const rows: RawRow[] = [];

  return new Promise((resolve, reject) => {
    Readable.from(buffer)
      .pipe(csvParser())
      .on("data", (row: RawRow) => {
        rows.push(normalizeRow(row));
      })
      .on("end", () => resolve(rows))
      .on("error", reject);
  });
};

const parseXlsx = (buffer: Buffer): RawRow[] => {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    return [];
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<RawRow>(sheet, {
    raw: true,
    defval: "",
  });

  return rows.map(normalizeRow);
};

export const parseImportFile = async (
  file: Express.Multer.File,
): Promise<RawRow[]> => {
  const fileName = file.originalname.toLowerCase();

  if (fileName.endsWith(".csv")) {
    return parseCsv(file.buffer);
  }

  if (fileName.endsWith(".xlsx")) {
    return parseXlsx(file.buffer);
  }

  throw new Error("Unsupported file type. Please upload CSV or XLSX files.");
};

const importSummary = (
  imported: number,
  errors: ImportError[],
): ImportResult => ({
  imported,
  failed: errors.length,
  errors,
});

const clientRowSchema = z.object({
  name: z.string().min(1, "name is required"),
  email: z.string().email("Invalid email").optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  gstin: z.string().optional(),
  notes: z.string().optional(),
});

const productRowSchema = z.object({
  name: z.string().min(1, "name is required"),
  description: z.string().optional(),
  price: z.number().nonnegative("price must be >= 0"),
  taxRate: z.number().nonnegative("taxRate must be >= 0").default(0),
});

const invoiceStatusParser = z
  .string()
  .transform((value) =>
    value
      .trim()
      .toUpperCase()
      .replace(/[-\s]+/g, "_"),
  )
  .pipe(z.nativeEnum(InvoiceStatus));

const invoiceRowSchema = z.object({
  clientEmail: z.string().email("Invalid clientEmail"),
  invoiceNumber: z.string().min(1, "invoiceNumber is required"),
  issueDate: z.date(),
  dueDate: z.date().optional(),
  status: invoiceStatusParser.default(InvoiceStatus.DRAFT),
  subtotal: z.number().nonnegative(),
  taxAmount: z.number().nonnegative().default(0),
  discount: z.number().nonnegative().default(0),
  totalAmount: z.number().nonnegative(),
});

const invoiceItemRowSchema = z.object({
  invoiceNumber: z.string().min(1, "invoiceNumber is required"),
  productSku: z.string().optional(),
  name: z.string().min(1, "name is required"),
  quantity: z.number().int().positive(),
  price: z.number().nonnegative(),
  taxRate: z.number().nonnegative().optional(),
  total: z.number().nonnegative().optional(),
});

const getZodMessage = (issues: z.ZodIssue[]) =>
  issues.map((issue) => issue.message).join(", ");

export const importClients = async (
  userId: number,
  rows: RawRow[],
): Promise<ImportResult> => {
  const errors: ImportError[] = [];
  const records: Prisma.CustomerCreateManyInput[] = [];

  rows.forEach((row, index) => {
    const parsed = clientRowSchema.safeParse({
      name: valueToString(readValue(row, "name")),
      email: valueToString(readValue(row, "email")),
      phone: valueToString(readValue(row, "phone")),
      address: valueToString(readValue(row, "address")),
      gstin: valueToString(readValue(row, "gstin")),
      notes: valueToString(readValue(row, "notes")),
    });

    if (!parsed.success) {
      errors.push({
        row: index + 2,
        message: getZodMessage(parsed.error.issues),
      });
      return;
    }

    records.push({
      user_id: userId,
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      address: parsed.data.address,
    });
  });

  if (records.length === 0) {
    return importSummary(0, errors);
  }

  const result = await prisma.$transaction((tx) =>
    tx.customer.createMany({
      data: records,
      skipDuplicates: false,
    }),
  );

  return importSummary(result.count, errors);
};

const toImportSku = (name: string, row: number) => {
  const cleaned = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 18);

  return `IMP-${cleaned || "ITEM"}-${row}`;
};

export const importProducts = async (
  userId: number,
  rows: RawRow[],
): Promise<ImportResult> => {
  const errors: ImportError[] = [];
  const records: Prisma.ProductCreateManyInput[] = [];

  rows.forEach((row, index) => {
    const parsed = productRowSchema.safeParse({
      name: valueToString(readValue(row, "name")),
      description: valueToString(readValue(row, "description")),
      price: valueToNumber(readValue(row, "price")),
      taxRate: valueToNumber(readValue(row, "taxRate")),
    });

    if (!parsed.success) {
      errors.push({
        row: index + 2,
        message: getZodMessage(parsed.error.issues),
      });
      return;
    }

    records.push({
      user_id: userId,
      name: parsed.data.name,
      sku: toImportSku(parsed.data.name, index + 2),
      price: parsed.data.price,
      gst_rate: parsed.data.taxRate,
      stock_on_hand: 0,
      reorder_level: 0,
    });
  });

  if (records.length === 0) {
    return importSummary(0, errors);
  }

  const result = await prisma.$transaction((tx) =>
    tx.product.createMany({
      data: records,
      skipDuplicates: false,
    }),
  );

  return importSummary(result.count, errors);
};

export const importInvoices = async (
  userId: number,
  rows: RawRow[],
): Promise<ImportResult> => {
  const errors: ImportError[] = [];

  const preparedRows = rows.map((row, index) => {
    const parsed = invoiceRowSchema.safeParse({
      clientEmail: valueToString(readValue(row, "clientEmail")),
      invoiceNumber: valueToString(readValue(row, "invoiceNumber")),
      issueDate: valueToDate(readValue(row, "issueDate")),
      dueDate: valueToDate(readValue(row, "dueDate")),
      status: valueToString(readValue(row, "status")) ?? InvoiceStatus.DRAFT,
      subtotal: valueToNumber(readValue(row, "subtotal")),
      taxAmount: valueToNumber(readValue(row, "taxAmount")) ?? 0,
      discount: valueToNumber(readValue(row, "discount")) ?? 0,
      totalAmount: valueToNumber(readValue(row, "totalAmount")),
    });

    if (!parsed.success) {
      errors.push({
        row: index + 2,
        message: getZodMessage(parsed.error.issues),
      });
      return null;
    }

    return { rowNumber: index + 2, data: parsed.data };
  });

  const validRows = preparedRows.filter(
    (item): item is NonNullable<typeof item> => item !== null,
  );

  if (validRows.length === 0) {
    return importSummary(0, errors);
  }

  const emails = Array.from(
    new Set(validRows.map((row) => row.data.clientEmail)),
  );
  const clients = await prisma.customer.findMany({
    where: {
      user_id: userId,
      email: { in: emails },
    },
    select: { id: true, email: true },
  });

  const clientByEmail = new Map(
    clients
      .filter((client): client is { id: number; email: string } =>
        Boolean(client.email),
      )
      .map((client) => [client.email.toLowerCase(), client.id]),
  );

  const invoiceNumbers = validRows.map((row) => row.data.invoiceNumber);
  const existingInvoices = await prisma.invoice.findMany({
    where: {
      user_id: userId,
      invoice_number: { in: invoiceNumbers },
    },
    select: { invoice_number: true },
  });
  const existingInvoiceSet = new Set(
    existingInvoices.map((item) => item.invoice_number),
  );

  const records: Prisma.InvoiceCreateManyInput[] = [];

  validRows.forEach((row) => {
    const emailKey = row.data.clientEmail.toLowerCase();
    const customerId = clientByEmail.get(emailKey);

    if (!customerId) {
      errors.push({
        row: row.rowNumber,
        message: `Client not found for email ${row.data.clientEmail}`,
      });
      return;
    }

    if (existingInvoiceSet.has(row.data.invoiceNumber)) {
      errors.push({
        row: row.rowNumber,
        message: `Invoice number ${row.data.invoiceNumber} already exists`,
      });
      return;
    }

    records.push({
      user_id: userId,
      customer_id: customerId,
      invoice_number: row.data.invoiceNumber,
      status: row.data.status,
      date: row.data.issueDate,
      due_date: row.data.dueDate,
      subtotal: row.data.subtotal,
      tax: row.data.taxAmount,
      discount: row.data.discount,
      total: row.data.totalAmount,
    });
  });

  if (records.length === 0) {
    return importSummary(0, errors);
  }

  const result = await prisma.$transaction((tx) =>
    tx.invoice.createMany({
      data: records,
      skipDuplicates: false,
    }),
  );

  return importSummary(result.count, errors);
};

export const importInvoiceItems = async (
  userId: number,
  rows: RawRow[],
): Promise<ImportResult> => {
  const errors: ImportError[] = [];

  const preparedRows = rows.map((row, index) => {
    const parsed = invoiceItemRowSchema.safeParse({
      invoiceNumber: valueToString(readValue(row, "invoiceNumber")),
      productSku: valueToString(readValue(row, "productSku")),
      name: valueToString(readValue(row, "name")),
      quantity: valueToNumber(readValue(row, "quantity")),
      price: valueToNumber(readValue(row, "price")),
      taxRate: valueToNumber(readValue(row, "taxRate")),
      total: valueToNumber(readValue(row, "total")),
    });

    if (!parsed.success) {
      errors.push({
        row: index + 2,
        message: getZodMessage(parsed.error.issues),
      });
      return null;
    }

    return { rowNumber: index + 2, data: parsed.data };
  });

  const validRows = preparedRows.filter(
    (item): item is NonNullable<typeof item> => item !== null,
  );

  if (validRows.length === 0) {
    return importSummary(0, errors);
  }

  const invoiceNumbers = Array.from(
    new Set(validRows.map((row) => row.data.invoiceNumber)),
  );
  const invoices = await prisma.invoice.findMany({
    where: {
      user_id: userId,
      invoice_number: { in: invoiceNumbers },
    },
    select: { id: true, invoice_number: true },
  });
  const invoiceMap = new Map(
    invoices.map((invoice) => [invoice.invoice_number, invoice.id]),
  );

  const skus = Array.from(
    new Set(
      validRows
        .map((row) => row.data.productSku)
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const products = skus.length
    ? await prisma.product.findMany({
        where: {
          user_id: userId,
          sku: { in: skus },
        },
        select: { id: true, sku: true },
      })
    : [];
  const productMap = new Map(
    products.map((product) => [product.sku, product.id]),
  );

  const records: Prisma.InvoiceItemCreateManyInput[] = [];

  validRows.forEach((row) => {
    const invoiceId = invoiceMap.get(row.data.invoiceNumber);
    if (!invoiceId) {
      errors.push({
        row: row.rowNumber,
        message: `Invoice not found for number ${row.data.invoiceNumber}`,
      });
      return;
    }

    let productId: number | undefined;
    if (row.data.productSku) {
      productId = productMap.get(row.data.productSku);
      if (!productId) {
        errors.push({
          row: row.rowNumber,
          message: `Product not found for SKU ${row.data.productSku}`,
        });
        return;
      }
    }

    const lineTotal = row.data.total ?? row.data.quantity * row.data.price;

    records.push({
      invoice_id: invoiceId,
      product_id: productId,
      name: row.data.name,
      quantity: row.data.quantity,
      price: row.data.price,
      tax_rate: row.data.taxRate,
      total: lineTotal,
    });
  });

  if (records.length === 0) {
    return importSummary(0, errors);
  }

  const result = await prisma.$transaction((tx) =>
    tx.invoiceItem.createMany({
      data: records,
      skipDuplicates: false,
    }),
  );

  return importSummary(result.count, errors);
};
