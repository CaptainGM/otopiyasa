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

/**
 * İlan sayfaları her istekte çizilir (bkz. app/cars/[id]/page.tsx); robots.txt'e uymayan botlar burada ucuzca durdurulur.
 * Bağlantı önizlemesi yapanlar (WhatsApp, Telegram, X, Facebook...) paylaşılan ilanın başlığını görebilsin diye geçer.
 */
const BOT_UA = /bot|crawl|spider|slurp|scrap|curl|wget|python|httpx|go-http|java\/|headless|phantom|axios|node-fetch|okhttp/i;
const PREVIEW_UA = /facebookexternalhit|twitterbot|whatsapp|telegrambot|slackbot|linkedinbot|discordbot|skypeuripreview|applebot|pinterest/i;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/cars/")) {
    const ua = request.headers.get("user-agent") || "";
    if (BOT_UA.test(ua) && !PREVIEW_UA.test(ua)) {
      return new NextResponse("Bu sayfa otomatik taramaya kapalıdır.", {
        status: 403,
        // Önbelleğe alınmaz: CDN adrese göre sakladığı için sonra gelen gerçek ziyaretçi de 403 görürdü.
        headers: { "X-Robots-Tag": "noindex", "Cache-Control": "private, no-store" },
      });
    }
    return NextResponse.next();
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
  // Yalnızca giriş gerektiren sayfalar. Eskiden her sayfa ve her API isteğinde (ilan listesi, fotoğraf,
  // bildirim yoklaması...) çalışıyordu: Vercel'de her istek fazladan bir middleware çağrısı demekti.
  matcher: [
    "/favorites/:path*",
    "/profile/:path*",
    "/sell/:path*",
    "/subscriptions/:path*",
    "/admin/:path*",
    "/offers/:path*",
    "/listings/:path*",
    // Botların ilan sayfalarını çizdirmesini engellemek için (yukarıdaki BOT_UA).
    "/cars/:path*",
  ],
};
