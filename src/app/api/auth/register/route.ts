import { NextResponse } from "next/server";
import { appBaseUrl } from "@/lib/app-url";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { createSessionAndToken, setAuthCookie } from "@/lib/auth";
import { checkRateLimit } from "@/lib/api-rate-limit";
import { passwordError } from "@/lib/password-policy";
import { isDisposableEmail, canonicalEmail } from "@/lib/email-policy";
import { isMailerConfigured, sendVerifyEmail } from "@/lib/mailer";
import { createVerifyToken, buildVerifyUrl, VERIFY_TOKEN_TTL_MS } from "@/lib/auth-verify";

export async function POST(request: Request) {
  try {
    const limited = checkRateLimit(request, "register", { limit: 5 });
    if (limited) return limited;

    await connectDB();
    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Ad, e-posta ve şifre zorunludur." },
        { status: 400 }
      );
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (typeof email !== "string" || !emailPattern.test(email)) {
      return NextResponse.json(
        { error: "Geçerli bir e-posta adresi giriniz." },
        { status: 400 }
      );
    }

    const weak = passwordError(password);
    if (weak) {
      return NextResponse.json({ error: weak }, { status: 400 });
    }

    if (isDisposableEmail(email)) {
      return NextResponse.json(
        { error: "Geçici/tek kullanımlık e-posta adresleriyle kayıt olunamaz." },
        { status: 400 }
      );
    }

    // Aynı kutuya düşen varyantlar da engellenir: Gmail'de "a.b+test@gmail.com"
    // ile "ab@gmail.com" aynı adrestir; yoksa tek kişi sınırsız hesap açabilir.
    const canonical = canonicalEmail(email);
    const existing = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { canonicalEmail: canonical }],
    });
    if (existing) {
      return NextResponse.json(
        { error: "Bu e-posta adresi zaten kayıtlı." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // SMTP yapılandırılıysa e-posta doğrulaması ZORUNLU: hesap oluşturulur ama
    // doğrulanana dek giriş yapamaz (login route bunu kontrol eder). SMTP yoksa
    // (yerel geliştirme) doğrulama beklenmez, hesap anında etkin olur — yoksa
    // e-posta gönderilemediği için kimse giremezdi.
    const requireVerification = isMailerConfigured();

    const { token: verifyToken, tokenHash: verifyTokenHash } = createVerifyToken();
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      canonicalEmail: canonical,
      passwordHash,
      favorites: [],
      emailVerified: !requireVerification,
      verifyTokenHash: requireVerification ? verifyTokenHash : null,
      verifyTokenExpires: requireVerification
        ? new Date(Date.now() + VERIFY_TOKEN_TTL_MS)
        : null,
    });

    if (requireVerification) {
      const appUrl = appBaseUrl();
      const verifyUrl = buildVerifyUrl(appUrl, user.email, verifyToken);
      try {
        await sendVerifyEmail(user.email, verifyUrl);
      } catch (err) {
        console.warn("sendVerifyEmail failed:", err);
      }
      // Otomatik giriş YAPILMAZ — önce e-posta doğrulanmalı.
      return NextResponse.json({
        requiresVerification: true,
        message:
          "Hesabın oluşturuldu. Giriş yapabilmek için e-posta adresine gönderdiğimiz doğrulama bağlantısına tıkla.",
      });
    }

    // Doğrulama gerekmiyorsa (yerel) eskisi gibi otomatik giriş
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
    console.error("POST /api/auth/register error:", error);
    return NextResponse.json(
      { error: "Kayıt sırasında bir hata oluştu." },
      { status: 500 }
    );
  }
}
