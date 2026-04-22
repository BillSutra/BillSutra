import { BASE_URL } from "@/lib/apiEndPoints";

const ABSOLUTE_URL_PATTERN = /^(?:https?:)?\/\//i;

export const resolveBackendAssetUrl = (value?: string | null) => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return "";
  }

  if (
    ABSOLUTE_URL_PATTERN.test(trimmed) ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:")
  ) {
    return trimmed;
  }

  const normalizedPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${BASE_URL}${normalizedPath}`;
};
