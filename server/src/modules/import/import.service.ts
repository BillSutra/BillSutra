import { randomUUID } from "node:crypto";
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

export type ProductImportRowValues = {
  name: string;
  sku: string;
  barcode: string;
  sellingPrice: string;
  costPrice: string;
  gstRate: string;
  openingStock: string;
  reorderLevel: string;
  category: string;
};

export type ProductImportValidRow = {
  rowNumber: number;
  name: string;
  sku: string;
  barcode?: string;
  price: number;
  cost?: number;
  gstRate: number;
  stock: number;
  reorderLevel: number;
  category?: string;
};

export type ProductImportInvalidRow = {
  rowNumber: number;
  values: ProductImportRowValues;
  errors: string[];
};

export type ProductImportPreview = {
  previewToken: string;
  fileName: string;
  totalRows: number;
  validRows: ProductImportValidRow[];
  invalidRows: ProductImportInvalidRow[];
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    expiresAt: string;
  };
};

export type ProductImportConfirmError = {
  rowNumber: number;
  message: string;
};

export type ProductImportConfirmResult = {
  importedCount: number;
  skippedCount: number;
  errors: ProductImportConfirmError[];
};

type PreparedProductImportRow = ProductImportValidRow & {
  categoryId?: number;
};

type StoredProductImportPreview = {
  userId: number;
  fileName: string;
  totalRows: number;
  createdAt: number;
  expiresAt: number;
  validRows: PreparedProductImportRow[];
  invalidRows: ProductImportInvalidRow[];
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

const PRODUCT_TEMPLATE_HEADERS = [
  "name",
  "sku",
  "barcode",
  "selling_price",
  "cost_price",
  "gst_rate",
  "opening_stock",
  "reorder_level",
  "category",
] as const;

const PRODUCT_TEMPLATE_REQUIRED_HEADERS = [
  "name",
  "sku",
  "selling_price",
] as const;

const PRODUCT_FIELD_ALIASES = {
  name: ["name", "product_name"],
  sku: ["sku", "product_sku"],
  barcode: ["barcode", "bar_code", "product_barcode"],
  sellingPrice: ["selling_price", "price", "sellingprice"],
  costPrice: ["cost_price", "cost", "costprice"],
  gstRate: ["gst_rate", "gst", "gstrate", "tax_rate", "taxrate"],
  openingStock: ["opening_stock", "stock", "openingstock", "stock_on_hand"],
  reorderLevel: ["reorder_level", "reorder", "reorderlevel"],
  category: ["category", "category_name", "categoryname"],
} as const;

const PRODUCT_TEMPLATE_EXAMPLE_ROW = [
  "Sample Product",
  "SKU-1001",
  "1234567890123",
  "499.99",
  "320.00",
  "18",
  "25",
  "5",
  "Existing Category Name",
] as const;

const PRODUCT_IMPORT_PREVIEW_TTL_MS = 15 * 60 * 1000;

const productImportPreviewStore = new Map<string, StoredProductImportPreview>();

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
    headers: [...PRODUCT_TEMPLATE_HEADERS],
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

export const getProductImportTemplateWorkbook = () => {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([
    [...PRODUCT_TEMPLATE_HEADERS],
    [...PRODUCT_TEMPLATE_EXAMPLE_ROW],
  ]);

  worksheet["!cols"] = [
    { wch: 28 },
    { wch: 18 },
    { wch: 18 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
    { wch: 24 },
  ];
  worksheet["!autofilter"] = { ref: "A1:I2" };

  PRODUCT_TEMPLATE_HEADERS.forEach((_header, index) => {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: index });
    const cell = worksheet[cellRef];

    if (cell) {
      cell.s = {
        font: { bold: true },
        fill: { fgColor: { rgb: "E2E8F0" } },
        alignment: { horizontal: "center" },
      };
    }
  });

  XLSX.utils.book_append_sheet(workbook, worksheet, "Products");

  return {
    fileName: "products-import-template.xlsx",
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    content: XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    }) as Buffer,
  };
};

const normalizeKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const normalizeComparableValue = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const sanitizeText = (value: string) =>
  value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

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

const valueToSanitizedString = (value: unknown): string | undefined => {
  const text = valueToString(value);
  if (!text) {
    return undefined;
  }

  const sanitized = sanitizeText(text);
  return sanitized.length > 0 ? sanitized : undefined;
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

const readFirstValue = (row: RawRow, keys: readonly string[]) => {
  for (const key of keys) {
    const value = readValue(row, key);
    if (isMeaningfulCellValue(value)) {
      return value;
    }
  }

  return undefined;
};

const isMeaningfulCellValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  return String(value).trim().length > 0;
};

const isEmptyRow = (row: RawRow) => !Object.values(row).some(isMeaningfulCellValue);

const buildProductImportRowValues = (row: RawRow): ProductImportRowValues => ({
  name: valueToSanitizedString(readFirstValue(row, PRODUCT_FIELD_ALIASES.name)) ?? "",
  sku: valueToSanitizedString(readFirstValue(row, PRODUCT_FIELD_ALIASES.sku)) ?? "",
  barcode:
    valueToSanitizedString(readFirstValue(row, PRODUCT_FIELD_ALIASES.barcode)) ??
    "",
  sellingPrice:
    valueToSanitizedString(
      readFirstValue(row, PRODUCT_FIELD_ALIASES.sellingPrice),
    ) ?? "",
  costPrice:
    valueToSanitizedString(readFirstValue(row, PRODUCT_FIELD_ALIASES.costPrice)) ??
    "",
  gstRate:
    valueToSanitizedString(readFirstValue(row, PRODUCT_FIELD_ALIASES.gstRate)) ??
    "",
  openingStock:
    valueToSanitizedString(
      readFirstValue(row, PRODUCT_FIELD_ALIASES.openingStock),
    ) ?? "",
  reorderLevel:
    valueToSanitizedString(
      readFirstValue(row, PRODUCT_FIELD_ALIASES.reorderLevel),
    ) ?? "",
  category:
    valueToSanitizedString(readFirstValue(row, PRODUCT_FIELD_ALIASES.category)) ??
    "",
});

const ensureRequiredHeaders = (
  rows: RawRow[],
  requiredHeaders: readonly string[],
  aliases?: Partial<Record<string, readonly string[]>>,
) => {
  const availableHeaders = new Set<string>();

  rows.forEach((row) => {
    Object.keys(row).forEach((key) => {
      availableHeaders.add(normalizeKey(key));
    });
  });

  const missingHeaders = requiredHeaders.filter((header) => {
    const candidateHeaders = aliases?.[header] ?? [header];
    return !candidateHeaders.some((candidate) =>
      availableHeaders.has(normalizeKey(candidate)),
    );
  });

  if (missingHeaders.length > 0) {
    throw new Error(
      `Missing required columns: ${missingHeaders.join(", ")}.`,
    );
  }
};

const cleanupExpiredProductImportPreviews = () => {
  const now = Date.now();

  for (const [token, preview] of productImportPreviewStore.entries()) {
    if (preview.expiresAt <= now) {
      productImportPreviewStore.delete(token);
    }
  }
};

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

const productImportRowSchema = z.object({
  name: z.string().min(1, "name is required"),
  sku: z.string().min(1, "sku is required"),
  barcode: z.string().min(1).optional(),
  price: z.number().nonnegative("selling_price must be 0 or more"),
  cost: z.number().nonnegative("cost_price must be 0 or more").optional(),
  gstRate: z.number().nonnegative("gst_rate must be 0 or more").default(18),
  category: z.string().optional(),
  stock: z
    .number({
      invalid_type_error: "opening_stock must be an integer >= 0",
    })
    .int("opening_stock must be an integer >= 0")
    .min(0, "opening_stock must be an integer >= 0")
    .default(0),
  reorderLevel: z
    .number({
      invalid_type_error: "reorder_level must be an integer >= 0",
    })
    .int("reorder_level must be an integer >= 0")
    .min(0, "reorder_level must be an integer >= 0")
    .default(0),
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

export const createProductImportPreview = async (
  userId: number,
  file: Express.Multer.File,
): Promise<ProductImportPreview> => {
  cleanupExpiredProductImportPreviews();

  const parsedRows = await parseImportFile(file);
  const nonEmptyRows = parsedRows.filter((row) => !isEmptyRow(row));

  if (nonEmptyRows.length === 0) {
    throw new Error("No data rows found in the uploaded file.");
  }

  ensureRequiredHeaders(nonEmptyRows, PRODUCT_TEMPLATE_REQUIRED_HEADERS, {
    name: PRODUCT_FIELD_ALIASES.name,
    sku: PRODUCT_FIELD_ALIASES.sku,
    selling_price: PRODUCT_FIELD_ALIASES.sellingPrice,
  });

  const [categories, existingProducts] = await Promise.all([
    prisma.category.findMany({
      where: { user_id: userId },
      select: { id: true, name: true },
    }),
    prisma.product.findMany({
      where: { user_id: userId },
      select: { sku: true, barcode: true },
    }),
  ]);

  const categoryByName = new Map(
    categories.map((category) => [
      normalizeComparableValue(category.name),
      category,
    ]),
  );
  const existingSkus = new Set(
    existingProducts.map((product) => normalizeComparableValue(product.sku)),
  );
  const existingBarcodes = new Set(
    existingProducts
      .map((product) => valueToSanitizedString(product.barcode))
      .filter((barcode): barcode is string => Boolean(barcode))
      .map(normalizeComparableValue),
  );
  const duplicateSkuCounts = new Map<string, number>();
  const duplicateBarcodeCounts = new Map<string, number>();

  nonEmptyRows.forEach((row) => {
    const sku = valueToSanitizedString(
      readFirstValue(row, PRODUCT_FIELD_ALIASES.sku),
    );
    if (sku) {
      const key = normalizeComparableValue(sku);
      duplicateSkuCounts.set(key, (duplicateSkuCounts.get(key) ?? 0) + 1);
    }

    const barcode = valueToSanitizedString(
      readFirstValue(row, PRODUCT_FIELD_ALIASES.barcode),
    );
    if (!barcode) {
      return;
    }

    const key = normalizeComparableValue(barcode);
    duplicateBarcodeCounts.set(key, (duplicateBarcodeCounts.get(key) ?? 0) + 1);
  });

  const validRows: PreparedProductImportRow[] = [];
  const invalidRows: ProductImportInvalidRow[] = [];

  nonEmptyRows.forEach((row, index) => {
    const rowNumber = index + 2;
    const values = buildProductImportRowValues(row);
    const parsed = productImportRowSchema.safeParse({
      name: values.name,
      sku: values.sku,
      barcode: values.barcode || undefined,
      price: valueToNumber(readFirstValue(row, PRODUCT_FIELD_ALIASES.sellingPrice)),
      cost: valueToNumber(readFirstValue(row, PRODUCT_FIELD_ALIASES.costPrice)),
      gstRate:
        valueToNumber(readFirstValue(row, PRODUCT_FIELD_ALIASES.gstRate)) ?? 18,
      category: values.category || undefined,
      stock:
        valueToNumber(readFirstValue(row, PRODUCT_FIELD_ALIASES.openingStock)) ??
        0,
      reorderLevel:
        valueToNumber(readFirstValue(row, PRODUCT_FIELD_ALIASES.reorderLevel)) ??
        0,
    });

    const errors = parsed.success
      ? []
      : parsed.error.issues.map((issue) => issue.message);

    const normalizedSku = values.sku
      ? normalizeComparableValue(values.sku)
      : undefined;
    const normalizedBarcode = values.barcode
      ? normalizeComparableValue(values.barcode)
      : undefined;
    const normalizedCategory = values.category
      ? normalizeComparableValue(values.category)
      : undefined;

    if (normalizedSku && (duplicateSkuCounts.get(normalizedSku) ?? 0) > 1) {
      errors.push("Duplicate SKU found in the uploaded file");
    }

    if (normalizedSku && existingSkus.has(normalizedSku)) {
      errors.push("SKU already exists");
    }

    if (
      normalizedBarcode &&
      (duplicateBarcodeCounts.get(normalizedBarcode) ?? 0) > 1
    ) {
      errors.push("Duplicate barcode found in the uploaded file");
    }

    if (normalizedBarcode && existingBarcodes.has(normalizedBarcode)) {
      errors.push("Barcode already exists");
    }

    const matchedCategory =
      normalizedCategory !== undefined
        ? categoryByName.get(normalizedCategory)
        : undefined;

    if (normalizedCategory && !matchedCategory) {
      errors.push(`Category "${values.category}" does not exist`);
    }

    if (errors.length > 0 || !parsed.success) {
      invalidRows.push({
        rowNumber,
        values,
        errors: Array.from(new Set(errors)),
      });
      return;
    }

    validRows.push({
      rowNumber,
      name: parsed.data.name,
      sku: parsed.data.sku,
      barcode: parsed.data.barcode,
      price: parsed.data.price,
      cost: parsed.data.cost,
      gstRate: parsed.data.gstRate,
      category: matchedCategory?.name,
      categoryId: matchedCategory?.id,
      stock: parsed.data.stock,
      reorderLevel: parsed.data.reorderLevel,
    });
  });

  const previewToken = randomUUID();
  const expiresAt = Date.now() + PRODUCT_IMPORT_PREVIEW_TTL_MS;

  productImportPreviewStore.set(previewToken, {
    userId,
    fileName: file.originalname,
    totalRows: nonEmptyRows.length,
    createdAt: Date.now(),
    expiresAt,
    validRows,
    invalidRows,
  });

  return {
    previewToken,
    fileName: file.originalname,
    totalRows: nonEmptyRows.length,
    validRows: validRows.map(({ categoryId: _categoryId, ...row }) => row),
    invalidRows,
    summary: {
      totalRows: nonEmptyRows.length,
      validRows: validRows.length,
      invalidRows: invalidRows.length,
      expiresAt: new Date(expiresAt).toISOString(),
    },
  };
};

export const confirmProductImport = async (
  userId: number,
  previewToken: string,
): Promise<ProductImportConfirmResult> => {
  cleanupExpiredProductImportPreviews();

  const storedPreview = productImportPreviewStore.get(previewToken);

  if (!storedPreview || storedPreview.userId !== userId) {
    throw new Error("Import preview expired. Please upload the file again.");
  }

  const [categories, existingProducts] = await Promise.all([
    prisma.category.findMany({
      where: { user_id: userId },
      select: { id: true, name: true },
    }),
    prisma.product.findMany({
      where: { user_id: userId },
      select: { sku: true, barcode: true },
    }),
  ]);

  const availableCategoryIds = new Set(categories.map((category) => category.id));
  const existingSkus = new Set(
    existingProducts.map((product) => normalizeComparableValue(product.sku)),
  );
  const existingBarcodes = new Set(
    existingProducts
      .map((product) => valueToSanitizedString(product.barcode))
      .filter((barcode): barcode is string => Boolean(barcode))
      .map(normalizeComparableValue),
  );

  const records: Prisma.ProductCreateManyInput[] = [];
  const errors: ProductImportConfirmError[] = [];

  storedPreview.validRows.forEach((row) => {
    const normalizedSku = normalizeComparableValue(row.sku);
    const normalizedBarcode = row.barcode
      ? normalizeComparableValue(row.barcode)
      : undefined;

    if (existingSkus.has(normalizedSku)) {
      errors.push({
        rowNumber: row.rowNumber,
        message: `Skipped because SKU "${row.sku}" already exists`,
      });
      return;
    }

    if (normalizedBarcode && existingBarcodes.has(normalizedBarcode)) {
      errors.push({
        rowNumber: row.rowNumber,
        message: `Skipped because barcode "${row.barcode}" already exists`,
      });
      return;
    }

    if (row.categoryId && !availableCategoryIds.has(row.categoryId)) {
      errors.push({
        rowNumber: row.rowNumber,
        message: `Skipped because category "${row.category}" no longer exists`,
      });
      return;
    }

    existingSkus.add(normalizedSku);
    if (normalizedBarcode) {
      existingBarcodes.add(normalizedBarcode);
    }

    records.push({
      user_id: userId,
      name: row.name,
      sku: row.sku,
      barcode: row.barcode,
      price: row.price,
      cost: row.cost,
      gst_rate: row.gstRate,
      stock_on_hand: row.stock,
      reorder_level: row.reorderLevel,
      category_id: row.categoryId,
    });
  });

  if (records.length === 0) {
    productImportPreviewStore.delete(previewToken);
    return {
      importedCount: 0,
      skippedCount: errors.length,
      errors,
    };
  }

  const result = await prisma.$transaction((tx) =>
    tx.product.createMany({
      data: records,
      skipDuplicates: false,
    }),
  );

  productImportPreviewStore.delete(previewToken);

  return {
    importedCount: result.count,
    skippedCount: errors.length,
    errors,
  };
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
