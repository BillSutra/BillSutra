import { normalizeIndianState, type IndianState } from "./indianAddress.js";

const GSTIN_PATTERN =
  /^(0[1-9]|[12][0-9]|3[0-8])[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const GST_STATE_CODE_MAP: Record<string, string> = {
  "01": "Jammu and Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "25": "Dadra and Nagar Haveli and Daman and Diu",
  "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra",
  "28": "Andhra Pradesh",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman and Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
};

export const normalizeGstin = (value: string | null | undefined) =>
  String(value ?? "")
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .slice(0, 15);

export const isValidGstin = (value: string | null | undefined) =>
  GSTIN_PATTERN.test(normalizeGstin(value));

export const getStateFromGstin = (
  value: string | null | undefined,
): IndianState | null => {
  const normalized = normalizeGstin(value);
  if (!GSTIN_PATTERN.test(normalized)) {
    return null;
  }

  const mappedState = GST_STATE_CODE_MAP[normalized.slice(0, 2)];
  if (!mappedState) {
    return null;
  }

  return normalizeIndianState(mappedState);
};
