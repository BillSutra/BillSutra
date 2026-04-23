const DEFAULT_FRONTEND_URL = "http://localhost:3000";
const DEFAULT_BACKEND_URL = "http://localhost:8000";

const normalizeUrl = (value: string) => value.replace(/\/+$/, "");

export const getFrontendAppUrl = () =>
  normalizeUrl(
    process.env.FRONTEND_URL?.trim() ||
      process.env.APP_URL?.trim() ||
      process.env.CLIENT_URL?.trim() ||
      DEFAULT_FRONTEND_URL,
  );

export const getBackendAppUrl = () =>
  normalizeUrl(
    process.env.BACKEND_URL?.trim() ||
      process.env.API_URL?.trim() ||
      process.env.SERVER_URL?.trim() ||
      DEFAULT_BACKEND_URL,
  );

const normalizeInvoiceSlug = (value: string) =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");

export const buildLoginUrl = (email?: string) => {
  const loginUrl = new URL("/login", `${getFrontendAppUrl()}/`);

  if (email?.trim()) {
    loginUrl.searchParams.set("email", email.trim());
  }

  return loginUrl.toString();
};

export const buildResetPasswordUrl = (token: string, email: string) => {
  const resetUrl = new URL("/reset-password", `${getFrontendAppUrl()}/`);
  resetUrl.searchParams.set("token", token);
  resetUrl.searchParams.set("email", email);
  return resetUrl.toString();
};

export const buildPublicInvoiceReference = (
  invoiceId: number,
  invoiceNumber: string,
) => `${invoiceId}-${normalizeInvoiceSlug(invoiceNumber) || "invoice"}`;

export const buildPublicInvoiceUrl = (
  invoiceId: number,
  invoiceNumber: string,
) =>
  new URL(
    `/invoice/${buildPublicInvoiceReference(invoiceId, invoiceNumber)}`,
    `${getFrontendAppUrl()}/`,
  ).toString();
