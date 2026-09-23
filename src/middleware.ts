import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";


const PRIVATE_PREFIXES = [
  "/favorites",
  "/profile",
  "/sell",
  "/subscriptions",
  "/admin",
  
  "/offers",
  "/listings",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  
  if (!PRIVATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const token = request.cookies.get("auth_token")?.value;
  if (token) {
    const secretStr = process.env.JWT_SECRET || "dev-secret-change-me";
    try {
      await jwtVerify(token, new TextEncoder().encode(secretStr));
      return NextResponse.next();
    } catch {
      // Token geçersiz veya süresi dolmuş
    }
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = `?next=${encodeURIComponent(pathname)}`;
  const response = NextResponse.redirect(loginUrl);
  // Eski/geçersiz çerezi temizle ki kullanıcı kilitlenmesin
  if (token) {
    response.cookies.set("auth_token", "", { path: "/", maxAge: 0 });
  }
  return response;
}

export const config = {

  matcher: ["/((?!_next/|favicon|logo|icon|manifest|sw\\.js|.*\\.(?:svg|png|jpg|ico|webmanifest)$).*)"],
};
