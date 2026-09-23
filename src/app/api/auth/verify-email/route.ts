import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { createSessionAndToken, setAuthCookie } from "@/lib/auth";
import { hashVerifyToken } from "@/lib/auth-verify";

/**
 * E-posta doğrulama bağlantısı buraya gelir (verify-email sayfası çağırır).
 * Token doğruysa hesap etkinleştirilir ve kullanıcı otomatik giriş yapar.
 */
export async function POST(request: Request) {
  try {
    await connectDB();
    const { email, token } = await request.json();

    if (!email || !token) {
      return NextResponse.json(
        { error: "Doğrulama bağlantısı eksik veya bozuk." },
        { status: 400 }
      );
    }

    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (!user) {
      return NextResponse.json(
        { error: "Doğrulama bağlantısı geçersiz." },
        { status: 400 }
      );
    }

    // Zaten doğrulanmışsa bağlantı ikinci kez tıklanmıştır — hata değil.
    if (user.emailVerified) {
      return NextResponse.json({ alreadyVerified: true, message: "E-postan zaten doğrulanmış." });
    }

    const tokenHash = hashVerifyToken(String(token));
    const valid =
      user.verifyTokenHash === tokenHash &&
      user.verifyTokenExpires &&
      user.verifyTokenExpires.getTime() > Date.now();

    if (!valid) {
      return NextResponse.json(
        { error: "Doğrulama bağlantısının süresi dolmuş veya geçersiz. Yeni bir bağlantı iste." },
        { status: 400 }
      );
    }

    user.emailVerified = true;
    user.verifyTokenHash = null;
    user.verifyTokenExpires = null;
    await user.save();

    // Doğrulandı → otomatik giriş
    const authToken = await createSessionAndToken(
      {
        userId: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role || "user",
      },
      request
    );
    await setAuthCookie(authToken);

    return NextResponse.json({
      message: "E-posta adresin doğrulandı. Hoş geldin!",
      user: { _id: user._id, name: user.name, email: user.email, role: user.role || "user" },
    });
  } catch (error) {
    console.error("POST /api/auth/verify-email error:", error);
    return NextResponse.json({ error: "Doğrulama sırasında bir hata oluştu." }, { status: 500 });
  }
}
