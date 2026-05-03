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

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 64;
const PRODUCT_NAME_PATTERN = /[\p{L}\p{N}]/u;
const PRODUCT_PRICE_MAX = 1_000_000;
const ALLOWED_GST_RATES = [0, 5, 12, 18, 28] as const;
const STRONG_PASSWORD_RULES = [
  {
    regex: new RegExp(`^.{${PASSWORD_MIN_LENGTH},${PASSWORD_MAX_LENGTH}}$`),
    message: "Use a stronger password.",
  },
  {
    regex: /[A-Z]/,
    message: "Use a stronger password.",
  },
  {
    regex: /[a-z]/,
    message: "Use a stronger password.",
  },
  {
    regex: /\d/,
    message: "Use a stronger password.",
  },
  {
    regex: /[^A-Za-z0-9\s]/,
    message: "Use a stronger password.",
  },
  {
    regex: /^\S+$/,
    message: "Use a stronger password.",
  },
] as const;
const FULL_NAME_PATTERN = /^[A-Za-z ]{2,50}$/;
const SIGNUP_EMAIL_PATTERN =
  /^[A-Za-z0-9](?:[A-Za-z0-9._%+-]{0,62}[A-Za-z0-9])?@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,24}$/;
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "10minutemail.com",
  "guerrillamail.com",
  "mailinator.com",
  "tempmail.com",
  "yopmail.com",
]);
const ALLOWED_SIGNUP_TLDS = new Set([
  "com",
  "in",
  "co",
  "org",
  "net",
  "io",
  "ai",
  "app",
  "dev",
  "info",
  "biz",
  "me",
  "edu",
  "gov",
  "us",
  "uk",
  "ca",
  "au",
  "sg",
  "ae",
]);
const COMMON_BREACHED_PASSWORDS = new Set([
  "123456",
  "1234567",
  "12345678",
  "123456789",
  "1234567890",
  "password",
  "password1",
  "password123",
  "qwerty",
  "qwerty123",
  "admin",
  "admin123",
  "bill1234",
  "billsutra",
  "letmein",
  "welcome",
  "welcome123",
  "iloveyou",
  "111111",
  "000000",
]);

const strongPasswordSchema = z
  .string({ required_error: "Use a stronger password." })
  .superRefine((value, ctx) => {
    const normalizedPassword = value.toLowerCase().replace(/\s+/g, "");
    const hasWeakRule =
      !value ||
      STRONG_PASSWORD_RULES.some((rule) => !rule.regex.test(value)) ||
      COMMON_BREACHED_PASSWORDS.has(normalizedPassword);

    if (hasWeakRule) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: STRONG_PASSWORD_RULES[0].message,
      });
    }
  });

const sanitizeTextInput = (value: unknown) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ") : value;

const normalizeSignupEmail = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : value;

const normalizeIndianMobile = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const digits = value.replace(/\D/g, "");
  return digits.length === 12 && digits.startsWith("91")
    ? digits.slice(2)
    : digits;
};

const fullNameSchema = z.preprocess(
  sanitizeTextInput,
  z
    .string({ required_error: "Enter a valid full name." })
    .superRefine((value, ctx) => {
      if (!value) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Name is required",
        });
        return;
      }

      if (/\d/.test(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Name cannot contain numbers",
        });
        return;
      }

      if (!FULL_NAME_PATTERN.test(value) || !/[A-Za-z]/.test(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter valid full name",
        });
      }
    }),
);

const signupEmailSchema = z.preprocess(
  normalizeSignupEmail,
  z
    .string({ required_error: "Enter a valid email address." })
    .min(1, "Enter a valid email address.")
    .max(100, "Enter a valid email address.")
    .superRefine((value, ctx) => {
      const domain = value.split("@")[1] ?? "";
      const tld = domain.split(".").pop() ?? "";
      if (
        !SIGNUP_EMAIL_PATTERN.test(value) ||
        DISPOSABLE_EMAIL_DOMAINS.has(domain) ||
        !ALLOWED_SIGNUP_TLDS.has(tld)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter a valid email address.",
        });
      }
    }),
);

const indianMobileSchema = z.preprocess(
  normalizeIndianMobile,
  z
    .string({ required_error: "Enter a valid 10-digit mobile number." })
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number."),
);

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const stringIdParamSchema = z.object({
  id: z.string().trim().min(1).max(191),
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

const normalizeCategoryNameInput = (value: unknown) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ") : value;

export const categoryCreateSchema = z.object({
  name: z.preprocess(
    normalizeCategoryNameInput,
    z.string().min(2).max(80),
  ),
});

export const categoryUpdateSchema = categoryCreateSchema.partial();

export const authLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  rememberMe: z.boolean().optional(),
});

const normalizeWorkerLoginPhone = (value: string) => value.replace(/\D/g, "");
const workerLoginEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const emptyWorkerLoginFieldToUndefined = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
};

export const authOauthSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).optional(),
  provider: z.string().min(2).optional(),
  oauth_id: z.string().min(1).optional(),
  image: z.string().url().optional(),
  rememberMe: z.boolean().optional(),
});

export const authRegisterSchema = z
  .object({
    name: fullNameSchema,
    email: signupEmailSchema,
    phone: indianMobileSchema,
    password: strongPasswordSchema,
    confirm_password: z.string().min(1, "Confirm your password."),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

export const authForgotSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

const passwordResetTokenSchema = z
  .string()
  .trim()
  .regex(/^[a-f0-9]{48,128}$/i, "Invalid reset token");

export const authVerifyEmailQuerySchema = z.object({
  token: z.string().trim().min(32).max(191),
});

export const authVerifyEmailOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().regex(/^\d{6}$/, "OTP must be 6 digits"),
  rememberMe: z.boolean().optional(),
});

export const authResendVerificationOtpSchema = z.object({
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

export const authSessionBootstrapSchema = z.object({
  rememberMe: z.boolean().optional(),
});

export const authOtpSendSchema = z.object({
  email: z.string().email(),
});

export const authOtpVerifySchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/, "OTP must be 6 digits"),
  rememberMe: z.boolean().optional(),
});

export const passkeyAuthenticateOptionsSchema = z.object({
  email: z.string().email(),
});

export const passkeyAuthenticateVerifySchema = z.object({
  email: z.string().email(),
  challenge_id: z.coerce.number().int().positive(),
  rememberMe: z.boolean().optional(),
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
    email: z.string().trim().toLowerCase().email(),
    token: passwordResetTokenSchema,
    password: strongPasswordSchema,
    confirm_password: z.string().trim().min(PASSWORD_MIN_LENGTH),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Passwords do not match.",
    path: ["confirm_password"],
  });

export const authResetValidateQuerySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  token: passwordResetTokenSchema,
});

export const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const accessPlanSchema = z.enum(["pro", "pro-plus"]);
export const accessBillingCycleSchema = z.enum(["monthly", "yearly"]);

export const workerLoginSchema = z
  .object({
    identifier: z.preprocess(
      emptyWorkerLoginFieldToUndefined,
      z.string().trim().min(3).max(120).optional(),
    ),
    email: z.preprocess(
      emptyWorkerLoginFieldToUndefined,
      z.string().trim().toLowerCase().email().optional(),
    ),
    phone: z.preprocess(
      emptyWorkerLoginFieldToUndefined,
      z
        .string()
        .trim()
        .transform((value) => normalizeWorkerLoginPhone(value))
        .optional(),
    ),
    password: z.string().min(6),
    rememberMe: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    const identifier = value.identifier ?? value.email ?? value.phone;

    if (!identifier) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["identifier"],
        message: "Email or phone number is required",
      });
      return;
    }

    const normalizedPhone = normalizeWorkerLoginPhone(identifier);
    const identifierLooksLikeEmail = workerLoginEmailPattern.test(identifier);
    const hasValidEmail = Boolean(value.email) || identifierLooksLikeEmail;
    const hasValidPhone =
      (Boolean(value.phone) && /^\d{10,15}$/.test(value.phone!)) ||
      /^\d{10,15}$/.test(normalizedPhone);

    if (!hasValidEmail && !hasValidPhone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["identifier"],
        message: "Enter a valid email or phone number",
      });
    }

    if (value.phone && !/^\d{10,15}$/.test(value.phone)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phone"],
        message: "Phone number must be between 10 and 15 digits",
      });
    }
  });

const workerAccessRoleSchema = z.enum([
  "ADMIN",
  "SALESPERSON",
  "STAFF",
  "VIEWER",
]);
const workerStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);
const workerIncentiveTypeSchema = z.enum(["NONE", "PERCENTAGE", "PER_SALE"]);
const workerPasswordSchema = z
  .string({ required_error: "Use 8+ chars with upper, lower, number, and special character" })
  .superRefine((value, ctx) => {
    const isStrong =
      value.length >= 8 &&
      /[A-Z]/.test(value) &&
      /[a-z]/.test(value) &&
      /\d/.test(value) &&
      /[^A-Za-z0-9\s]/.test(value);

    if (!isStrong) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Use 8+ chars with upper, lower, number, and special character",
      });
    }
  });
const optionalWorkerPasswordSchema = workerPasswordSchema.optional();

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
  password: workerPasswordSchema,
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
    password: optionalWorkerPasswordSchema,
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

export const workerPasswordChangeSchema = z
  .object({
    current_password: z.string().min(1, "Current password is required"),
    password: z
      .string()
      .min(6, "Password must be at least 6 characters")
      .regex(/\d/, "Password must contain at least 1 number"),
    confirm_password: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

export const workerProfileUpdateSchema = z
  .object({
    name: z.string().min(1, "Name is required").optional(),
    email: z.string().email("Invalid email format").optional(),
    phone: z
      .string()
      .regex(/^\d{10}$/, "Phone must be exactly 10 digits")
      .optional(),
  })
  .refine(
    (data) => data.name || data.email || data.phone,
    { message: "At least one field must be provided" }
  );

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
  addressLine1: z
    .string()
    .trim()
    .min(5, "Address line 1 is required")
    .max(200, "Address line 1 is required"),
  city: z
    .string()
    .trim()
    .min(2, "City is required")
    .max(100, "City is required")
    .regex(/^[\p{L}\s]+$/u, "City is required"),
  state: requiredIndianStateString,
  pincode: requiredIndianPincodeString,
});

const sanitizeBusinessProfileText = (value: unknown) =>
  typeof value === "string"
    ? value.replace(/[<>]/g, "").replace(/\s+/g, " ").trim()
    : value;

const sanitizeBusinessPhone = (value: unknown) =>
  typeof value === "string" ? value.replace(/\s+/g, "").trim() : value;

const sanitizeBusinessEmail = (value: unknown) =>
  typeof value === "string"
    ? value.replace(/[<>]/g, "").trim().toLowerCase()
    : value;

const sanitizeBusinessWebsite = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.replace(/[<>]/g, "").trim();
  if (!trimmed) {
    return undefined;
  }

  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const sanitizeBusinessTaxId = (value: unknown) =>
  typeof value === "string"
    ? (() => {
        const normalized = value.replace(/[<>]/g, "").trim().toUpperCase();
        return normalized ? normalized : undefined;
      })()
    : value;

const sanitizeBusinessCurrency = (value: unknown) =>
  typeof value === "string"
    ? value.replace(/[<>]/g, "").trim().toUpperCase()
    : value;

export const businessProfileUpsertSchema = z
  .object({
    business_name: z.preprocess(
      sanitizeBusinessProfileText,
      z
        .string()
        .min(2)
        .max(100)
        .regex(/^[\p{L}\p{N}&.\-\s]+$/u, "Business name is invalid"),
    ),
    address: optionalTrimmedString,
    businessAddress: businessAddressSchema.optional(),
    address_line1: optionalAddressLineString,
    city: optionalAddressLineString,
    state: optionalIndianStateString,
    pincode: optionalIndianPincodeString,
    phone: z.preprocess(
      sanitizeBusinessPhone,
      z.string().regex(/^[6-9]\d{9}$/, "Enter a valid phone number"),
    ),
    email: z.preprocess(
      sanitizeBusinessEmail,
      z.string().email("Enter a valid email address"),
    ),
    website: z.preprocess(
      sanitizeBusinessWebsite,
      z.string().url("Enter a valid website URL").optional(),
    ),
    logo_url: optionalUrlString,
    tax_id: z.preprocess(
      sanitizeBusinessTaxId,
      z
        .string()
        .regex(
          /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/,
          "Enter a valid GSTIN",
        )
        .optional(),
    ),
    currency: z.preprocess(
      sanitizeBusinessCurrency,
      z.string().regex(/^[A-Z]{3}$/, "Enter a valid currency code"),
    ),
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

const productNameSchema = z
  .string()
  .trim()
  .min(2, "Product name must be at least 2 characters")
  .max(191, "Product name is too long")
  .refine((value) => PRODUCT_NAME_PATTERN.test(value), {
    message: "Product name must contain at least one letter or number",
  });

const productPriceSchema = z.coerce
  .number()
  .nonnegative()
  .max(PRODUCT_PRICE_MAX, `Price cannot exceed ${PRODUCT_PRICE_MAX}`);

const productGstRateSchema = z.coerce
  .number()
  .refine(
    (value) =>
      ALLOWED_GST_RATES.includes(value as (typeof ALLOWED_GST_RATES)[number]),
    {
      message: `GST rate must be one of ${ALLOWED_GST_RATES.join(", ")}`,
    },
  );

const productBarcodeSchema = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .trim()
    .min(6, "Barcode must be at least 6 characters")
    .max(32, "Barcode cannot exceed 32 characters")
    .regex(/^[A-Za-z0-9]+$/, "Barcode must be numeric or alphanumeric only")
    .transform((value) => value.toUpperCase())
    .optional(),
);

export const productCreateSchema = z.object({
  name: productNameSchema,
  sku: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  price: productPriceSchema,
  cost: productPriceSchema.optional(),
  barcode: productBarcodeSchema,
  gst_rate: productGstRateSchema.optional(),
  stock_on_hand: z.coerce.number().int().optional(),
  reorder_level: z.coerce.number().int().optional(),
  category_id: z.coerce.number().int().positive().nullable().optional(),
});

export const productUpdateSchema = productCreateSchema.partial();

export const productImportConfirmSchema = z.object({
  preview_token: z.string().min(1),
});

const invoiceItemSchema = z.object({
  product_id: z.coerce.number().int().positive().optional(),
  name: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  price: z.coerce.number().positive(),
  tax_rate: z.coerce.number().nonnegative().optional(),
  gst_type: z.enum(["CGST_SGST", "IGST", "NONE"]).optional(),
});

const invoiceTemplateSnapshotSchema = z.object({
  templateId: z.string().trim().min(1).max(120).nullable().optional(),
  templateName: z.string().trim().min(1).max(120).nullable().optional(),
  enabledSections: z.array(z.string().trim().min(1).max(64)).min(1).max(20),
  sectionOrder: z.array(z.string().trim().min(1).max(64)).max(20).optional(),
  theme: z.record(z.string(), z.unknown()).nullable().optional(),
  designConfig: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const invoiceCreateSchema = z.object({
  customer_id: z.coerce.number().int().positive(),
  date: z.coerce.date().optional(),
  due_date: z.coerce.date().optional(),
  discount: z.coerce.number().nonnegative().optional(),
  discount_type: z.enum(["PERCENTAGE", "FIXED"]).optional(),
  tax_mode: z.enum(["CGST_SGST", "IGST", "NONE"]).optional(),
  status: z.nativeEnum(InvoiceStatus).optional(),
  payment_status: z.enum(["UNPAID", "PARTIALLY_PAID", "PAID"]).optional(),
  amount_paid: z.coerce.number().nonnegative().optional(),
  payment_date: z.coerce.date().optional(),
  payment_method: z.nativeEnum(PaymentMethod).optional(),
  notes: z.string().optional(),
  template_snapshot: invoiceTemplateSnapshotSchema.optional(),
  sync_sales: z.boolean().optional(),
  warehouse_id: z.coerce.number().int().positive().optional(),
  items: z.array(invoiceItemSchema).min(1),
});

export const invoiceUpdateSchema = z.object({
  status: z.nativeEnum(InvoiceStatus).optional(),
  due_date: z.coerce.date().optional(),
  notes: z.string().optional(),
});

const invoicePreviewPayloadSchema = invoiceTemplateSnapshotSchema.extend({
  data: z.record(z.string(), z.unknown()),
});

export const invoiceEmailRequestSchema = z.object({
  email: z.string().email().optional(),
  preview_payload: invoicePreviewPayloadSchema.optional(),
});

export const invoicePreviewPdfRequestSchema = z.object({
  file_name: z.string().trim().min(1).max(160).optional(),
  preview_payload: invoicePreviewPayloadSchema,
});

export const sendTestEmailSchema = z.object({
  to: z.string().email().optional(),
  template: z
    .enum(["invoice", "otp", "payment_success", "plan_activation"])
    .default("otp"),
  subject: z.string().trim().min(1).max(160).optional(),
  attachPdf: z.boolean().optional().default(false),
  invoicePdfBase64: z.string().trim().min(1).optional(),
  businessName: z.string().trim().min(1).max(120).optional(),
  businessLogoUrl: z.string().url().optional(),
  customerName: z.string().trim().min(1).max(120).optional(),
  invoiceId: z.string().trim().min(1).max(120).optional(),
  downloadLink: z.string().url().optional(),
  otp: z.string().trim().min(4).max(10).optional(),
  expiresInMinutes: z.coerce.number().int().positive().max(60).optional(),
  amount: z.coerce.number().positive().optional(),
  transactionId: z.string().trim().min(1).max(120).optional(),
  planName: z.string().trim().min(1).max(120).optional(),
  validity: z.string().trim().min(1).max(120).optional(),
});

export const paymentCreateSchema = z.object({
  invoice_id: z.coerce.number().int().positive(),
  amount: z
    .coerce
    .number()
    .positive("Payment amount must be greater than zero.")
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, {
      message: "Payment amount can have at most 2 decimal places.",
    }),
  status: z.enum(["PAID", "PARTIAL", "PENDING", "FAILED"]),
  method: z.nativeEnum(PaymentMethod),
  provider: z.preprocess(emptyToUndefined, z.string().trim().min(2).max(120).optional()),
  transaction_id: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .min(6, "Transaction reference must be at least 6 characters.")
      .max(30, "Transaction reference must be 30 characters or less.")
      .regex(/^[A-Za-z0-9-]+$/, "Transaction reference can only use letters, numbers, and hyphens.")
      .transform((value) => value.toUpperCase())
      .optional(),
  ),
  reference: z.preprocess(emptyToUndefined, z.string().trim().max(191).optional()),
  notes: z.preprocess(emptyToUndefined, z.string().trim().max(500).optional()),
  cheque_number: z.preprocess(emptyToUndefined, z.string().trim().min(3).max(64).optional()),
  bank_name: z.preprocess(emptyToUndefined, z.string().trim().min(2).max(191).optional()),
  deposit_date: z.coerce.date().optional(),
  failure_reason: z.preprocess(emptyToUndefined, z.string().trim().min(3).max(500).optional()),
  paid_at: z.coerce.date(),
}).superRefine((value, ctx) => {
  const digitalMethods = new Set<PaymentMethod>([
    PaymentMethod.UPI,
    PaymentMethod.BANK_TRANSFER,
    PaymentMethod.NEFT,
    PaymentMethod.RTGS,
    PaymentMethod.IMPS,
    PaymentMethod.CARD,
    PaymentMethod.WALLET,
  ]);

  const now = new Date();
  const oldestAllowedDate = new Date("2000-01-01T00:00:00.000Z");

  if (digitalMethods.has(value.method) && !value.transaction_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["transaction_id"],
      message: "Transaction reference is required for digital payments.",
    });
  }

  if (value.method === PaymentMethod.CHEQUE) {
    if (!value.cheque_number) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cheque_number"],
        message: "Cheque number is required for cheque payments.",
      });
    }
    if (!value.bank_name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bank_name"],
        message: "Bank name is required for cheque payments.",
      });
    }
    if (!value.deposit_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["deposit_date"],
        message: "Deposit date is required for cheque payments.",
      });
    }
  }

  if (value.status === "FAILED" && !value.failure_reason) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["failure_reason"],
      message: "Failure reason is required for failed payments.",
    });
  }

  if (value.paid_at.getTime() > now.getTime()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["paid_at"],
      message: "Payment date cannot be in the future.",
    });
  }

  if (value.paid_at.getTime() < oldestAllowedDate.getTime()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["paid_at"],
      message: "Payment date is too old to be valid.",
    });
  }

  if (value.deposit_date) {
    if (value.deposit_date.getTime() > now.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["deposit_date"],
        message: "Deposit date cannot be in the future.",
      });
    }

    if (value.deposit_date.getTime() < oldestAllowedDate.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["deposit_date"],
        message: "Deposit date is too old to be valid.",
      });
    }
  }
});

export const paymentUpdateSchema = z
  .object({
    amount: z
      .coerce
      .number()
      .positive("Payment amount must be greater than zero.")
      .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, {
        message: "Payment amount can have at most 2 decimal places.",
      }),
    status: z.enum(["PAID", "PARTIAL", "PENDING", "FAILED"]),
    method: z.nativeEnum(PaymentMethod),
    provider: z.preprocess(emptyToUndefined, z.string().trim().min(2).max(120).optional()),
    transaction_id: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .trim()
        .min(6, "Transaction reference must be at least 6 characters.")
        .max(30, "Transaction reference must be 30 characters or less.")
        .regex(/^[A-Za-z0-9-]+$/, "Transaction reference can only use letters, numbers, and hyphens.")
        .transform((value) => value.toUpperCase())
        .optional(),
    ),
    reference: z.preprocess(emptyToUndefined, z.string().trim().max(191).optional()),
    notes: z.preprocess(emptyToUndefined, z.string().trim().max(500).optional()),
    cheque_number: z.preprocess(emptyToUndefined, z.string().trim().min(3).max(64).optional()),
    bank_name: z.preprocess(emptyToUndefined, z.string().trim().min(2).max(191).optional()),
    deposit_date: z.coerce.date().optional(),
    failure_reason: z.preprocess(emptyToUndefined, z.string().trim().min(3).max(500).optional()),
    paid_at: z.coerce.date(),
  })
  .superRefine((value, ctx) => {
    const digitalMethods = new Set<PaymentMethod>([
      PaymentMethod.UPI,
      PaymentMethod.BANK_TRANSFER,
      PaymentMethod.NEFT,
      PaymentMethod.RTGS,
      PaymentMethod.IMPS,
      PaymentMethod.CARD,
      PaymentMethod.WALLET,
    ]);

    const now = new Date();
    const oldestAllowedDate = new Date("2000-01-01T00:00:00.000Z");

    if (digitalMethods.has(value.method) && !value.transaction_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["transaction_id"],
        message: "Transaction reference is required for digital payments.",
      });
    }

    if (value.method === PaymentMethod.CHEQUE) {
      if (!value.cheque_number) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["cheque_number"],
          message: "Cheque number is required for cheque payments.",
        });
      }
      if (!value.bank_name) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["bank_name"],
          message: "Bank name is required for cheque payments.",
        });
      }
      if (!value.deposit_date) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["deposit_date"],
          message: "Deposit date is required for cheque payments.",
        });
      }
    }

    if (value.status === "FAILED" && !value.failure_reason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["failure_reason"],
        message: "Failure reason is required for failed payments.",
      });
    }

    if (value.paid_at.getTime() > now.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["paid_at"],
        message: "Payment date cannot be in the future.",
      });
    }

    if (value.paid_at.getTime() < oldestAllowedDate.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["paid_at"],
        message: "Payment date is too old to be valid.",
      });
    }

    if (value.deposit_date) {
      if (value.deposit_date.getTime() > now.getTime()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["deposit_date"],
          message: "Deposit date cannot be in the future.",
        });
      }

      if (value.deposit_date.getTime() < oldestAllowedDate.getTime()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["deposit_date"],
          message: "Deposit date is too old to be valid.",
        });
      }
    }
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const paymentTransactionReferenceCheckSchema = z.object({
  transaction_id: z
    .string()
    .trim()
    .min(6)
    .max(30)
    .regex(/^[A-Za-z0-9-]+$/)
    .transform((value) => value.toUpperCase()),
  payment_id: z.coerce.number().int().positive().optional(),
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

export const accessUpiSubmitSchema = z
  .object({
    plan_id: accessPlanSchema,
    billing_cycle: accessBillingCycleSchema,
    name: z.string().trim().min(3).max(191),
    mobileNumber: z
      .string()
      .transform((value) => value.replace(/\D/g, ""))
      .refine((value) => /^\d{10}$/.test(value), {
        message: "Mobile number must be exactly 10 digits",
      })
      .optional(),
    mobile_number: z
      .string()
      .transform((value) => value.replace(/\D/g, ""))
      .refine((value) => /^\d{10}$/.test(value), {
        message: "Mobile number must be exactly 10 digits",
      })
      .optional(),
    utr: z
      .string()
      .trim()
      .min(8)
      .max(30)
      .regex(/^[A-Za-z0-9]+$/, "UTR must contain only letters and numbers")
      .transform((value) => value.toUpperCase()),
  })
  .transform((value) => ({
    ...value,
    mobileNumber: value.mobileNumber ?? value.mobile_number,
  }));

export const accessPaymentProofUploadSchema = z
  .object({
    plan_id: accessPlanSchema.optional(),
    planId: accessPlanSchema.optional(),
    billing_cycle: accessBillingCycleSchema.optional(),
    billingCycle: accessBillingCycleSchema.optional(),
    name: z.preprocess(emptyToUndefined, z.string().trim().min(3).max(191).optional()),
    mobileNumber: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .transform((value) => value.replace(/\D/g, ""))
        .optional()
        .refine((value) => value === undefined || /^\d{10}$/.test(value), {
          message: "Mobile number must be exactly 10 digits",
        }),
    ),
    mobile_number: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .transform((value) => value.replace(/\D/g, ""))
        .optional()
        .refine((value) => value === undefined || /^\d{10}$/.test(value), {
          message: "Mobile number must be exactly 10 digits",
        }),
    ),
    utr: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .trim()
        .min(8)
        .max(30)
        .regex(/^[A-Za-z0-9]+$/, "UTR must contain only letters and numbers")
        .transform((value) => value.toUpperCase())
        .optional(),
    ),
    userId: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().optional()),
  })
  .transform((value) => ({
    plan_id: value.plan_id ?? value.planId,
    billing_cycle: value.billing_cycle ?? value.billingCycle ?? "monthly",
    name: value.name,
    mobileNumber: value.mobileNumber ?? value.mobile_number,
    utr: value.utr,
    userId: value.userId,
  }))
  .refine((value) => Boolean(value.plan_id), {
    message: "Plan is required",
    path: ["plan_id"],
  });

export const adminAccessPaymentVerifySchema = z.object({
  paymentId: z.string().trim().min(1),
  status: z.enum(["approved", "rejected"]),
  adminNote: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(500).optional(),
  ),
});

export const adminAccessPaymentReviewNoteSchema = z.object({
  adminNote: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(500).optional(),
  ),
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

export const settingsPreferencesUpsertSchema = z.object({
  appPreferences: z
    .object({
      language: z.enum(["en", "hi"]),
      currency: z.enum(["INR", "USD"]),
      dateFormat: z.enum(["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]),
    })
    .optional(),
  inventory: z
    .object({
      allowNegativeStock: z.boolean(),
    })
    .optional(),
  notifications: z
    .object({
      paymentReminders: z.boolean(),
      lowStockAlerts: z.boolean(),
      dueInvoiceAlerts: z.boolean(),
    })
    .optional(),
  backup: z
    .object({
      autoBackupEnabled: z.boolean(),
    })
    .optional(),
  branding: z
    .object({
      templateId: z.string().optional(),
      themeColor: z
        .string()
        .regex(/^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/)
        .optional(),
      terms: z.string().max(4000).optional(),
      signature: z.string().max(191).optional(),
    })
    .optional(),
});

export const notificationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
  type: z
    .enum([
      "payment",
      "inventory",
      "customer",
      "subscription",
      "worker",
      "security",
      "system",
    ])
    .optional(),
  isRead: z.coerce.boolean().optional(),
  unreadOnly: z.coerce.boolean().optional(),
});

export const notificationReadStateSchema = z.object({
  isRead: z.boolean().optional(),
});
