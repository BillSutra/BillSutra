// validation.ts
// Reusable validation utilities for BillSutra forms.
// Validators return stable English messages that can be translated centrally.

import {
  isValidIndianPincode,
  isValidIndianState,
  normalizeIndianPincode,
} from "@/lib/indianAddress";
import { isValidGstin, normalizeGstin } from "@/lib/gstin";

type TranslateFn = (key: string) => string;

const VALIDATION_TRANSLATION_KEYS: Record<string, string> = {
  "This field is required": "validation.required",
  "Business name is required": "validation.businessNameRequired",
  "Business name must be at least 2 characters": "validation.businessNameMin",
  "Phone number is required": "validation.phoneRequired",
  "Please enter a valid name (letters only)": "validation.validName",
  "Enter a valid phone number": "validation.validPhone",
  "Enter valid phone number": "validation.validPhoneShort",
  "Enter a valid email address": "validation.validEmail",
  "Enter valid email": "validation.validEmailShort",
  "Enter a valid number": "validation.validNumber",
  "Select a valid date": "validation.validDate",
  "Please select an option": "common.selectOption",
  "Enter a valid 6-digit pincode": "validation.validPincode",
  "Select a valid Indian state": "validation.validIndianState",
  "Enter a valid GSTIN": "validation.validGstin",
  "Enter a valid PAN": "validation.validPan",
  "GSTIN state code does not match selected state":
    "validation.gstinStateMismatch",
  "Address line 1 is required": "validation.requiredAddressLine",
  "Address line 1 must be at least 5 characters": "validation.addressLine1Min",
  "City is required": "validation.requiredCity",
  "City / District is required": "validation.cityDistrictRequired",
  "Email is required": "validation.emailRequired",
  "State is required": "validation.requiredState",
  "Pincode is required": "validation.requiredPincode",
  "Pincode must be 6 digits": "validation.pincodeSixDigits",
  "Currency is required": "validation.currencyRequired",
  "Please select a currency": "validation.currencyRequired",
  "Opening balance cannot be negative": "validation.nonNegative",
};

export function translateValidationMessage(
  t: TranslateFn,
  message: string,
): string {
  if (!message) return "";
  const key = VALIDATION_TRANSLATION_KEYS[message];
  return key ? t(key) : message;
}

export function validateName(value: string): string {
  if (!value.trim()) return "This field is required";
  if (!/^[\p{L}\p{M}\s.'-]+$/u.test(value.trim()))
    return "Please enter a valid name (letters only)";
  if (value.trim().length < 2)
    return "Please enter a valid name (letters only)";
  return "";
}

export function validatePhone(value: string, length = 10): string {
  if (!value.trim()) return "This field is required";
  if (!/^[0-9]+$/.test(value)) return "Enter a valid phone number";
  if (value.length !== length) return "Enter a valid phone number";
  return "";
}

export function validateEmail(value: string): string {
  if (!value.trim()) return "This field is required";
  if (!/^[\w-.]+@[\w-]+\.[a-zA-Z]{2,}$/.test(value))
    return "Enter a valid email address";
  return "";
}

export function validateNumber(value: string, allowNegative = false): string {
  if (!value.trim()) return "This field is required";
  const pattern = allowNegative ? /^-?\d+(\.\d+)?$/ : /^\d+(\.\d+)?$/;
  if (!pattern.test(value)) return "Enter a valid number";
  if (!allowNegative && parseFloat(value) < 0) return "Enter a valid number";
  return "";
}

export function validateRequired(value: string): string {
  return value.trim() ? "" : "This field is required";
}

export function validateIndianPincode(value: string): string {
  if (!value.trim()) return "This field is required";
  if (!isValidIndianPincode(value)) return "Enter a valid 6-digit pincode";
  if (normalizeIndianPincode(value).length !== 6)
    return "Enter a valid 6-digit pincode";
  return "";
}

export function validateIndianState(value: string): string {
  if (!value.trim()) return "This field is required";
  if (!isValidIndianState(value)) return "Select a valid Indian state";
  return "";
}

export function validateGstin(value: string): string {
  if (!value.trim()) return "This field is required";
  if (!isValidGstin(value)) return "Enter a valid GSTIN";
  if (normalizeGstin(value).length !== 15) return "Enter a valid GSTIN";
  return "";
}

export function validatePan(value: string): string {
  if (!value.trim()) return "This field is required";
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(value.trim())) {
    return "Enter a valid PAN";
  }
  return "";
}

export function validateDate(
  value: string,
  { min, max }: { min?: string; max?: string } = {},
): string {
  if (!value.trim()) return "This field is required";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "Select a valid date";
  if (min && date < new Date(min)) return "Select a valid date";
  if (max && date > new Date(max)) return "Select a valid date";
  return "";
}

export function validateDropdown(
  value: string,
  invalidValues: string[] = ["", "select", "default"],
): string {
  return invalidValues.includes(value) ? "Please select an option" : "";
}
