import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { FEED_SEED_COOKIE, randomFeedSeed } from "@/lib/car-mix";


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

  // Her yeni Keşfet gezinmesine ayrı, CDN'de tekrar kullanılabilir bir akış ver.
  // Tohum URL'de yalnızca CDN cache anahtarı olarak kalır; istemci ekranda gizler.
  const requestedSeed = Number(request.nextUrl.searchParams.get("seed"));
  const hasValidFeedSeed =
    Number.isInteger(requestedSeed) && requestedSeed >= 1 && requestedSeed <= 12;
  if (pathname === "/" && request.method === "GET" && !hasValidFeedSeed) {
    const previousSeed = Number(request.cookies.get(FEED_SEED_COOKIE)?.value);
    const seed = randomFeedSeed(Number.isInteger(previousSeed) ? previousSeed : undefined);
    const destination = request.nextUrl.clone();
    destination.searchParams.set("seed", String(seed));

    const response = NextResponse.redirect(destination);
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.set("Vercel-CDN-Cache-Control", "no-store");
    response.cookies.set(FEED_SEED_COOKIE, String(seed), {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
    });
    return response;
  }

  
  if (!PRIVATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const token = request.cookies.get("auth_token")?.value;
  // Production'da gizli anahtar yoksa varsayılan anahtarla imzalanmış sahte çerezler kabul edilmesin.
  const secretStr =
    process.env.JWT_SECRET ||
    (process.env.NODE_ENV === "production" ? "" : "dev-secret-change-me");
  if (token && secretStr) {
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
