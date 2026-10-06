import { NextResponse } from "next/server";
import { readJson } from "@/lib/http";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { createSessionAndToken, setAuthCookie } from "@/lib/auth";
import { checkKeyRateLimit, checkSharedRateLimit } from "@/lib/api-rate-limit";
import { isEmailVerified } from "@/lib/auth-verify";

// Hesap yokken de bcrypt çalışsın: yanıt süresi "bu e-posta kayıtlı mı" bilgisini ele vermesin.
let dummyHash: string | null = null;
function getDummyHash(): string {
  if (!dummyHash) dummyHash = bcrypt.hashSync("otopiyasa-olmayan-hesap", 10);
  return dummyHash;
}

export async function POST(request: Request) {
  try {
    const limited = await checkSharedRateLimit(request, "login", { limit: 10 });
    if (limited) return limited;

    await connectDB();
    const { email, password } = await readJson(request, { flat: true });

    if (!email || !password) {
      return NextResponse.json(
        { error: "E-posta ve şifre zorunludur." },
        { status: 400 }
      );
    }

    // Hesap başına sınır: farklı IP'lerden aynı hesaba şifre denemesi (IP sınırı tek başına durdurmaz).
    const accountLimited = await checkKeyRateLimit("login-account", email, { limit: 10, windowMs: 15 * 60 * 1000 });
    if (accountLimited) return accountLimited;

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      await bcrypt.compare(password, getDummyHash());
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
