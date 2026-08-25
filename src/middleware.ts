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
    const secretStr = process.env.JWT_SECRET;

    if (!secretStr) return NextResponse.next();
    try {
      await jwtVerify(token, new TextEncoder().encode(secretStr));
      return NextResponse.next();
    } catch {
     
    }
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(loginUrl);
}

export const config = {

  matcher: ["/((?!_next/|favicon|logo|icon|manifest|sw\\.js|.*\\.(?:svg|png|jpg|ico|webmanifest)$).*)"],
};
