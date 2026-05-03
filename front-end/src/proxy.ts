import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  ADMIN_SESSION_COOKIE_KEY,
  ADMIN_TOKEN_STORAGE_KEY,
  getAdminRoleFromToken,
  getUnifiedRoleFromToken,
  SUPER_ADMIN_ROLE,
  UNIFIED_ACCESS_COOKIE_KEY,
} from "@/lib/adminAuthShared";

const getWorkerHomePath = () => "/worker-panel";
const getHomePathForRole = (role: string | null) => {
  switch (role) {
    case "worker":
      return "/worker-panel";
    case "admin":
      return "/admin/dashboard";
    case "super_admin":
      return "/super-admin/dashboard";
    case "user":
      return "/dashboard";
    default:
      return null;
  }
};

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
      request.cookies.get(UNIFIED_ACCESS_COOKIE_KEY)?.value ??
      request.cookies.get(ADMIN_SESSION_COOKIE_KEY)?.value ??
      request.cookies.get(ADMIN_TOKEN_STORAGE_KEY)?.value;
    const adminRole = getAdminRoleFromToken(adminToken);
    const isAdminLoginRoute = pathname === "/admin/login";

    if (adminRole === SUPER_ADMIN_ROLE) {
      if (isAdminLoginRoute) {
        return NextResponse.redirect(new URL("/super-admin/dashboard", request.url));
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
  const unifiedToken = request.cookies.get(UNIFIED_ACCESS_COOKIE_KEY)?.value;
  const unifiedRole = getUnifiedRoleFromToken(unifiedToken);
  const sessionToken = token as
    | { user?: { role?: string; accountType?: string; is_email_verified?: boolean | null } }
    | null;
  const workerSession = unifiedRole === "worker" || isWorkerAccount(sessionToken);

  if (pathname.startsWith("/super-admin")) {
    if (unifiedRole === "super_admin") {
      return NextResponse.next();
    }

    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  if (!token && !unifiedRole) {
    const signInUrl = new URL(
      isWorkerOnlyRoute(pathname) ? "/worker/login" : "/login",
      request.url,
    );
    signInUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  if (unifiedRole) {
    const homePath = getHomePathForRole(unifiedRole);
    if (
      homePath &&
      ((unifiedRole === "worker" && !isWorkerAllowedRoute(pathname)) ||
        (unifiedRole === "user" && pathname.startsWith("/worker-panel")))
    ) {
      return NextResponse.redirect(new URL(homePath, request.url));
    }
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
    "/super-admin/:path*",
    "/suppliers/:path*",
    "/templates/:path*",
    "/warehouses/:path*",
    "/worker-panel/:path*",
    "/workers/:path*",
  ],
};
