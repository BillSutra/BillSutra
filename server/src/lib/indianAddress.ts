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

export type BusinessAddressDraft = {
  addressLine1?: string;
  city?: string;
  state?: string;
  pincode?: string;
};

export type BusinessAddress = {
  addressLine1: string;
  city: string;
  state: string;
  pincode: string;
};

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

export const normalizeIndianState = (
  value: string | null | undefined,
): IndianState | null => {
  if (!value) {
    return null;
  }

  const normalized = normalizeStateToken(value);
  if (!normalized) {
    return null;
  }

  if (STATE_LOOKUP.has(normalized)) {
    return STATE_LOOKUP.get(normalized) ?? null;
  }

  if (STATE_ALIASES[normalized]) {
    return STATE_ALIASES[normalized];
  }

  return null;
};

export const normalizeIndianPincode = (value: string | null | undefined) =>
  String(value ?? "")
    .replace(/\D/g, "")
    .slice(0, 6);

export const isValidIndianPincode = (value: string | null | undefined) =>
  /^\d{6}$/.test(normalizeIndianPincode(value));

export const normalizeBusinessAddressDraft = (
  draft: BusinessAddressDraft | null | undefined,
): BusinessAddressDraft => {
  if (!draft) {
    return {};
  }

  const state = normalizeIndianState(draft.state);

  return {
    addressLine1:
      normalizeWhitespace(String(draft.addressLine1 ?? "")) || undefined,
    city: normalizeWhitespace(String(draft.city ?? "")) || undefined,
    state: state ?? undefined,
    pincode: normalizeIndianPincode(draft.pincode) || undefined,
  };
};

export const isCompleteBusinessAddress = (
  draft: BusinessAddressDraft,
): draft is BusinessAddress => {
  return Boolean(
    draft.addressLine1 &&
    draft.city &&
    draft.state &&
    isValidIndianPincode(draft.pincode),
  );
};

const dedupeLines = (lines: string[]) => {
  const unique: string[] = [];

  lines.forEach((line) => {
    if (!line || unique.includes(line)) {
      return;
    }
    unique.push(line);
  });

  return unique;
};

export const buildBusinessAddressLines = (
  draft: BusinessAddressDraft | null | undefined,
  fallbackAddress?: string | null,
) => {
  const normalized = normalizeBusinessAddressDraft(draft);
  const lines: string[] = [];

  if (normalized.addressLine1) {
    lines.push(normalized.addressLine1);
  }

  const locationParts = [normalized.city, normalized.state].filter(
    (part): part is string => Boolean(part),
  );

  const locationLine = locationParts.join(", ");
  if (locationLine && normalized.pincode) {
    lines.push(`${locationLine} - ${normalized.pincode}`);
  } else if (locationLine) {
    lines.push(locationLine);
  } else if (normalized.pincode) {
    lines.push(normalized.pincode);
  }

  if (lines.length > 0) {
    return dedupeLines(lines);
  }

  const fallbackLines = String(fallbackAddress ?? "")
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);

  if (fallbackLines.length > 0) {
    return dedupeLines(fallbackLines);
  }

  return [];
};

export const formatBusinessAddress = (
  draft: BusinessAddressDraft | null | undefined,
  fallbackAddress?: string | null,
) => {
  const lines = buildBusinessAddressLines(draft, fallbackAddress);

  if (lines.length > 0) {
    return lines.join(", ");
  }

  const normalizedFallback = normalizeWhitespace(String(fallbackAddress ?? ""));
  return normalizedFallback || null;
};

export const parseLegacyBusinessAddress = (
  rawAddress: string | null | undefined,
): BusinessAddressDraft => {
  const normalized = normalizeWhitespace(String(rawAddress ?? ""));
  if (!normalized) {
    return {};
  }

  const pincodeMatch = normalized.match(/\b(\d{6})\b/);
  const pincode = pincodeMatch?.[1];

  const normalizedTokenString = normalizeStateToken(normalized);

  let detectedState: IndianState | null = null;
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

  return normalizeBusinessAddressDraft({
    addressLine1: firstChunk,
    city: city || undefined,
    state: detectedState ?? undefined,
    pincode,
  });
};
