import {
  isValidIndianPincode,
  normalizeIndianPincode,
  normalizeIndianState,
  type IndianState,
} from "./indianAddress.js";

export type PincodeLookupSource = "cache" | "live" | "fallback";

export type PincodeLookupResult = {
  pincode: string;
  city: string;
  state: IndianState;
  source: PincodeLookupSource;
};

export type PincodeLookupHealth = {
  cacheEntries: number;
  fallbackEntries: number;
  cacheTtlMs: number;
  checkedAt: string;
};

type PincodeFallbackEntry = {
  city: string;
  state: IndianState;
};

const PINCODE_FALLBACK_MAP: Record<string, PincodeFallbackEntry> = {
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

type CacheEntry = {
  city: string;
  state: IndianState;
  expiresAt: number;
};

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const pincodeLookupCache = new Map<string, CacheEntry>();

const normalizeWhitespace = (value: string) =>
  value.replace(/\s+/g, " ").trim();

const readFromCache = (pincode: string): PincodeLookupResult | null => {
  const cached = pincodeLookupCache.get(pincode);
  if (!cached) {
    return null;
  }

  if (Date.now() > cached.expiresAt) {
    pincodeLookupCache.delete(pincode);
    return null;
  }

  return {
    pincode,
    city: cached.city,
    state: cached.state,
    source: "cache",
  };
};

const writeToCache = (
  lookup: Pick<PincodeLookupResult, "pincode" | "city" | "state">,
) => {
  pincodeLookupCache.set(lookup.pincode, {
    city: lookup.city,
    state: lookup.state,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
};

const resolveFallbackLookup = (pincode: string): PincodeLookupResult | null => {
  const fallback = PINCODE_FALLBACK_MAP[pincode];
  if (!fallback) {
    return null;
  }

  return {
    pincode,
    city: normalizeWhitespace(fallback.city),
    state: fallback.state,
    source: "fallback",
  };
};

type PostalApiResponse = Array<{
  Status?: string;
  PostOffice?: Array<{
    District?: string;
    State?: string;
    Name?: string;
  }>;
}>;

const lookupFromPostalApi = async (
  pincode: string,
): Promise<PincodeLookupResult | null> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);

  try {
    const response = await fetch(
      `https://api.postalpincode.in/pincode/${pincode}`,
      {
        method: "GET",
        signal: controller.signal,
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as PostalApiResponse;
    const firstEntry = payload?.[0];

    if (!firstEntry || firstEntry.Status !== "Success") {
      return null;
    }

    const postOffice = firstEntry.PostOffice?.[0];
    if (!postOffice) {
      return null;
    }

    const normalizedState = normalizeIndianState(postOffice.State);
    const normalizedCity = normalizeWhitespace(
      String(postOffice.District ?? postOffice.Name ?? ""),
    );

    if (!normalizedState || !normalizedCity) {
      return null;
    }

    return {
      pincode,
      city: normalizedCity,
      state: normalizedState,
      source: "live",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
};

export const lookupIndianPincode = async (
  rawPincode: string,
): Promise<PincodeLookupResult | null> => {
  const pincode = normalizeIndianPincode(rawPincode);

  if (!isValidIndianPincode(pincode)) {
    return null;
  }

  const cached = readFromCache(pincode);
  if (cached) {
    return cached;
  }

  const liveLookup = await lookupFromPostalApi(pincode);
  if (liveLookup) {
    writeToCache(liveLookup);
    return liveLookup;
  }

  const fallbackLookup = resolveFallbackLookup(pincode);
  if (!fallbackLookup) {
    return null;
  }

  writeToCache(fallbackLookup);
  return fallbackLookup;
};

export const getPincodeLookupHealth = (): PincodeLookupHealth => ({
  cacheEntries: pincodeLookupCache.size,
  fallbackEntries: Object.keys(PINCODE_FALLBACK_MAP).length,
  cacheTtlMs: CACHE_TTL_MS,
  checkedAt: new Date().toISOString(),
});
