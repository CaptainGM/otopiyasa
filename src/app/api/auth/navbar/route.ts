import { NextResponse } from "next/server";
import { getNavbarUser, SESSION_FLAG_COOKIE } from "@/lib/auth";

/**
 * Menü ve ilan sayfasındaki kişiye özel parçalar için oturum bilgisi. Tarayıcıdaki giriş işareti çerezini de
 * düzeltir: girişliyse koyar, değilse siler (eski oturumlar ve süresi dolanlar için).
 */
export async function GET() {
  const user = await getNavbarUser();
  const response = NextResponse.json({
    user: user ? { id: user.userId, name: user.name, role: user.role } : null,
  });
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Vercel-CDN-Cache-Control", "no-store");
  if (user) {
    response.cookies.set(SESSION_FLAG_COOKIE, "1", {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
  } else {
    response.cookies.set(SESSION_FLAG_COOKIE, "", { path: "/", maxAge: 0 });
  }
  return response;
}
