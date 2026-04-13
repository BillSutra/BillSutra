import { API_URL } from "./apiEndPoints";

export const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
] as const;

export type IndianState = (typeof INDIAN_STATES)[number];

export type BusinessAddressInput = {
  addressLine1: string;
  city: string;
  state: string;
  pincode: string;
};

export type PartialBusinessAddress = Partial<BusinessAddressInput>;

const normalizeWhitespace = (value: string) =>
  value.replace(/\s+/g, " ").trim();

const normalizeStateToken = (value: string) =>
  normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z]/g, "");

const STATE_ALIASES: Record<string, IndianState> = {
  nctofdelhi: "Delhi",
  newdelhi: "Delhi",
  delhincr: "Delhi",
  orissa: "Odisha",
  jandk: "Jammu and Kashmir",
  pondicherry: "Puducherry",
  andamannicobar: "Andaman and Nicobar Islands",
  dadranagarhaveli: "Dadra and Nagar Haveli and Daman and Diu",
  damandiu: "Dadra and Nagar Haveli and Daman and Diu",
  dnhdd: "Dadra and Nagar Haveli and Daman and Diu",
};

const STATE_LOOKUP = new Map<string, IndianState>(
  INDIAN_STATES.map((state) => [normalizeStateToken(state), state]),
);

const stateTokenEntries = [
  ...INDIAN_STATES.map((state) => [normalizeStateToken(state), state] as const),
  ...Object.entries(STATE_ALIASES).map(
    ([token, state]) => [normalizeStateToken(token), state] as const,
  ),
].sort((left, right) => right[0].length - left[0].length);

const PINCODE_CACHE_STORAGE_KEY = "billsutra:pincode-cache:v1";
const PINCODE_CACHE_LIMIT = 250;

type PincodeLookupValue = {
  city: string;
  state: IndianState;
};

const PINCODE_FALLBACK_MAP: Record<string, PincodeLookupValue> = {
  "110001": { city: "New Delhi", state: "Delhi" },
  "122001": { city: "Gurugram", state: "Haryana" },
  "160017": { city: "Chandigarh", state: "Chandigarh" },
  "201301": { city: "Noida", state: "Uttar Pradesh" },
  "208001": { city: "Kanpur", state: "Uttar Pradesh" },
  "226001": { city: "Lucknow", state: "Uttar Pradesh" },
  "302001": { city: "Jaipur", state: "Rajasthan" },
  "313001": { city: "Udaipur", state: "Rajasthan" },
  "342001": { city: "Jodhpur", state: "Rajasthan" },
  "380001": { city: "Ahmedabad", state: "Gujarat" },
  "390001": { city: "Vadodara", state: "Gujarat" },
  "395003": { city: "Surat", state: "Gujarat" },
  "400001": { city: "Mumbai", state: "Maharashtra" },
  "411001": { city: "Pune", state: "Maharashtra" },
  "422001": { city: "Nashik", state: "Maharashtra" },
  "440001": { city: "Nagpur", state: "Maharashtra" },
  "452001": { city: "Indore", state: "Madhya Pradesh" },
  "462001": { city: "Bhopal", state: "Madhya Pradesh" },
  "500001": { city: "Hyderabad", state: "Telangana" },
  "515001": { city: "Anantapur", state: "Andhra Pradesh" },
  "530001": { city: "Visakhapatnam", state: "Andhra Pradesh" },
  "560001": { city: "Bengaluru", state: "Karnataka" },
  "570001": { city: "Mysuru", state: "Karnataka" },
  "575001": { city: "Mangaluru", state: "Karnataka" },
  "600001": { city: "Chennai", state: "Tamil Nadu" },
  "620001": { city: "Tiruchirappalli", state: "Tamil Nadu" },
  "641001": { city: "Coimbatore", state: "Tamil Nadu" },
  "682001": { city: "Kochi", state: "Kerala" },
  "695001": { city: "Thiruvananthapuram", state: "Kerala" },
  "700001": { city: "Kolkata", state: "West Bengal" },
  "751001": { city: "Bhubaneswar", state: "Odisha" },
  "781001": { city: "Guwahati", state: "Assam" },
  "800001": { city: "Patna", state: "Bihar" },
  "834001": { city: "Ranchi", state: "Jharkhand" },
};

const inMemoryPincodeCache = new Map<string, PincodeLookupValue>();
let didLoadLocalCache = false;

const loadPincodeCache = () => {
  if (didLoadLocalCache || typeof window === "undefined") {
    return;
  }

  didLoadLocalCache = true;

  try {
    const raw = window.localStorage.getItem(PINCODE_CACHE_STORAGE_KEY);
    if (!raw) {
      return;
    }

    const parsed = JSON.parse(raw) as Record<string, PincodeLookupValue>;

    Object.entries(parsed).forEach(([pincode, value]) => {
      if (!/^\d{6}$/.test(pincode)) {
        return;
      }

      const normalizedState = normalizeIndianState(value.state);
      const normalizedCity = normalizeWhitespace(value.city ?? "");
      if (!normalizedState || !normalizedCity) {
        return;
      }

      inMemoryPincodeCache.set(pincode, {
        city: normalizedCity,
        state: normalizedState,
      });
    });
  } catch {
    // Ignore malformed local cache and continue with network lookup.
  }
};

const persistPincodeCache = () => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const entries = Array.from(inMemoryPincodeCache.entries());
    const trimmedEntries = entries.slice(-PINCODE_CACHE_LIMIT);
    const serialized = Object.fromEntries(trimmedEntries);
    window.localStorage.setItem(
      PINCODE_CACHE_STORAGE_KEY,
      JSON.stringify(serialized),
    );
  } catch {
    // Ignore localStorage write failures.
  }
};

export const normalizeIndianState = (
  value: string | null | undefined,
): IndianState | "" => {
  if (!value) {
    return "";
  }

  const normalized = normalizeStateToken(value);
  if (!normalized) {
    return "";
  }

  if (STATE_LOOKUP.has(normalized)) {
    return STATE_LOOKUP.get(normalized) ?? "";
  }

  if (STATE_ALIASES[normalized]) {
    return STATE_ALIASES[normalized];
  }

  return "";
};

export const normalizeIndianPincode = (value: string | null | undefined) =>
  String(value ?? "")
    .replace(/\D/g, "")
    .slice(0, 6);

export const isValidIndianPincode = (value: string | null | undefined) =>
  /^\d{6}$/.test(normalizeIndianPincode(value));

export const isValidIndianState = (value: string | null | undefined) =>
  Boolean(normalizeIndianState(value));

export const toBusinessAddressInput = (
  input?: PartialBusinessAddress | null,
): BusinessAddressInput => ({
  addressLine1: normalizeWhitespace(String(input?.addressLine1 ?? "")),
  city: normalizeWhitespace(String(input?.city ?? "")),
  state: normalizeIndianState(input?.state),
  pincode: normalizeIndianPincode(input?.pincode),
});

export const buildBusinessAddressLines = (
  input?: PartialBusinessAddress | null,
  fallbackAddress?: string | null,
) => {
  const address = toBusinessAddressInput(input);
  const lines: string[] = [];

  if (address.addressLine1) {
    lines.push(address.addressLine1);
  }

  const locationParts = [address.city, address.state].filter(Boolean);
  const locationLine = locationParts.join(", ");

  if (locationLine && address.pincode) {
    lines.push(`${locationLine} - ${address.pincode}`);
  } else if (locationLine) {
    lines.push(locationLine);
  } else if (address.pincode) {
    lines.push(address.pincode);
  }

  if (lines.length > 0) {
    return lines;
  }

  const legacyLines = String(fallbackAddress ?? "")
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);

  if (legacyLines.length > 0) {
    return legacyLines;
  }

  const legacyLine = normalizeWhitespace(String(fallbackAddress ?? ""));
  return legacyLine ? [legacyLine] : [];
};

export const formatBusinessAddress = (
  input?: PartialBusinessAddress | null,
  fallbackAddress?: string | null,
) => buildBusinessAddressLines(input, fallbackAddress).join(", ");

export const parseBusinessAddressText = (
  rawAddress: string | null | undefined,
): PartialBusinessAddress => {
  const normalized = normalizeWhitespace(String(rawAddress ?? ""));
  if (!normalized) {
    return {};
  }

  const pincodeMatch = normalized.match(/\b(\d{6})\b/);
  const pincode = pincodeMatch?.[1];

  const normalizedTokenString = normalizeStateToken(normalized);
  let detectedState: IndianState | "" = "";

  for (const [token, state] of stateTokenEntries) {
    if (token && normalizedTokenString.includes(token)) {
      detectedState = state;
      break;
    }
  }

  const chunks = normalized
    .split(/[\n,]+/)
    .map((chunk) => normalizeWhitespace(chunk))
    .filter(Boolean);

  const firstChunk = chunks[0] ?? "";

  let city = "";
  const stateToken = detectedState ? normalizeStateToken(detectedState) : "";
  const stateChunkIndex = detectedState
    ? chunks.findIndex((chunk) =>
        normalizeStateToken(chunk).includes(stateToken),
      )
    : -1;

  if (stateChunkIndex > 0) {
    city = chunks[stateChunkIndex - 1] ?? "";
  } else if (chunks.length > 1) {
    city = chunks[1] ?? "";
  }

  if (city && detectedState) {
    const statePattern = new RegExp(detectedState, "ig");
    city = normalizeWhitespace(
      city
        .replace(statePattern, "")
        .replace(/\b\d{6}\b/g, "")
        .replace(/[-]+/g, " "),
    );
  }

  return {
    addressLine1: firstChunk || undefined,
    city: city || undefined,
    state: detectedState || undefined,
    pincode,
  };
};

export type BusinessAddressRecordLike = {
  businessAddress?: PartialBusinessAddress | null;
  address_line1?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  address?: string | null;
};

export const resolveBusinessAddressFromRecord = (
  record?: BusinessAddressRecordLike | null,
) => {
  const parsedLegacyAddress = parseBusinessAddressText(record?.address);

  return toBusinessAddressInput({
    addressLine1:
      record?.businessAddress?.addressLine1 ??
      record?.address_line1 ??
      parsedLegacyAddress.addressLine1,
    city:
      record?.businessAddress?.city ?? record?.city ?? parsedLegacyAddress.city,
    state:
      record?.businessAddress?.state ??
      record?.state ??
      parsedLegacyAddress.state,
    pincode:
      record?.businessAddress?.pincode ??
      record?.pincode ??
      parsedLegacyAddress.pincode,
  });
};

export const formatBusinessAddressFromRecord = (
  record?: BusinessAddressRecordLike | null,
) => {
  const normalizedAddress = resolveBusinessAddressFromRecord(record);
  return formatBusinessAddress(normalizedAddress, record?.address);
};

export type CustomerAddressRecordLike = {
  customerAddress?: PartialBusinessAddress | null;
  address_line1?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  address?: string | null;
};

export const resolveCustomerAddressFromRecord = (
  record?: CustomerAddressRecordLike | null,
) => {
  const parsedLegacyAddress = parseBusinessAddressText(record?.address);

  return toBusinessAddressInput({
    addressLine1:
      record?.customerAddress?.addressLine1 ??
      record?.address_line1 ??
      parsedLegacyAddress.addressLine1,
    city:
      record?.customerAddress?.city ?? record?.city ?? parsedLegacyAddress.city,
    state:
      record?.customerAddress?.state ??
      record?.state ??
      parsedLegacyAddress.state,
    pincode:
      record?.customerAddress?.pincode ??
      record?.pincode ??
      parsedLegacyAddress.pincode,
  });
};

export const formatCustomerAddressFromRecord = (
  record?: CustomerAddressRecordLike | null,
) => {
  const normalizedAddress = resolveCustomerAddressFromRecord(record);
  return formatBusinessAddress(normalizedAddress, record?.address);
};

export const lookupIndianPincode = async (
  pincode: string,
): Promise<PincodeLookupValue | null> => {
  const normalizedPincode = normalizeIndianPincode(pincode);
  if (!isValidIndianPincode(normalizedPincode)) {
    return null;
  }

  loadPincodeCache();

  const cached = inMemoryPincodeCache.get(normalizedPincode);
  if (cached) {
    return cached;
  }

  const fallbackLookup = PINCODE_FALLBACK_MAP[normalizedPincode] ?? null;
  if (
    fallbackLookup &&
    typeof navigator !== "undefined" &&
    navigator.onLine === false
  ) {
    inMemoryPincodeCache.set(normalizedPincode, fallbackLookup);
    persistPincodeCache();
    return fallbackLookup;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);

  try {
    const response = await fetch(
      `${API_URL}/address/pincode/${normalizedPincode}`,
      {
        method: "GET",
        signal: controller.signal,
        cache: "no-store",
      },
    );

    if (!response.ok) {
      if (fallbackLookup) {
        inMemoryPincodeCache.set(normalizedPincode, fallbackLookup);
        persistPincodeCache();
        return fallbackLookup;
      }

      return null;
    }

    const payload = (await response.json()) as {
      data?: {
        city?: string;
        state?: string;
      };
    };

    const state = normalizeIndianState(payload?.data?.state);
    const city = normalizeWhitespace(String(payload?.data?.city ?? ""));

    if (!state || !city) {
      if (fallbackLookup) {
        inMemoryPincodeCache.set(normalizedPincode, fallbackLookup);
        persistPincodeCache();
        return fallbackLookup;
      }

      return null;
    }

    const next = { city, state };
    inMemoryPincodeCache.set(normalizedPincode, next);
    persistPincodeCache();
    return next;
  } catch {
    if (fallbackLookup) {
      inMemoryPincodeCache.set(normalizedPincode, fallbackLookup);
      persistPincodeCache();
      return fallbackLookup;
    }

    return null;
  } finally {
    clearTimeout(timeoutId);
  }
};
