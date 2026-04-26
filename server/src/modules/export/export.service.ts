import { Prisma, type PrismaClient } from "@prisma/client";
import prisma from "../../config/db.config.js";
import XLSX from "xlsx";
import { launchPuppeteerBrowser } from "../../lib/launchPuppeteerBrowser.js";
import { enqueueExportEmailDelivery } from "../../queues/jobs/export.jobs.js";
import { sendExportEmail as sendExportEmailNotification } from "../../services/email.service.js";

export type ExportResource = "products" | "customers" | "invoices";
export type ExportFormat = "csv" | "xlsx" | "pdf" | "json";
export type ExportScope = "all" | "filtered" | "selected";
export type ExportDelivery = "download" | "email";

type ExportFilters = {
  start_date?: Date;
  end_date?: Date;
  category?: string;
  payment_status?: string;
  customer_name?: string;
  search?: string;
};

export type ExportPayload = {
  resource: ExportResource;
  format: ExportFormat;
  scope: ExportScope;
  delivery: ExportDelivery;
  email?: string;
  fields: string[];
  selected_ids?: number[];
  filters?: ExportFilters;
};

type ExportResult = {
  exportedCount: number;
  fileName: string;
  contentType: string;
  content: Buffer;
};

type ExportPreviewResult = {
  totalCount: number;
  previewCount: number;
  columns: Array<{ id: string; label: string }>;
  rows: string[][];
};

type ExportFieldType = "text" | "date" | "currency" | "number";

type ExportFieldDefinition<TRecord> = {
  id: string;
  label: string;
  type: ExportFieldType;
  accessor: (record: TRecord) => unknown;
};

type ProductRecord = Prisma.ProductGetPayload<{
  include: { category: true };
}>;

type CustomerRecord = Prisma.CustomerGetPayload<{
  include: { _count: { select: { invoices: true; sales: true } } };
}>;

type InvoiceRecord = Prisma.InvoiceGetPayload<{
  include: { customer: true; items: true; payments: true };
}>;

const PRODUCT_FIELDS: ExportFieldDefinition<ProductRecord>[] = [
  { id: "id", label: "Product ID", type: "number", accessor: (record) => record.id },
  { id: "name", label: "Product Name", type: "text", accessor: (record) => record.name },
  { id: "sku", label: "SKU", type: "text", accessor: (record) => record.sku },
  { id: "barcode", label: "Barcode", type: "text", accessor: (record) => record.barcode ?? "" },
  {
    id: "category",
    label: "Category",
    type: "text",
    accessor: (record) => record.category?.name ?? "Uncategorized",
  },
  { id: "price", label: "Selling Price", type: "currency", accessor: (record) => record.price },
  { id: "cost", label: "Cost Price", type: "currency", accessor: (record) => record.cost ?? "" },
  { id: "gst_rate", label: "GST Rate", type: "number", accessor: (record) => record.gst_rate },
  {
    id: "stock_on_hand",
    label: "Opening Stock",
    type: "number",
    accessor: (record) => record.stock_on_hand,
  },
  {
    id: "reorder_level",
    label: "Reorder Level",
    type: "number",
    accessor: (record) => record.reorder_level,
  },
  {
    id: "created_at",
    label: "Created At",
    type: "date",
    accessor: (record) => record.created_at,
  },
  {
    id: "updated_at",
    label: "Updated At",
    type: "date",
    accessor: (record) => record.updated_at,
  },
];

const CUSTOMER_FIELDS: ExportFieldDefinition<CustomerRecord>[] = [
  { id: "id", label: "Customer ID", type: "number", accessor: (record) => record.id },
  { id: "name", label: "Customer Name", type: "text", accessor: (record) => record.name },
  { id: "email", label: "Email", type: "text", accessor: (record) => record.email ?? "" },
  { id: "phone", label: "Phone", type: "text", accessor: (record) => record.phone ?? "" },
  { id: "address", label: "Address", type: "text", accessor: (record) => record.address ?? "" },
  {
    id: "invoice_count",
    label: "Invoice Count",
    type: "number",
    accessor: (record) => record._count.invoices,
  },
  {
    id: "sale_count",
    label: "Sale Count",
    type: "number",
    accessor: (record) => record._count.sales,
  },
  {
    id: "created_at",
    label: "Created At",
    type: "date",
    accessor: (record) => record.created_at,
  },
  {
    id: "updated_at",
    label: "Updated At",
    type: "date",
    accessor: (record) => record.updated_at,
  },
];

const INVOICE_FIELDS: ExportFieldDefinition<InvoiceRecord>[] = [
  { id: "id", label: "Invoice ID", type: "number", accessor: (record) => record.id },
  {
    id: "invoice_number",
    label: "Invoice Number",
    type: "text",
    accessor: (record) => record.invoice_number,
  },
  {
    id: "customer_name",
    label: "Customer Name",
    type: "text",
    accessor: (record) => record.customer?.name ?? "",
  },
  {
    id: "customer_email",
    label: "Customer Email",
    type: "text",
    accessor: (record) => record.customer?.email ?? "",
  },
  { id: "status", label: "Payment Status", type: "text", accessor: (record) => record.status },
  { id: "date", label: "Invoice Date", type: "date", accessor: (record) => record.date },
  { id: "due_date", label: "Due Date", type: "date", accessor: (record) => record.due_date ?? "" },
  {
    id: "item_names",
    label: "Items",
    type: "text",
    accessor: (record) => record.items.map((item) => item.name).join(", "),
  },
  {
    id: "item_count",
    label: "Item Count",
    type: "number",
    accessor: (record) => record.items.length,
  },
  {
    id: "quantity_total",
    label: "Total Quantity",
    type: "number",
    accessor: (record) =>
      record.items.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0),
  },
  { id: "subtotal", label: "Subtotal", type: "currency", accessor: (record) => record.subtotal },
  { id: "tax", label: "Tax", type: "currency", accessor: (record) => record.tax },
  { id: "discount", label: "Discount", type: "currency", accessor: (record) => record.discount },
  { id: "total", label: "Total", type: "currency", accessor: (record) => record.total },
  {
    id: "paid_total",
    label: "Paid Amount",
    type: "currency",
    accessor: (record) =>
      record.payments.reduce(
        (sum, payment) => sum + Number(payment.amount ?? 0),
        0,
      ),
  },
  {
    id: "balance_due",
    label: "Balance Due",
    type: "currency",
    accessor: (record) => {
      const paid = record.payments.reduce(
        (sum, payment) => sum + Number(payment.amount ?? 0),
        0,
      );
      return Number(record.total ?? 0) - paid;
    },
  },
  { id: "notes", label: "Notes", type: "text", accessor: (record) => record.notes ?? "" },
  {
    id: "created_at",
    label: "Created At",
    type: "date",
    accessor: (record) => record.createdAt,
  },
];

const FIELD_CATALOG = {
  products: PRODUCT_FIELDS,
  customers: CUSTOMER_FIELDS,
  invoices: INVOICE_FIELDS,
} satisfies Record<ExportResource, ExportFieldDefinition<any>[]>;

const CONTENT_TYPES: Record<ExportFormat, string> = {
  csv: "text/csv; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
  json: "application/json; charset=utf-8",
};

const FILE_EXTENSIONS: Record<ExportFormat, string> = {
  csv: "csv",
  xlsx: "xlsx",
  pdf: "pdf",
  json: "json",
};

const EXPORT_LOG_TABLE = "export_logs";
let exportLogTableKnown: boolean | null = null;

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const normalizeDateOnly = (value: Date) => {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
};

const normalizeDateRange = (filters?: ExportFilters) => {
  const range: { gte?: Date; lte?: Date } = {};

  if (filters?.start_date) {
    range.gte = normalizeDateOnly(filters.start_date);
  }

  if (filters?.end_date) {
    const next = normalizeDateOnly(filters.end_date);
    next.setHours(23, 59, 59, 999);
    range.lte = next;
  }

  return Object.keys(range).length > 0 ? range : undefined;
};

const toNumber = (value: unknown) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatDateValue = (value: unknown) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toISOString().slice(0, 10);
};

const formatDisplayValue = (value: unknown, type: ExportFieldType) => {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  if (type === "currency") {
    const numericValue = toNumber(value);
    return numericValue === null ? "" : `INR ${numericValue.toFixed(2)}`;
  }

  if (type === "date") {
    return formatDateValue(value);
  }

  if (type === "number") {
    const numericValue = toNumber(value);
    return numericValue === null ? "" : numericValue;
  }

  return String(value);
};

const formatJsonValue = (value: unknown, type: ExportFieldType) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (type === "currency" || type === "number") {
    return toNumber(value);
  }

  if (type === "date") {
    return formatDateValue(value);
  }

  return value;
};

const buildMonthToken = (filters?: ExportFilters) => {
  const sourceDate = filters?.start_date ?? new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  });
  return formatter.format(sourceDate).replace(/\s+/g, "_");
};

const buildFileName = (
  resource: ExportResource,
  format: ExportFormat,
  filters?: ExportFilters,
) =>
  `${resource.charAt(0).toUpperCase()}${resource.slice(1)}_${buildMonthToken(filters)}.${FILE_EXTENSIONS[format]}`;

const resolveFieldDefinitions = <TRecord>(
  resource: ExportResource,
  fieldIds: string[],
) => {
  const catalog = FIELD_CATALOG[resource] as ExportFieldDefinition<TRecord>[];
  const fieldMap = new Map(catalog.map((field) => [field.id, field]));
  const fields = fieldIds
    .map((fieldId) => fieldMap.get(fieldId))
    .filter((field): field is ExportFieldDefinition<TRecord> => Boolean(field));

  if (fields.length !== fieldIds.length) {
    const unknown = fieldIds.filter((fieldId) => !fieldMap.has(fieldId));
    throw new Error(`Unsupported export fields: ${unknown.join(", ")}`);
  }

  if (fields.length === 0) {
    throw new Error("Select at least one field to export.");
  }

  return fields;
};

const serializePreviewRows = <TRecord>(
  records: TRecord[],
  fields: ExportFieldDefinition<TRecord>[],
) =>
  records.map((record) =>
    fields.map((field) =>
      String(formatDisplayValue(field.accessor(record), field.type) ?? ""),
    ),
  );

const jsonBuffer = (value: unknown) =>
  Buffer.from(JSON.stringify(value, null, 2), "utf-8");

const createWorkbookBuffer = <TRecord>(
  records: TRecord[],
  fields: ExportFieldDefinition<TRecord>[],
) => {
  const worksheetData = [
    fields.map((field) => field.label),
    ...records.map((record) =>
      fields.map((field) => {
        const rawValue = field.accessor(record);
        if (field.type === "currency" || field.type === "number") {
          const numericValue = toNumber(rawValue);
          return numericValue ?? "";
        }
        if (field.type === "date") {
          return formatDateValue(rawValue);
        }
        return rawValue ?? "";
      }),
    ),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  worksheet["!cols"] = fields.map((field) => ({
    wch: Math.max(field.label.length + 2, 16),
  }));

  records.forEach((record, rowIndex) => {
    fields.forEach((field, columnIndex) => {
      if (field.type !== "currency") return;
      const cellAddress = XLSX.utils.encode_cell({
        r: rowIndex + 1,
        c: columnIndex,
      });
      const cell = worksheet[cellAddress];
      if (cell && typeof cell.v === "number") {
        cell.t = "n";
        cell.z = '"INR" #,##0.00';
      }
    });
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Export");
  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
};

const createCsvBuffer = <TRecord>(
  records: TRecord[],
  fields: ExportFieldDefinition<TRecord>[],
) => {
  const worksheetData = [
    fields.map((field) => field.label),
    ...records.map((record) =>
      fields.map((field) => formatDisplayValue(field.accessor(record), field.type)),
    ),
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  return Buffer.from(
    XLSX.utils.sheet_to_csv(worksheet, { forceQuotes: true }),
    "utf-8",
  );
};

const createJsonBuffer = <TRecord>(
  records: TRecord[],
  fields: ExportFieldDefinition<TRecord>[],
) =>
  jsonBuffer(
    records.map((record) =>
      Object.fromEntries(
        fields.map((field) => [
          field.id,
          formatJsonValue(field.accessor(record), field.type),
        ]),
      ),
    ),
  );

const createPdfHtml = <TRecord>(
  title: string,
  businessProfile: {
    business_name?: string | null;
    address?: string | null;
    email?: string | null;
    phone?: string | null;
    logo_url?: string | null;
  } | null,
  records: TRecord[],
  fields: ExportFieldDefinition<TRecord>[],
) => {
  const rowsHtml = records
    .map(
      (record) =>
        `<tr>${fields
          .map(
            (field) =>
              `<td>${escapeHtml(
                formatDisplayValue(field.accessor(record), field.type),
              )}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");

  const companyName = businessProfile?.business_name || "BillSutra";
  const contactLines = [
    businessProfile?.address,
    businessProfile?.email,
    businessProfile?.phone,
  ].filter(Boolean);

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body {
          font-family: Arial, sans-serif;
          color: #1f2937;
          margin: 0;
          padding: 0;
          font-size: 12px;
        }
        .page {
          padding: 24px 28px 40px;
        }
        .header {
          display: flex;
          justify-content: space-between;
          gap: 24px;
          align-items: flex-start;
          margin-bottom: 20px;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 16px;
        }
        .logo {
          max-height: 56px;
          max-width: 120px;
          object-fit: contain;
          margin-bottom: 8px;
        }
        h1 {
          margin: 0 0 4px;
          font-size: 22px;
        }
        .subtle {
          color: #6b7280;
          line-height: 1.5;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        th, td {
          border: 1px solid #e5e7eb;
          padding: 8px 10px;
          text-align: left;
          vertical-align: top;
        }
        th {
          background: #f3f4f6;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        tbody tr:nth-child(even) {
          background: #fafafa;
        }
      </style>
    </head>
    <body>
      <div class="page">
        <div class="header">
          <div>
            ${
              businessProfile?.logo_url
                ? `<img class="logo" src="${escapeHtml(businessProfile.logo_url)}" alt="${escapeHtml(companyName)} logo" />`
                : ""
            }
            <h1>${escapeHtml(title)}</h1>
            <div class="subtle">Generated by BillSutra</div>
          </div>
          <div class="subtle">
            <strong>${escapeHtml(companyName)}</strong><br />
            ${contactLines.map((line) => `${escapeHtml(line)}<br />`).join("")}
          </div>
        </div>
        <table>
          <thead>
            <tr>${fields
              .map((field) => `<th>${escapeHtml(field.label)}</th>`)
              .join("")}</tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    </body>
  </html>`;
};

const createPdfBuffer = async <TRecord>(
  resource: ExportResource,
  businessProfile: {
    business_name?: string | null;
    address?: string | null;
    email?: string | null;
    phone?: string | null;
    logo_url?: string | null;
  } | null,
  records: TRecord[],
  fields: ExportFieldDefinition<TRecord>[],
) => {
  const browser = await launchPuppeteerBrowser();

  try {
    const page = await browser.newPage();
    await page.setContent(
      createPdfHtml(
        `${resource.charAt(0).toUpperCase()}${resource.slice(1)} Export`,
        businessProfile,
        records,
        fields,
      ),
      { waitUntil: "networkidle0" },
    );

    return (await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate:
        '<div style="font-size:10px;color:#6b7280;width:100%;text-align:center;padding-top:8px;">BillSutra export report</div>',
      footerTemplate:
        '<div style="font-size:10px;color:#6b7280;width:100%;padding:0 24px 8px;display:flex;justify-content:space-between;"><span>Generated from BillSutra</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>',
      margin: {
        top: "56px",
        right: "24px",
        bottom: "48px",
        left: "24px",
      },
    })) as Buffer;
  } finally {
    await browser.close();
  }
};

const buildProductWhere = (userId: number, payload: ExportPayload) => {
  const where: Prisma.ProductWhereInput = { user_id: userId };

  if (payload.scope === "selected") {
    if (!payload.selected_ids?.length) {
      throw new Error("Select at least one product to export.");
    }
    where.id = { in: payload.selected_ids };
    return where;
  }

  if (payload.scope !== "filtered") {
    return where;
  }

  const filters = payload.filters;
  const createdAt = normalizeDateRange(filters);
  if (createdAt) {
    where.created_at = createdAt;
  }

  if (filters?.category?.trim()) {
    const category = filters.category.trim();
    const parsedCategoryId = Number(category);
    if (Number.isInteger(parsedCategoryId) && parsedCategoryId > 0) {
      where.category_id = parsedCategoryId;
    } else {
      where.category = {
        name: {
          equals: category,
          mode: "insensitive",
        },
      };
    }
  }

  const search = filters?.search?.trim();
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { sku: { contains: search, mode: "insensitive" } },
      { barcode: { contains: search, mode: "insensitive" } },
    ];
  }

  return where;
};

const buildCustomerWhere = (userId: number, payload: ExportPayload) => {
  const where: Prisma.CustomerWhereInput = { user_id: userId };

  if (payload.scope === "selected") {
    if (!payload.selected_ids?.length) {
      throw new Error("Select at least one customer to export.");
    }
    where.id = { in: payload.selected_ids };
    return where;
  }

  if (payload.scope !== "filtered") {
    return where;
  }

  const filters = payload.filters;
  const createdAt = normalizeDateRange(filters);
  if (createdAt) {
    where.created_at = createdAt;
  }

  const search = filters?.customer_name?.trim() || filters?.search?.trim();
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
    ];
  }

  return where;
};

const buildInvoiceWhere = (userId: number, payload: ExportPayload) => {
  const where: Prisma.InvoiceWhereInput = { user_id: userId };

  if (payload.scope === "selected") {
    if (!payload.selected_ids?.length) {
      throw new Error("Select at least one invoice to export.");
    }
    where.id = { in: payload.selected_ids };
    return where;
  }

  if (payload.scope !== "filtered") {
    return where;
  }

  const filters = payload.filters;
  const issueDate = normalizeDateRange(filters);
  if (issueDate) {
    where.date = issueDate;
  }

  const paymentStatus = filters?.payment_status?.trim();
  if (paymentStatus) {
    where.status = paymentStatus.toUpperCase() as any;
  }

  const customerName = filters?.customer_name?.trim();
  if (customerName) {
    where.customer = {
      name: {
        contains: customerName,
        mode: "insensitive",
      },
    };
  }

  const search = filters?.search?.trim();
  if (search) {
    where.OR = [
      { invoice_number: { contains: search, mode: "insensitive" } },
      {
        customer: {
          name: { contains: search, mode: "insensitive" },
        },
      },
    ];
  }

  return where;
};

const fetchRecords = async (userId: number, payload: ExportPayload) => {
  if (payload.resource === "products") {
    return prisma.product.findMany({
      where: buildProductWhere(userId, payload),
      include: { category: true },
      orderBy: { created_at: "desc" },
    });
  }

  if (payload.resource === "customers") {
    return prisma.customer.findMany({
      where: buildCustomerWhere(userId, payload),
      include: {
        _count: {
          select: {
            invoices: true,
            sales: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
    });
  }

  return prisma.invoice.findMany({
    where: buildInvoiceWhere(userId, payload),
    include: {
      customer: true,
      items: true,
      payments: true,
    },
    orderBy: { createdAt: "desc" },
  });
};

const fetchPreviewRecords = async (
  userId: number,
  payload: ExportPayload,
  previewLimit = 5,
) => {
  if (payload.resource === "products") {
    const where = buildProductWhere(userId, payload);
    const [records, totalCount] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        include: { category: true },
        orderBy: { created_at: "desc" },
        take: previewLimit,
      }),
      prisma.product.count({ where }),
    ]);

    return { records, totalCount };
  }

  if (payload.resource === "customers") {
    const where = buildCustomerWhere(userId, payload);
    const [records, totalCount] = await prisma.$transaction([
      prisma.customer.findMany({
        where,
        include: {
          _count: {
            select: {
              invoices: true,
              sales: true,
            },
          },
        },
        orderBy: { created_at: "desc" },
        take: previewLimit,
      }),
      prisma.customer.count({ where }),
    ]);

    return { records, totalCount };
  }

  const where = buildInvoiceWhere(userId, payload);
  const [records, totalCount] = await prisma.$transaction([
    prisma.invoice.findMany({
      where,
      include: {
        customer: true,
        items: true,
        payments: true,
      },
      orderBy: { createdAt: "desc" },
      take: previewLimit,
    }),
    prisma.invoice.count({ where }),
  ]);

  return { records, totalCount };
};

const countExportRecords = async (
  userId: number,
  payload: Pick<ExportPayload, "resource" | "scope" | "selected_ids" | "filters" | "fields">,
) => {
  const { totalCount } = await fetchPreviewRecords(
    userId,
    {
      resource: payload.resource,
      scope: payload.scope,
      fields: payload.fields,
      selected_ids: payload.selected_ids,
      filters: payload.filters,
      format: "json",
      delivery: "download",
    },
    1,
  );

  return totalCount;
};

const getBusinessProfile = (userId: number) =>
  prisma.businessProfile.findUnique({
    where: { user_id: userId },
    select: {
      business_name: true,
      address: true,
      email: true,
      phone: true,
      logo_url: true,
    },
  });

const buildDownload = async <TRecord>(
  payload: ExportPayload,
  businessProfile: Awaited<ReturnType<typeof getBusinessProfile>>,
  records: TRecord[],
  fields: ExportFieldDefinition<TRecord>[],
): Promise<ExportResult> => {
  if (payload.format === "xlsx") {
    return {
      exportedCount: records.length,
      fileName: buildFileName(payload.resource, payload.format, payload.filters),
      contentType: CONTENT_TYPES[payload.format],
      content: createWorkbookBuffer(records, fields),
    };
  }

  if (payload.format === "csv") {
    return {
      exportedCount: records.length,
      fileName: buildFileName(payload.resource, payload.format, payload.filters),
      contentType: CONTENT_TYPES[payload.format],
      content: createCsvBuffer(records, fields),
    };
  }

  if (payload.format === "json") {
    return {
      exportedCount: records.length,
      fileName: buildFileName(payload.resource, payload.format, payload.filters),
      contentType: CONTENT_TYPES[payload.format],
      content: createJsonBuffer(records, fields),
    };
  }

  return {
    exportedCount: records.length,
    fileName: buildFileName(payload.resource, payload.format, payload.filters),
    contentType: CONTENT_TYPES[payload.format],
    content: await createPdfBuffer(payload.resource, businessProfile, records, fields),
  };
};

const isExportLogTableAvailable = async (client: PrismaClient) => {
  if (exportLogTableKnown !== null) {
    return exportLogTableKnown;
  }

  const rows = await client.$queryRaw<Array<{ exists: boolean }>>(Prisma.sql`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ${EXPORT_LOG_TABLE}
    ) AS "exists"
  `);

  exportLogTableKnown = rows[0]?.exists === true;
  return exportLogTableKnown;
};

const logExport = async (
  client: PrismaClient,
  authUser: { id: number; actorId?: string },
  payload: ExportPayload,
  exportedCount: number,
) => {
  try {
    const hasTable = await isExportLogTableAvailable(client);
    if (!hasTable) {
      return;
    }

    await client.exportLog.create({
      data: {
        user_id: authUser.id,
        actor_id: authUser.actorId ?? `owner:${authUser.id}`,
        resource: payload.resource,
        format: payload.format,
        scope: payload.scope,
        delivery: payload.delivery,
        email: payload.delivery === "email" ? payload.email : undefined,
        filters: payload.filters ? (payload.filters as Prisma.JsonObject) : undefined,
        selected_count: payload.selected_ids?.length ?? 0,
        exported_count: exportedCount,
      },
    });
  } catch (error) {
    console.warn("[exports.log] unable to persist export log", error);
  }
};

export const executeQueuedExportEmail = async (
  authUser: { id: number; email?: string; actorId?: string },
  payload: ExportPayload,
) => {
  const recipientEmail = payload.email?.trim() || authUser.email?.trim();
  if (!recipientEmail) {
    throw new Error("A destination email address is required.");
  }

  const records = await fetchRecords(authUser.id, payload);
  const fields = resolveFieldDefinitions<any>(payload.resource, payload.fields);
  const businessProfile = await getBusinessProfile(authUser.id);
  const result = await buildDownload(payload, businessProfile, records, fields);

  await logExport(prisma, authUser, payload, result.exportedCount);

  await sendExportEmailNotification({
    userId: authUser.id,
    recipientEmail,
    recipientName: authUser.actorId ?? `User ${authUser.id}`,
    fileName: result.fileName,
    contentType: result.contentType,
    content: result.content,
    payload,
    exportedCount: result.exportedCount,
  });

  return {
    delivery: "email" as const,
    exportedCount: result.exportedCount,
    email: recipientEmail,
    fileName: result.fileName,
  };
};

export const executeExport = async (
  authUser: { id: number; email?: string; actorId?: string },
  payload: ExportPayload,
) => {
  if (payload.delivery === "email") {
    const recipientEmail = payload.email?.trim() || authUser.email?.trim();
    if (!recipientEmail) {
      throw new Error("A destination email address is required.");
    }

    const normalizedPayload: ExportPayload = {
      ...payload,
      email: recipientEmail,
      delivery: "email",
    };

    const queued = await enqueueExportEmailDelivery({
      userId: authUser.id,
      actorId: authUser.actorId,
      email: recipientEmail,
      payload: normalizedPayload,
    });

    if (queued.queued) {
      const exportedCount = await countExportRecords(authUser.id, normalizedPayload);

      return {
        delivery: "email" as const,
        exportedCount,
        email: recipientEmail,
        fileName: buildFileName(
          normalizedPayload.resource,
          normalizedPayload.format,
          normalizedPayload.filters,
        ),
      };
    }

    return executeQueuedExportEmail(authUser, normalizedPayload);
  }

  const records = await fetchRecords(authUser.id, payload);
  const fields = resolveFieldDefinitions<any>(payload.resource, payload.fields);
  const businessProfile = await getBusinessProfile(authUser.id);
  const result = await buildDownload(payload, businessProfile, records, fields);

  await logExport(prisma, authUser, payload, result.exportedCount);

  return {
    delivery: "download" as const,
    ...result,
  };
};

export const previewExport = async (
  authUser: { id: number },
  payload: Pick<ExportPayload, "resource" | "scope" | "fields" | "selected_ids" | "filters">,
): Promise<ExportPreviewResult> => {
  const fields = resolveFieldDefinitions<any>(payload.resource, payload.fields);
  const { records, totalCount } = await fetchPreviewRecords(authUser.id, {
    resource: payload.resource,
    scope: payload.scope,
    fields: payload.fields,
    selected_ids: payload.selected_ids,
    filters: payload.filters,
    format: "json",
    delivery: "download",
  });

  return {
    totalCount,
    previewCount: records.length,
    columns: fields.map((field) => ({
      id: field.id,
      label: field.label,
    })),
    rows: serializePreviewRows(records, fields),
  };
};
