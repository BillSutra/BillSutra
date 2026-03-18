// validation.ts
// Reusable validation utilities for Bill Sutra forms
// Each function returns an error message string if invalid, or an empty string if valid

export function validateName(value: string): string {
  if (!value.trim()) return "This field is required";
  if (!/^[A-Za-z ]+$/.test(value))
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
  if (!/^\d+(\.\d+)?$/.test(value)) return "Enter a valid number";
  if (!allowNegative && parseFloat(value) < 0) return "Enter a valid number";
  return "";
}

export function validateRequired(value: string): string {
  return value.trim() ? "" : "This field is required";
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
