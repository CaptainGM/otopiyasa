import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { createSessionAndToken, setAuthCookie } from "@/lib/auth";
import { checkRateLimit } from "@/lib/api-rate-limit";
import { isEmailVerified } from "@/lib/auth-verify";

export async function POST(request: Request) {
  try {
    const limited = checkRateLimit(request, "login", { limit: 10 });
    if (limited) return limited;

    await connectDB();
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "E-posta ve şifre zorunludur." },
        { status: 400 }
      );
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return NextResponse.json(
        { error: "E-posta veya şifre hatalı." },
        { status: 401 }
      );
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "E-posta veya şifre hatalı." },
        { status: 401 }
      );
    }

    // Yalnızca açıkça doğrulanmamış (yeni) hesaplar bloklanır; alanı olmayan
    // eski kullanıcılar geçer (bkz. lib/auth-verify.ts). 403 + needsVerification
    // → arayüz "tekrar gönder" seçeneği sunar.
    if (!isEmailVerified(user)) {
      return NextResponse.json(
        {
          error: "E-posta adresin henüz doğrulanmadı. Gelen kutunu kontrol et.",
          needsVerification: true,
        },
        { status: 403 }
      );
    }

    const token = await createSessionAndToken(
      {
        userId: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role || "user",
      },
      request
    );
    await setAuthCookie(token);

    return NextResponse.json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role || "user",
      },
    });
  } catch (error) {
    console.error("POST /api/auth/login error:", error);
    return NextResponse.json(
      { error: "Giriş sırasında bir hata oluştu." },
      { status: 500 }
    );
  }
}
