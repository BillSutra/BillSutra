import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  ADMIN_TOKEN_COOKIE_KEY,
  getAdminRoleFromToken,
  SUPER_ADMIN_ROLE,
} from "@/lib/adminAuthShared";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith("/admin")) {
    const adminToken = request.cookies.get(ADMIN_TOKEN_COOKIE_KEY)?.value;
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

  if (!token) {
    const signInUrl = new URL("/", request.url);
    signInUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  const role = (token as { user?: { role?: string } } | null)?.user?.role;
  const isEmailVerified = (
    token as { user?: { is_email_verified?: boolean | null } } | null
  )?.user?.is_email_verified;

  if (role !== "WORKER" && isEmailVerified === false) {
    return NextResponse.redirect(new URL("/verify-email", request.url));
  }

  if (pathname.startsWith("/workers") && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (role === "WORKER") {
    const workerAllowed =
      pathname.startsWith("/sales") || pathname.startsWith("/invoices");

    if (!workerAllowed) {
      return NextResponse.redirect(new URL("/sales", request.url));
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
    "/suppliers/:path*",
    "/templates/:path*",
    "/warehouses/:path*",
    "/workers/:path*",
  ],
};
