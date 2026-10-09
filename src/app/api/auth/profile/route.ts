import { NextResponse } from "next/server";
import { readJson } from "@/lib/http";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { getCurrentUser } from "@/lib/auth";
import { checkSharedRateLimit } from "@/lib/api-rate-limit";

const NAME_MIN = 2;
const NAME_MAX = 60;

/** Profil bilgisi (şimdilik ad soyad) güncellenir. E-posta ve şifre kendi akışlarından değişir. */
export async function PATCH(request: Request) {
  try {
    const authUser = await getCurrentUser();
    if (!authUser) {
      return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });
    }

    const limited = await checkSharedRateLimit(request, "profile-update", { limit: 10 });
    if (limited) return limited;

    const { name } = await readJson(request, { flat: true });
    const cleaned = typeof name === "string" ? name.replace(/\s+/g, " ").trim() : "";
    if (cleaned.length < NAME_MIN) {
      return NextResponse.json({ error: `Ad soyad en az ${NAME_MIN} karakter olmalı.` }, { status: 400 });
    }
    if (cleaned.length > NAME_MAX) {
      return NextResponse.json({ error: `Ad soyad en fazla ${NAME_MAX} karakter olabilir.` }, { status: 400 });
    }
    // Ad yorum ve e-postalarda gösterilir; köşeli/açılı ayraç ve bağlantı biçimi kabul edilmez.
    if (/[<>]|https?:|www\./i.test(cleaned)) {
      return NextResponse.json({ error: "Ad soyadda bağlantı ya da özel karakter olamaz." }, { status: 400 });
    }

    await connectDB();
    const user = await User.findByIdAndUpdate(authUser.userId, { $set: { name: cleaned } }, { new: true }).select("name");
    if (!user) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
    }
    return NextResponse.json({ message: "Profilin güncellendi.", user: { name: user.name } });
  } catch (error) {
    console.error("PATCH /api/auth/profile error:", error);
    return NextResponse.json({ error: "Profil güncellenemedi." }, { status: 500 });
  }
}
