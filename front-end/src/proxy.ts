import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function proxy(request: NextRequest) {
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
  const pathname = request.nextUrl.pathname;

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
