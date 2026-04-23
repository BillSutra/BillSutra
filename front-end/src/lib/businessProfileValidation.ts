import { isValidIndianState, normalizeIndianPincode } from "@/lib/indianAddress";
import type { BusinessProfileInput } from "@/types/invoice-template";

const BUSINESS_NAME_PATTERN = /^[\p{L}&.\-\s]+$/u;
const CITY_PATTERN = /^[\p{L}\s]+$/u;
const INDIAN_PHONE_PATTERN = /^[6-9]\d{9}$/;
const PINCODE_PATTERN = /^\d{6}$/;
const GSTIN_PATTERN =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

export type BusinessProfileFieldId =
  | "businessName"
  | "phone"
  | "addressLine1"
  | "city"
  | "state"
  | "pincode"
  | "email"
  | "website"
  | "taxId"
  | "currency";

export type BusinessProfileValidationErrors = Record<
  BusinessProfileFieldId,
  string
>;

export const BUSINESS_PROFILE_REQUIRED_FIELDS: BusinessProfileFieldId[] = [
  "businessName",
  "phone",
  "addressLine1",
  "city",
  "state",
  "pincode",
  "email",
  "currency",
];

export const BUSINESS_PROFILE_FIELD_ORDER: BusinessProfileFieldId[] = [
  "businessName",
  "phone",
  "addressLine1",
  "city",
  "state",
  "pincode",
  "email",
  "website",
  "taxId",
  "currency",
];

const sanitizePlainText = (value: string | null | undefined) =>
  String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const sanitizePlainTextDraft = (value: string | null | undefined) =>
  String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/[<>]/g, "");

export const sanitizeBusinessNameDraft = (value: string | null | undefined) =>
  sanitizePlainTextDraft(value).replace(/\d+/g, "");

export const sanitizeBusinessName = (value: string | null | undefined) =>
  sanitizePlainText(value).replace(/\d+/g, "");

export const sanitizeBusinessPhone = (value: string | null | undefined) =>
  String(value ?? "")
    .replace(/\D+/g, "")
    .slice(0, 10);

export const sanitizeBusinessAddressLine = (value: string | null | undefined) =>
  sanitizePlainText(value);

export const sanitizeBusinessCity = (value: string | null | undefined) =>
  sanitizePlainText(value);

export const sanitizeBusinessState = (value: string | null | undefined) =>
  sanitizePlainText(value);

export const sanitizeBusinessPincode = (value: string | null | undefined) =>
  normalizeIndianPincode(String(value ?? ""));

export const sanitizeBusinessEmail = (value: string | null | undefined) =>
  sanitizePlainText(value).toLowerCase();

export const sanitizeBusinessWebsite = (value: string | null | undefined) => {
  const sanitized = sanitizePlainText(value);
  if (!sanitized) {
    return "";
  }

  if (/^https?:\/\//i.test(sanitized)) {
    return sanitized;
  }

  return `https://${sanitized}`;
};

export const sanitizeBusinessTaxId = (value: string | null | undefined) =>
  sanitizePlainText(value).toUpperCase();

export const sanitizeBusinessCurrency = (value: string | null | undefined) =>
  sanitizePlainText(value).toUpperCase();

export const validateBusinessName = (value: string) => {
  const sanitized = sanitizeBusinessName(value);
  if (!sanitized) return "This field is required";
  if (sanitized.length < 2) return "Business name must be at least 2 characters";
  if (sanitized.length > 100) return "Business name must be at most 100 characters";
  if (!BUSINESS_NAME_PATTERN.test(sanitized)) {
    return "Use letters, spaces, &, ., or - only";
  }
  return "";
};

export const validateBusinessPhone = (value: string) => {
  const sanitized = sanitizeBusinessPhone(value);
  if (!sanitized) return "This field is required";
  if (!INDIAN_PHONE_PATTERN.test(sanitized)) {
    return "Enter a valid Indian phone number";
  }
  return "";
};

export const validateBusinessAddressLine = (value: string) => {
  const sanitized = sanitizeBusinessAddressLine(value);
  if (!sanitized) return "This field is required";
  if (sanitized.length < 5) return "Address line 1 must be at least 5 characters";
  if (sanitized.length > 200) return "Address line 1 must be at most 200 characters";
  return "";
};

export const validateBusinessCity = (value: string) => {
  const sanitized = sanitizeBusinessCity(value);
  if (!sanitized) return "This field is required";
  if (sanitized.length < 2) return "City or district must be at least 2 characters";
  if (sanitized.length > 100) return "City or district must be at most 100 characters";
  if (!CITY_PATTERN.test(sanitized)) {
    return "City or district can contain letters and spaces only";
  }
  return "";
};

export const validateBusinessState = (value: string) => {
  const sanitized = sanitizeBusinessState(value);
  if (!sanitized) return "This field is required";
  if (!isValidIndianState(sanitized)) return "Select a valid Indian state";
  return "";
};

export const validateBusinessPincode = (value: string) => {
  const sanitized = sanitizeBusinessPincode(value);
  if (!sanitized) return "This field is required";
  if (!PINCODE_PATTERN.test(sanitized)) return "Enter a valid 6-digit pincode";
  return "";
};

export const validateBusinessEmail = (value: string) => {
  const sanitized = sanitizeBusinessEmail(value);
  if (!sanitized) return "This field is required";
  if (sanitized.length > 254) return "Email must be at most 254 characters";
  if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(sanitized)) {
    return "Enter a valid email address";
  }
  return "";
};

export const validateBusinessWebsite = (value: string) => {
  const sanitized = sanitizeBusinessWebsite(value);
  if (!sanitized) return "";

  try {
    const url = new URL(sanitized);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "Enter a valid website URL";
    }
    return "";
  } catch {
    return "Enter a valid website URL";
  }
};

export const validateBusinessTaxId = (value: string) => {
  const sanitized = sanitizeBusinessTaxId(value);
  if (!sanitized) return "";
  if (!GSTIN_PATTERN.test(sanitized)) return "Enter a valid GSTIN";
  return "";
};

export const validateBusinessCurrency = (value: string) => {
  const sanitized = sanitizeBusinessCurrency(value);
  if (!sanitized) return "This field is required";
  if (!CURRENCY_PATTERN.test(sanitized)) return "Enter a valid 3-letter currency code";
  return "";
};

export const getBusinessProfileFieldError = (
  field: BusinessProfileFieldId,
  profile: BusinessProfileInput,
) => {
  switch (field) {
    case "businessName":
      return validateBusinessName(profile.businessName);
    case "phone":
      return validateBusinessPhone(profile.phone);
    case "addressLine1":
      return validateBusinessAddressLine(profile.businessAddress?.addressLine1 ?? "");
    case "city":
      return validateBusinessCity(profile.businessAddress?.city ?? "");
    case "state":
      return validateBusinessState(profile.businessAddress?.state ?? "");
    case "pincode":
      return validateBusinessPincode(profile.businessAddress?.pincode ?? "");
    case "email":
      return validateBusinessEmail(profile.email);
    case "website":
      return validateBusinessWebsite(profile.website);
    case "taxId":
      return validateBusinessTaxId(profile.taxId);
    case "currency":
      return validateBusinessCurrency(profile.currency);
    default:
      return "";
  }
};

export const getBusinessProfileValidationErrors = (
  profile: BusinessProfileInput,
): BusinessProfileValidationErrors => ({
  businessName: getBusinessProfileFieldError("businessName", profile),
  phone: getBusinessProfileFieldError("phone", profile),
  addressLine1: getBusinessProfileFieldError("addressLine1", profile),
  city: getBusinessProfileFieldError("city", profile),
  state: getBusinessProfileFieldError("state", profile),
  pincode: getBusinessProfileFieldError("pincode", profile),
  email: getBusinessProfileFieldError("email", profile),
  website: getBusinessProfileFieldError("website", profile),
  taxId: getBusinessProfileFieldError("taxId", profile),
  currency: getBusinessProfileFieldError("currency", profile),
});

export const isBusinessProfileRequiredFieldsValid = (
  errors: BusinessProfileValidationErrors,
) =>
  BUSINESS_PROFILE_REQUIRED_FIELDS.every((field) => !errors[field]);

export const getFirstBusinessProfileInvalidField = (
  errors: BusinessProfileValidationErrors,
) => BUSINESS_PROFILE_FIELD_ORDER.find((field) => errors[field]) ?? null;

export const sanitizeBusinessProfileInput = (
  profile: BusinessProfileInput,
): BusinessProfileInput => ({
  ...profile,
  businessName: sanitizeBusinessName(profile.businessName),
  phone: sanitizeBusinessPhone(profile.phone),
  email: sanitizeBusinessEmail(profile.email),
  website: sanitizeBusinessWebsite(profile.website),
  taxId: sanitizeBusinessTaxId(profile.taxId),
  currency: sanitizeBusinessCurrency(profile.currency),
  businessAddress: {
    addressLine1: sanitizeBusinessAddressLine(
      profile.businessAddress?.addressLine1,
    ),
    city: sanitizeBusinessCity(profile.businessAddress?.city),
    state: sanitizeBusinessState(profile.businessAddress?.state),
    pincode: sanitizeBusinessPincode(profile.businessAddress?.pincode),
  },
});
