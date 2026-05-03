import NextAuth from "next-auth";
import { authOptions } from "./[...nextauth]/options";

const nextAuth = NextAuth(authOptions);

const getConfiguredAuthUrl = () => {
  const configuredUrl = process.env.NEXTAUTH_URL?.trim();

  if (!configuredUrl) {
    return null;
  }

  try {
    return new URL(configuredUrl);
  } catch {
    return null;
  }
};

const alignNextAuthOriginForDev = (request: Request) => {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  try {
    const requestOrigin = new URL(request.url).origin;
    if (process.env.NEXTAUTH_URL !== requestOrigin) {
      process.env.NEXTAUTH_URL = requestOrigin;
    }
  } catch {
    // Ignore malformed request URLs and keep existing NEXTAUTH_URL.
  }
};

const redirectToConfiguredOriginForProd = (request: Request) => {
  if (process.env.NODE_ENV !== "production") {
    return null;
  }

  const configuredUrl = getConfiguredAuthUrl();

  if (!configuredUrl) {
    return null;
  }

  try {
    const requestUrl = new URL(request.url);

    if (requestUrl.origin === configuredUrl.origin) {
      return null;
    }

    requestUrl.protocol = configuredUrl.protocol;
    requestUrl.hostname = configuredUrl.hostname;
    requestUrl.port = configuredUrl.port;

    return Response.redirect(requestUrl, 307);
  } catch {
    return null;
  }
};

type NextAuthRouteContext = {
  params: Promise<{
    nextauth: string[];
  }>;
};

export const handleNextAuthRequest = (
  request: Request,
  context: NextAuthRouteContext,
) => {
  alignNextAuthOriginForDev(request);
  const canonicalOriginRedirect = redirectToConfiguredOriginForProd(request);

  if (canonicalOriginRedirect) {
    return canonicalOriginRedirect;
  }

  return nextAuth(request, context);
};
