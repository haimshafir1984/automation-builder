import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/admin/content")) {
    const isAdmin = req.cookies.get("admin_mode")?.value === "1";
    if (!isAdmin) {
      return NextResponse.redirect(new URL("/admin", req.url));
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/content/:path*"]
};
