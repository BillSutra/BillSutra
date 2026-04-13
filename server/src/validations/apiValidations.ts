import { z } from "zod";
import {
  InvoiceStatus,
  PaymentMethod,
  SaleStatus,
  StockReason,
  WorkerRole,
} from "@prisma/client";
import { normalizeIndianState } from "../lib/indianAddress.js";
import { getStateFromGstin, normalizeGstin } from "../lib/gstin.js";

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const publicInvoiceParamSchema = z.object({
  id: z.string().trim().min(1).max(64),
});

export const publicInvoiceQuerySchema = z.object({
  format: z.enum(["json", "html"]).optional(),
});

export const pincodeLookupParamSchema = z.object({
  pincode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Pincode must be exactly 6 digits"),
});

export const invoiceIdParamSchema = z.object({
  invoiceId: z.coerce.number().int().positive(),
});

export const categoryCreateSchema = z.object({
  name: z.string().min(2),
});

export const categoryUpdateSchema = categoryCreateSchema.partial();

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

const webAuthnRegistrationResponseSchema = z.object({
  id: z.string().min(1),
  rawId: z.string().min(1),
  type: z.literal("public-key"),
  authenticatorAttachment: z.string().optional(),
  clientExtensionResults: z.record(z.string(), z.unknown()),
  response: z.object({
    clientDataJSON: z.string().min(1),
    attestationObject: z.string().min(1),
    transports: z.array(z.string()).optional(),
    publicKeyAlgorithm: z.number().optional(),
    publicKey: z.string().optional(),
    authenticatorData: z.string().optional(),
  }),
});

const webAuthnAuthenticationResponseSchema = z.object({
  id: z.string().min(1),
  rawId: z.string().min(1),
  type: z.literal("public-key"),
  authenticatorAttachment: z.string().optional(),
  clientExtensionResults: z.record(z.string(), z.unknown()),
  response: z.object({
    clientDataJSON: z.string().min(1),
    authenticatorData: z.string().min(1),
    signature: z.string().min(1),
    userHandle: z.string().optional(),
  }),
});

export const authTokenSchema = z.object({
  token: z.string().min(10),
});

export const authOtpSendSchema = z.object({
  email: z.string().email(),
});

export const authOtpVerifySchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/, "OTP must be 6 digits"),
});

export const passkeyAuthenticateOptionsSchema = z.object({
  email: z.string().email(),
});

export const passkeyAuthenticateVerifySchema = z.object({
  email: z.string().email(),
  challenge_id: z.coerce.number().int().positive(),
  response: webAuthnAuthenticationResponseSchema,
});

export const passkeyRegisterOptionsSchema = z.object({
  label: z.string().min(1).max(191).optional(),
});

export const passkeyRegisterVerifySchema = z.object({
  challenge_id: z.coerce.number().int().positive(),
  label: z.string().min(1).max(191).optional(),
  response: webAuthnRegistrationResponseSchema,
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

export const accessPlanSchema = z.enum(["pro", "pro-plus"]);
export const accessBillingCycleSchema = z.enum(["monthly", "yearly"]);

export const workerLoginSchema = authLoginSchema;

const workerAccessRoleSchema = z.enum([
  "ADMIN",
  "SALESPERSON",
  "STAFF",
  "VIEWER",
]);
const workerStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);
const workerIncentiveTypeSchema = z.enum(["NONE", "PERCENTAGE", "PER_SALE"]);

const nullableDateInput = z
  .union([z.string(), z.date(), z.null(), z.undefined()])
  .transform((value) => {
    if (!value) return undefined;
    const parsed = value instanceof Date ? value : new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  });

export const workerCreateSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().regex(/^\d{10,15}$/),
  password: z.string().min(6),
  accessRole: workerAccessRoleSchema.optional(),
  status: workerStatusSchema.optional(),
  joiningDate: nullableDateInput.optional(),
  incentiveType: workerIncentiveTypeSchema.optional(),
  incentiveValue: z.coerce.number().min(0).optional(),
});

export const workerUpdateSchema = z
  .object({
    name: z.string().min(2).optional(),
    email: z.string().email().optional(),
    phone: z
      .string()
      .regex(/^\d{10,15}$/)
      .optional(),
    password: z.string().min(6).optional(),
    accessRole: workerAccessRoleSchema.optional(),
    status: workerStatusSchema.optional(),
    joiningDate: nullableDateInput.optional(),
    incentiveType: workerIncentiveTypeSchema.optional(),
    incentiveValue: z.coerce.number().min(0).optional(),
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

const requiredIndianStateString = z
  .string()
  .trim()
  .min(2)
  .refine((value) => Boolean(normalizeIndianState(value)), {
    message: "State must be a valid Indian state",
  })
  .transform((value) => normalizeIndianState(value) as string);

const requiredIndianPincodeString = z
  .string()
  .transform((value) => value.replace(/\D/g, ""))
  .refine((value) => /^\d{6}$/.test(value), {
    message: "Pincode must be exactly 6 digits",
  });

const optionalIndianStateString = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .trim()
    .optional()
    .refine(
      (value) => value === undefined || Boolean(normalizeIndianState(value)),
      {
        message: "State must be a valid Indian state",
      },
    )
    .transform((value) =>
      value === undefined ? undefined : (normalizeIndianState(value) as string),
    ),
);

const optionalIndianPincodeString = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .transform((value) => value.replace(/\D/g, ""))
    .optional()
    .refine((value) => value === undefined || /^\d{6}$/.test(value), {
      message: "Pincode must be exactly 6 digits",
    }),
);

const optionalAddressLineString = z.preprocess(
  emptyToUndefined,
  z.string().trim().min(2).max(191).optional(),
);

const optionalPhoneString = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .transform((value) => value.replace(/\D/g, ""))
    .optional()
    .refine((value) => value === undefined || /^\d{10}$/.test(value), {
      message: "Phone number must be exactly 10 digits",
    }),
);

const optionalGstinString = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .transform((value) => normalizeGstin(value))
    .optional()
    .refine(
      (value) =>
        value === undefined ||
        /^(0[1-9]|[12][0-9]|3[0-8])[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(
          value,
        ),
      {
        message: "GSTIN format is invalid",
      },
    ),
);

const optionalDecimalAmount = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : value;
  }

  return value;
}, z.number().finite().optional());

const requiredPhoneString = z.preprocess(
  (value) => (typeof value === "string" ? value : String(value ?? "")),
  z
    .string()
    .transform((value) => value.replace(/\D/g, ""))
    .refine((value) => /^\d{10}$/.test(value), {
      message: "Phone number must be exactly 10 digits",
    }),
);

const optionalPanString = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .transform((value) => value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
    .optional()
    .refine(
      (value) => value === undefined || /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(value),
      {
        message: "PAN format is invalid",
      },
    ),
);

const normalizeSupplierCategories = (items: string[]) => {
  const unique: string[] = [];
  const seen = new Set<string>();

  items.forEach((entry) => {
    const normalized = entry.replace(/\s+/g, " ").trim();
    if (!normalized) {
      return;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    unique.push(normalized.slice(0, 60));
  });

  return unique;
};

const optionalSupplierCategories = z
  .preprocess(
    (value) => {
      if (value === undefined || value === null || value === "") {
        return undefined;
      }

      if (Array.isArray(value)) {
        return value;
      }

      if (typeof value === "string") {
        return value.split(",");
      }

      return value;
    },
    z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  )
  .transform((value) =>
    value === undefined ? undefined : normalizeSupplierCategories(value),
  );

const supplierAddressSchema = z.object({
  addressLine1: optionalAddressLineString,
  city: optionalAddressLineString,
  state: optionalIndianStateString,
  pincode: optionalIndianPincodeString,
});

const supplierPaymentTermsSchema = z.enum(["NET_7", "NET_15", "NET_30"]);

const supplierBaseSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2)
    .max(191)
    .regex(/^[\p{L}\p{M}\s.'-]+$/u, {
      message: "Name can only contain letters, spaces, and common punctuation",
    }),
  phone: optionalPhoneString,
  email: optionalEmailString,
  categories: optionalSupplierCategories,
  businessName: optionalAddressLineString,
  business_name: optionalAddressLineString,
  gstin: optionalGstinString,
  pan: optionalPanString,
  supplierAddress: supplierAddressSchema.optional(),
  address: optionalTrimmedString,
  address_line1: optionalAddressLineString,
  city: optionalAddressLineString,
  state: optionalIndianStateString,
  pincode: optionalIndianPincodeString,
  paymentTerms: supplierPaymentTermsSchema.optional(),
  payment_terms: supplierPaymentTermsSchema.optional(),
  openingBalance: optionalDecimalAmount,
  opening_balance: optionalDecimalAmount,
  notes: z.preprocess(emptyToUndefined, z.string().trim().max(500).optional()),
});

const addSupplierSchemaRules = <
  T extends z.ZodObject<Record<string, z.ZodTypeAny>>,
>(
  schema: T,
  options: {
    requirePhone?: boolean;
  } = {},
) =>
  schema.superRefine((value, ctx) => {
    if (options.requirePhone && !value.phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phone"],
        message: "Phone number is required",
      });
    }

    const supplierAddress = {
      addressLine1: value.supplierAddress?.addressLine1 ?? value.address_line1,
      city: value.supplierAddress?.city ?? value.city,
      state: value.supplierAddress?.state ?? value.state,
      pincode: value.supplierAddress?.pincode ?? value.pincode,
    };

    const hasAnyAddressField = Boolean(
      supplierAddress.addressLine1 ||
      supplierAddress.city ||
      supplierAddress.state ||
      supplierAddress.pincode,
    );

    if (hasAnyAddressField) {
      if (!supplierAddress.addressLine1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["address_line1"],
          message: "Address line 1 is required",
        });
      }

      if (!supplierAddress.city) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["city"],
          message: "City is required",
        });
      }

      if (!supplierAddress.state) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["state"],
          message: "State is required",
        });
      }

      if (!supplierAddress.pincode) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["pincode"],
          message: "Pincode is required",
        });
      }
    }

    const gstin = value.gstin;
    if (gstin && supplierAddress.state) {
      const gstinState = getStateFromGstin(gstin);
      const normalizedState = normalizeIndianState(supplierAddress.state);

      if (gstinState && normalizedState && gstinState !== normalizedState) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["gstin"],
          message: "GSTIN state code does not match the selected state",
        });
      }
    }

    const openingBalance = value.openingBalance ?? value.opening_balance;
    if (openingBalance !== undefined && openingBalance < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["openingBalance"],
        message: "Opening balance cannot be negative",
      });
    }
  });

export const supplierCreateSchema = addSupplierSchemaRules(
  supplierBaseSchema.extend({
    phone: requiredPhoneString,
  }),
  {
    requirePhone: true,
  },
);

export const supplierUpdateSchema = addSupplierSchemaRules(
  supplierBaseSchema.partial(),
);

const customerAddressSchema = z.object({
  addressLine1: optionalAddressLineString,
  city: optionalAddressLineString,
  state: optionalIndianStateString,
  pincode: optionalIndianPincodeString,
});

const customerTypeSchema = z.enum(["individual", "business"]);

const customerPaymentTermsSchema = z.enum([
  "DUE_ON_RECEIPT",
  "NET_7",
  "NET_15",
  "NET_30",
]);

const customerBaseSchema = z.object({
  type: customerTypeSchema.optional(),
  customer_type: customerTypeSchema.optional(),
  name: z
    .string()
    .trim()
    .min(2)
    .max(191)
    .regex(/^[\p{L}\p{M}\s.'-]+$/u, {
      message: "Name can only contain letters, spaces, and common punctuation",
    }),
  email: optionalEmailString,
  phone: optionalPhoneString,
  businessName: optionalAddressLineString,
  business_name: optionalAddressLineString,
  gstin: optionalGstinString,
  customerAddress: customerAddressSchema.optional(),
  address: optionalTrimmedString,
  address_line1: optionalAddressLineString,
  city: optionalAddressLineString,
  state: optionalIndianStateString,
  pincode: optionalIndianPincodeString,
  notes: z.preprocess(emptyToUndefined, z.string().trim().max(500).optional()),
  creditLimit: optionalDecimalAmount,
  credit_limit: optionalDecimalAmount,
  paymentTerms: customerPaymentTermsSchema.optional(),
  payment_terms: customerPaymentTermsSchema.optional(),
  openingBalance: optionalDecimalAmount,
  opening_balance: optionalDecimalAmount,
});

const addCustomerSchemaRules = <
  T extends z.ZodObject<Record<string, z.ZodTypeAny>>,
>(
  schema: T,
  options: {
    requirePhone?: boolean;
    requireBusinessName?: boolean;
  } = {},
) =>
  schema.superRefine((value, ctx) => {
    const customerType = value.type ?? value.customer_type ?? "individual";

    if (options.requirePhone && !value.phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phone"],
        message: "Phone number is required",
      });
    }

    if (options.requireBusinessName && customerType === "business") {
      const businessName = value.businessName ?? value.business_name;
      if (!businessName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["businessName"],
          message: "Business name is required for business customers",
        });
      }
    }

    const customerAddress = {
      addressLine1: value.customerAddress?.addressLine1 ?? value.address_line1,
      city: value.customerAddress?.city ?? value.city,
      state: value.customerAddress?.state ?? value.state,
      pincode: value.customerAddress?.pincode ?? value.pincode,
    };

    const hasAnyAddressField = Boolean(
      customerAddress.addressLine1 ||
      customerAddress.city ||
      customerAddress.state ||
      customerAddress.pincode,
    );

    if (hasAnyAddressField) {
      if (!customerAddress.addressLine1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["address_line1"],
          message: "Address line 1 is required",
        });
      }

      if (!customerAddress.city) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["city"],
          message: "City is required",
        });
      }

      if (!customerAddress.state) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["state"],
          message: "State is required",
        });
      }

      if (!customerAddress.pincode) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["pincode"],
          message: "Pincode is required",
        });
      }
    }

    const gstin = value.gstin;
    if (gstin && customerAddress.state) {
      const gstinState = getStateFromGstin(gstin);
      const normalizedState = normalizeIndianState(customerAddress.state);

      if (gstinState && normalizedState && gstinState !== normalizedState) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["gstin"],
          message: "GSTIN state code does not match the selected state",
        });
      }
    }
  });

export const customerCreateSchema = addCustomerSchemaRules(customerBaseSchema, {
  requirePhone: true,
  requireBusinessName: true,
});

export const customerUpdateSchema = addCustomerSchemaRules(
  customerBaseSchema.partial(),
);

const businessAddressSchema = z.object({
  addressLine1: z.string().trim().min(2).max(191),
  city: z.string().trim().min(2).max(191),
  state: requiredIndianStateString,
  pincode: requiredIndianPincodeString,
});

export const businessProfileUpsertSchema = z
  .object({
    business_name: z.string().min(2),
    address: optionalTrimmedString,
    businessAddress: businessAddressSchema.optional(),
    address_line1: optionalAddressLineString,
    city: optionalAddressLineString,
    state: optionalIndianStateString,
    pincode: optionalIndianPincodeString,
    phone: optionalTrimmedString,
    email: optionalEmailString,
    website: optionalTrimmedString,
    logo_url: optionalUrlString,
    tax_id: optionalTrimmedString,
    currency: z.string().min(1),
    show_logo_on_invoice: z.boolean().optional(),
    show_tax_number: z.boolean().optional(),
    show_payment_qr: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    const hasStructuredAddress = Boolean(value.businessAddress);
    const hasLegacyAddress = Boolean(value.address);
    const hasTopLevelStructuredField = Boolean(
      value.address_line1 || value.city || value.state || value.pincode,
    );

    if (
      !hasStructuredAddress &&
      !hasLegacyAddress &&
      !hasTopLevelStructuredField
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["businessAddress"],
        message: "Address details are required",
      });
      return;
    }

    if (!hasStructuredAddress && hasTopLevelStructuredField) {
      if (!value.address_line1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["address_line1"],
          message: "Address line 1 is required",
        });
      }

      if (!value.city) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["city"],
          message: "City is required",
        });
      }

      if (!value.state) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["state"],
          message: "State is required",
        });
      }

      if (!value.pincode) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["pincode"],
          message: "Pincode is required",
        });
      }
    }
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

export const invoiceEmailRequestSchema = z.object({
  email: z.string().email().optional(),
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

export const accessRazorpayOrderSchema = z.object({
  plan_id: accessPlanSchema,
  billing_cycle: accessBillingCycleSchema,
});

export const accessRazorpayVerifySchema = z.object({
  razorpay_order_id: z.string().min(1).max(191),
  razorpay_payment_id: z.string().min(1).max(191),
  razorpay_signature: z.string().min(1).max(191),
});

export const accessUpiSubmitSchema = z.object({
  plan_id: accessPlanSchema,
  billing_cycle: accessBillingCycleSchema,
  name: z.string().trim().min(2).max(191),
  utr: z.string().trim().min(8).max(22),
});

export const adminAccessPaymentVerifySchema = z.object({
  paymentId: z.string().trim().min(1),
  status: z.enum(["approved", "rejected"]),
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

const exportFilterSchema = z.object({
  start_date: z.coerce.date().optional(),
  end_date: z.coerce.date().optional(),
  category: z.string().min(1).optional(),
  payment_status: z.string().min(1).optional(),
  customer_name: z.string().min(1).optional(),
  search: z.string().min(1).optional(),
});

export const exportResourceParamSchema = z.object({
  resource: z.enum(["products", "customers", "invoices"]),
});

export const exportRequestSchema = z.object({
  format: z.enum(["csv", "xlsx", "pdf", "json"]),
  scope: z.enum(["all", "filtered", "selected"]).default("all"),
  delivery: z.enum(["download", "email"]).default("download"),
  email: z.string().email().optional(),
  fields: z.array(z.string().min(1)).min(1),
  selected_ids: z.array(z.coerce.number().int().positive()).optional(),
  filters: exportFilterSchema.optional(),
});

export const exportPreviewRequestSchema = z.object({
  scope: z.enum(["all", "filtered", "selected"]).default("all"),
  fields: z.array(z.string().min(1)).min(1),
  selected_ids: z.array(z.coerce.number().int().positive()).optional(),
  filters: exportFilterSchema.optional(),
});
