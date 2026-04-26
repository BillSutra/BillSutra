const defaultCorsOrigins = ["http://localhost:3000", "http://127.0.0.1:3000"];

export const getAllowedCorsOrigins = () => {
  const configuredCorsOrigins = (
    process.env.CORS_ORIGINS ??
    process.env.CORS_ORIGIN ??
    process.env.FRONTEND_URL ??
    process.env.APP_URL ??
    process.env.CLIENT_URL ??
    ""
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return Array.from(new Set([...defaultCorsOrigins, ...configuredCorsOrigins]));
};

export const isAllowedCorsOrigin = (origin?: string | null) => {
  if (!origin) {
    return true;
  }

  return new Set(getAllowedCorsOrigins()).has(origin);
};
