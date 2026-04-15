import NextAuth from "next-auth";
import { authOptions } from "./[...nextauth]/options";

const nextAuth = NextAuth(authOptions);

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
  return nextAuth(request, context);
};
