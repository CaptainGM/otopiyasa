import { NextResponse } from "next/server";
import { getNavbarUser, SESSION_FLAG_COOKIE } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { avatarDescriptor, type AvatarDescriptor } from "@/lib/avatar";

/**
 * Menü ve ilan sayfasındaki kişiye özel parçalar için oturum bilgisi. Tarayıcıdaki giriş işareti çerezini de
 * düzeltir: girişliyse koyar, değilse siler (eski oturumlar ve süresi dolanlar için).
 */
export async function GET() {
  const user = await getNavbarUser();
  // Menüdeki rozet için tek, indeksli ve küçük bir okuma (oturum doğrulaması yapılmaz; yalnızca avatar alanları).
  let avatar: AvatarDescriptor = null;
  if (user) {
    try {
      await connectDB();
      avatar = avatarDescriptor(
        await User.findById(user.userId).select("avatarType avatarPreset avatarVersion").lean<{ _id: unknown; avatarType?: string | null; avatarPreset?: string | null; avatarVersion?: number | null }>()
      );
    } catch {
      avatar = null;
    }
  }
  const response = NextResponse.json({
    user: user ? { id: user.userId, name: user.name, role: user.role, avatar } : null,
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
