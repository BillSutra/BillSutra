import { z } from "zod";
import {
  InvoiceStatus,
  PaymentMethod,
  SaleStatus,
  StockReason,
  WorkerRole,
} from "@prisma/client";

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const invoiceIdParamSchema = z.object({
  invoiceId: z.coerce.number().int().positive(),
});

export const categoryCreateSchema = z.object({
  name: z.string().min(2),
});

export const categoryUpdateSchema = categoryCreateSchema.partial();

export const supplierCreateSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional(),
  phone: z.string().min(6).optional(),
  address: z.string().optional(),
});

export const supplierUpdateSchema = supplierCreateSchema.partial();

export const customerCreateSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional(),
  phone: z.string().min(6).optional(),
  address: z.string().optional(),
});

export const customerUpdateSchema = customerCreateSchema.partial();

export const authLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const authOauthSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).optional(),
  provider: z.string().min(2).optional(),
  oauth_id: z.string().min(1).optional(),
  image: z.string().url().optional(),
});

export const authRegisterSchema = z
  .object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6),
    confirm_password: z.string().min(6),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

export const authForgotSchema = z.object({
  email: z.string().email(),
});

export const authResetSchema = z
  .object({
    email: z.string().email(),
    token: z.string().min(10),
    password: z.string().min(6),
    confirm_password: z.string().min(6),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

export const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const workerLoginSchema = authLoginSchema;

export const workerCreateSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().regex(/^\d{10,15}$/),
  password: z.string().min(6),
});

export const workerUpdateSchema = z
  .object({
    name: z.string().min(2).optional(),
    phone: z.string().regex(/^\d{10,15}$/).optional(),
    password: z.string().min(6).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const workerRoleSchema = z.object({
  role: z.nativeEnum(WorkerRole),
});

export const workerIdParamSchema = z.object({
  id: z.string().min(1),
});

export const adminBusinessIdParamSchema = z.object({
  id: z.string().min(1),
});

export const userProfileUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
});

export const userPasswordUpdateSchema = z
  .object({
    current_password: z.string().min(6),
    password: z.string().min(6),
    confirm_password: z.string().min(6),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
};

const optionalTrimmedString = z.preprocess(
  emptyToUndefined,
  z.string().optional(),
);
const optionalEmailString = z.preprocess(
  emptyToUndefined,
  z.string().email().optional(),
);
const optionalUrlString = z.preprocess(
  emptyToUndefined,
  z.string().url().optional(),
);

export const businessProfileUpsertSchema = z.object({
  business_name: z.string().min(2),
  address: optionalTrimmedString,
  phone: optionalTrimmedString,
  email: optionalEmailString,
  website: optionalTrimmedString,
  logo_url: optionalUrlString,
  tax_id: optionalTrimmedString,
  currency: z.string().min(1),
  show_logo_on_invoice: z.boolean().optional(),
  show_tax_number: z.boolean().optional(),
  show_payment_qr: z.boolean().optional(),
});

export const userTemplateUpsertSchema = z.object({
  template_id: z.coerce.number().int().positive(),
  enabled_sections: z.array(z.string().min(1)).min(1),
  theme_color: z.string().optional(),
  section_order: z.array(z.string().min(1)).min(1),
  design_config: z.record(z.string(), z.unknown()).optional(),
});

export const userSavedTemplateCreateSchema = z.object({
  name: z.string().min(2).max(191),
  base_template_id: z.coerce.number().int().positive().optional(),
  enabled_sections: z.array(z.string().min(1)).min(1),
  section_order: z.array(z.string().min(1)).min(1),
  theme_color: z.string().optional(),
  design_config: z.record(z.string(), z.unknown()).optional(),
});

export const userSavedTemplateUpdateSchema = z
  .object({
    name: z.string().min(2).max(191).optional(),
    base_template_id: z.coerce.number().int().positive().optional(),
    enabled_sections: z.array(z.string().min(1)).min(1).optional(),
    section_order: z.array(z.string().min(1)).min(1).optional(),
    theme_color: z.string().optional(),
    design_config: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const productCreateSchema = z.object({
  name: z.string().min(2),
  sku: z.string().min(1),
  price: z.coerce.number().nonnegative(),
  cost: z.coerce.number().nonnegative().optional(),
  barcode: z.string().min(1).optional(),
  gst_rate: z.coerce.number().nonnegative().optional(),
  stock_on_hand: z.coerce.number().int().optional(),
  reorder_level: z.coerce.number().int().optional(),
  category_id: z.coerce.number().int().positive().optional(),
});

export const productUpdateSchema = productCreateSchema.partial();

export const productImportConfirmSchema = z.object({
  preview_token: z.string().min(1),
});

const invoiceItemSchema = z.object({
  product_id: z.coerce.number().int().positive().optional(),
  name: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  price: z.coerce.number().nonnegative(),
  tax_rate: z.coerce.number().nonnegative().optional(),
});

export const invoiceCreateSchema = z.object({
  customer_id: z.coerce.number().int().positive(),
  date: z.coerce.date().optional(),
  due_date: z.coerce.date().optional(),
  discount: z.coerce.number().nonnegative().optional(),
  discount_type: z.enum(["PERCENTAGE", "FIXED"]).optional(),
  status: z.nativeEnum(InvoiceStatus).optional(),
  notes: z.string().optional(),
  sync_sales: z.boolean().optional(),
  warehouse_id: z.coerce.number().int().positive().optional(),
  items: z.array(invoiceItemSchema).min(1),
});

export const invoiceUpdateSchema = z.object({
  status: z.nativeEnum(InvoiceStatus).optional(),
  due_date: z.coerce.date().optional(),
  notes: z.string().optional(),
});

export const paymentCreateSchema = z.object({
  invoice_id: z.coerce.number().int().positive(),
  amount: z.coerce.number().nonnegative(),
  method: z.nativeEnum(PaymentMethod).optional(),
  provider: z.string().min(1).max(120).optional(),
  transaction_id: z.string().min(1).max(191).optional(),
  reference: z.string().optional(),
  paid_at: z.coerce.date().optional(),
});

const purchaseItemSchema = z.object({
  product_id: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive(),
  unit_cost: z.coerce.number().nonnegative(),
  tax_rate: z.coerce.number().nonnegative().optional(),
});

export const purchaseCreateSchema = z.object({
  supplier_id: z.coerce.number().int().positive().optional(),
  warehouse_id: z.coerce.number().int().positive().optional(),
  purchase_date: z.coerce.date().optional(),
  payment_status: z.enum(["UNPAID", "PARTIALLY_PAID", "PAID"]).optional(),
  amount_paid: z.coerce.number().nonnegative().optional(),
  payment_date: z.coerce.date().optional(),
  payment_method: z.nativeEnum(PaymentMethod).optional(),
  notes: z.string().optional(),
  items: z.array(purchaseItemSchema).min(1),
});

export const purchaseUpdateSchema = z.object({
  supplier_id: z.coerce.number().int().positive().optional(),
  warehouse_id: z.coerce.number().int().positive().optional(),
  purchase_date: z.coerce.date().optional(),
  payment_status: z.enum(["UNPAID", "PARTIALLY_PAID", "PAID"]).optional(),
  amount_paid: z.coerce.number().nonnegative().optional(),
  payment_date: z.coerce.date().optional(),
  payment_method: z.nativeEnum(PaymentMethod).optional(),
  notes: z.string().optional(),
  items: z.array(purchaseItemSchema).min(1),
});

const saleItemSchema = z.object({
  product_id: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive(),
  unit_price: z.coerce.number().nonnegative(),
  tax_rate: z.coerce.number().nonnegative().optional(),
});

export const saleCreateSchema = z.object({
  customer_id: z.coerce.number().int().positive().optional(),
  warehouse_id: z.coerce.number().int().positive().optional(),
  sale_date: z.coerce.date().optional(),
  status: z.nativeEnum(SaleStatus).optional(),
  payment_status: z.enum(["UNPAID", "PARTIALLY_PAID", "PAID"]).optional(),
  amount_paid: z.coerce.number().nonnegative().optional(),
  payment_date: z.coerce.date().optional(),
  payment_method: z.nativeEnum(PaymentMethod).optional(),
  notes: z.string().optional(),
  items: z.array(saleItemSchema).min(1),
});

export const saleUpdateSchema = z.object({
  status: z.nativeEnum(SaleStatus).optional(),
  payment_status: z.enum(["UNPAID", "PARTIALLY_PAID", "PAID"]).optional(),
  amount_paid: z.coerce.number().nonnegative().optional(),
  payment_date: z.coerce.date().optional(),
  payment_method: z.nativeEnum(PaymentMethod).optional(),
  notes: z.string().optional(),
});

export const warehouseCreateSchema = z.object({
  name: z.string().min(2),
  location: z.string().optional(),
});

export const warehouseUpdateSchema = warehouseCreateSchema.partial();

export const inventoryQuerySchema = z.object({
  warehouse_id: z.coerce.number().int().positive().optional(),
});

export const inventoryAdjustSchema = z.object({
  warehouse_id: z.coerce.number().int().positive(),
  product_id: z.coerce.number().int().positive(),
  change: z.coerce.number().int(),
  reason: z.nativeEnum(StockReason).optional(),
  note: z.string().optional(),
});

export const stockAdjustSchema = z.object({
  product_id: z.coerce.number().int().positive(),
  warehouse_id: z.coerce.number().int().positive().optional(),
  change: z.coerce.number().int(),
  reason: z.nativeEnum(StockReason).optional(),
  note: z.string().optional(),
});
