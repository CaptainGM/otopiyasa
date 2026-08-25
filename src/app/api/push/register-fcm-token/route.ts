import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";
import { FcmToken } from "@/models/FcmToken";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const token = body.token;
    if (typeof token !== "string" || !token) {
      return NextResponse.json({ error: "Geçersiz jeton." }, { status: 400 });
    }

    await connectDB();
    // Aynı jeton başka bir kullanıcıda kayıtlıysa (aynı cihazda hesap
    // değişimi) o kaydı bu kullanıcıya taşı — çift kayıt kalmasın.
    await FcmToken.updateOne(
      { token },
      { $set: { userId: user.userId, token } },
      { upsert: true }
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/push/register-fcm-token error:", error);
    return NextResponse.json({ error: "Jeton kaydedilemedi." }, { status: 500 });
  }
}
