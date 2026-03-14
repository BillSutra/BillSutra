const DEFAULT_BACKEND_URL = "http://localhost:8000";

const normalizeBackendUrl = (rawValue?: string): string => {
  const trimmed = rawValue?.trim();

  if (!trimmed) {
    return DEFAULT_BACKEND_URL;
  }

  // Accept values like :8000, 8000, localhost:8000, or full http(s) URLs.
  if (/^:\d+$/.test(trimmed)) {
    return `http://localhost${trimmed}`;
  }

  if (/^\d+$/.test(trimmed)) {
    return `http://localhost:${trimmed}`;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (/^[a-z0-9.-]+:\d+$/i.test(trimmed)) {
    return `http://${trimmed}`;
  }

  return trimmed;
};

class Env {
  static APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

  static BACKEND_URL = normalizeBackendUrl(process.env.NEXT_PUBLIC_BACKEND_URL);
}

export default Env;
