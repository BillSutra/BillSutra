import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  ADMIN_SESSION_COOKIE_KEY,
  ADMIN_TOKEN_STORAGE_KEY,
  getAdminRoleFromToken,
  SUPER_ADMIN_ROLE,
} from "@/lib/adminAuthShared";

const getWorkerHomePath = () => "/worker-panel";

const isWorkerAccount = (token: { user?: { role?: string; accountType?: string } } | null) => {
  const accountType = token?.user?.accountType;
  const role = token?.user?.role;

  return accountType === "WORKER" || (!accountType && role === "WORKER");
};

const isOwnerAdminAccount = (
  token: { user?: { role?: string; accountType?: string } } | null,
) => token?.user?.accountType !== "WORKER" && token?.user?.role === "ADMIN";

const isWorkerOnlyRoute = (pathname: string) =>
  pathname.startsWith("/worker-panel");

const isWorkerAllowedRoute = (pathname: string) =>
  pathname.startsWith("/worker-panel") ||
  pathname.startsWith("/sales") ||
  pathname.startsWith("/invoices") ||
  pathname.startsWith("/simple-bill");

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith("/admin")) {
    const adminToken =
      request.cookies.get(ADMIN_SESSION_COOKIE_KEY)?.value ??
      request.cookies.get(ADMIN_TOKEN_STORAGE_KEY)?.value;
    const adminRole = getAdminRoleFromToken(adminToken);
    const isAdminLoginRoute = pathname === "/admin/login";

    if (adminRole === SUPER_ADMIN_ROLE) {
      if (isAdminLoginRoute) {
        return NextResponse.redirect(new URL("/admin/dashboard", request.url));
      }

      return NextResponse.next();
    }

    if (isAdminLoginRoute) {
      return NextResponse.next();
    }

    // Transitional admin auth rollout:
    // the previous route guard depended on a JS-readable cookie. New admin
    // sessions use backend-set HttpOnly cookies, which are intentionally not
    // available to this frontend proxy. We therefore allow the route through
    // and let the protected backend API decide auth, while still honoring the
    // legacy cookie if it exists.
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  const sessionToken = token as
    | { user?: { role?: string; accountType?: string; is_email_verified?: boolean | null } }
    | null;
  const workerSession = isWorkerAccount(sessionToken);

  if (!token) {
    const signInUrl = new URL(
      isWorkerOnlyRoute(pathname) ? "/worker/login" : "/login",
      request.url,
    );
    signInUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  const isEmailVerified = sessionToken?.user?.is_email_verified;

  if (!workerSession && isEmailVerified === false) {
    return NextResponse.redirect(new URL("/verify-email", request.url));
  }

  if (pathname.startsWith("/workers") && !isOwnerAdminAccount(sessionToken)) {
    return NextResponse.redirect(
      new URL(workerSession ? getWorkerHomePath() : "/dashboard", request.url),
    );
  }

  if (workerSession) {
    if (!isWorkerAllowedRoute(pathname)) {
      return NextResponse.redirect(new URL(getWorkerHomePath(), request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/assistant/:path*",
    "/admin/:path*",
    "/business-profile/:path*",
    "/customers/:path*",
    "/dashboard/:path*",
    "/inventory/:path*",
    "/insights/:path*",
    "/invoices/:path*",
    "/products/:path*",
    "/profile/:path*",
    "/purchases/:path*",
    "/sales/:path*",
    "/settings/:path*",
    "/simple-bill/:path*",
    "/suppliers/:path*",
    "/templates/:path*",
    "/warehouses/:path*",
    "/worker-panel/:path*",
    "/workers/:path*",
  ],
};
