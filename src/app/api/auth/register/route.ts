import { NextResponse } from "next/server";
import { readJson } from "@/lib/http";
import { appBaseUrl } from "@/lib/app-url";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { createSessionAndToken, setAuthCookie } from "@/lib/auth";
import { checkSharedRateLimit } from "@/lib/api-rate-limit";
import { passwordError } from "@/lib/password-policy";
import { isDisposableEmail, canonicalEmail } from "@/lib/email-policy";
import { isMailerConfigured, sendVerifyEmail } from "@/lib/mailer";
import { createVerifyToken, buildVerifyUrl, VERIFY_TOKEN_TTL_MS, MAX_VERIFY_RESENDS } from "@/lib/auth-verify";

export async function POST(request: Request) {
  try {
    const limited = await checkSharedRateLimit(request, "register", { limit: 5 });
    if (limited) return limited;

    await connectDB();
    const { name, email, password } = await readJson(request, { flat: true });

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Ad, e-posta ve şifre zorunludur." },
        { status: 400 }
      );
    }

    if (String(name).trim().length > 60) {
      return NextResponse.json({ error: "Ad en fazla 60 karakter olabilir." }, { status: 400 });
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
      // E-postasını hiç doğrulamamış biri tekrar kayıt olmaya çalışıyorsa çıkmaz sokakta kalmasın: doğrulama e-postasını
      // tekrar gönderebileceği yere yönlendirilir (giriş ekranı da aynı bilgiyi veriyor).
      if (existing.emailVerified === false) {
        return NextResponse.json(
          {
            error: "Bu e-posta ile bir hesap açılmış ama henüz doğrulanmamış. Aşağıdan doğrulama e-postasını tekrar gönderebilirsin.",
            needsVerification: true,
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Bu e-posta adresi zaten kayıtlı." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const mailerConfigured = isMailerConfigured();
    if (process.env.NODE_ENV === "production" && !mailerConfigured) {
      return NextResponse.json(
        { error: "Kayıt için e-posta gönderimi yapılandırılmalıdır." },
        { status: 503 }
      );
    }

    // Production'da e-posta doğrulaması zorunludur; SMTP yapılandırması yoksa
    // hesap doğrulanmış gibi açılmaz.
    // Yerel geliştirmede SMTP yoksa doğrulama devre dışı kalır.
    const requireVerification = process.env.NODE_ENV === "production" || mailerConfigured;

    const { token: verifyToken, tokenHash: verifyTokenHash } = createVerifyToken();
    const user = await User.create({
      name: String(name).trim().slice(0, 60),
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
      let mailSent = true;
      try {
        await sendVerifyEmail(user.email, verifyUrl);
      } catch (err) {
        mailSent = false;
        console.warn("sendVerifyEmail failed:", err);
      }
      // Otomatik giriş YAPILMAZ — önce e-posta doğrulanmalı. Gönderim başarısızsa (posta kotası dolu vb.) bunu saklamayız:
      // kullanıcı "tekrar gönder" ile dener.
      return NextResponse.json({
        requiresVerification: true,
        mailSent,
        resendsLeft: MAX_VERIFY_RESENDS,
        message: mailSent
          ? "Hesabın oluşturuldu. Giriş yapabilmek için e-posta adresine gönderdiğimiz doğrulama bağlantısına tıkla."
          : "Hesabın oluşturuldu ama doğrulama e-postası şu an gönderilemedi. Birkaç dakika sonra aşağıdan tekrar göndermeyi dene.",
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
