import { NextResponse } from "next/server";
import { readJson } from "@/lib/http";
import { appBaseUrl } from "@/lib/app-url";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { checkKeyRateLimit, checkSharedRateLimit } from "@/lib/api-rate-limit";
import { isMailerConfigured, sendVerifyEmail } from "@/lib/mailer";
import { createVerifyToken, buildVerifyUrl, VERIFY_TOKEN_TTL_MS, MAX_VERIFY_RESENDS } from "@/lib/auth-verify";

/**
 * Doğrulama e-postasını yeniden gönderir (bağlantı kaybolduysa/süresi dolduysa). Hesap başına en fazla [MAX_VERIFY_RESENDS] kez:
 * posta sağlayıcısının günlük kotası sınırlı, sınırsız gönderim kotayı tüketir.
 * Kayıtlı e-postayı ele vermemek için, hesap olmasa da hep aynı yanıtı döner.
 */
export async function POST(request: Request) {
  try {
    const limited = await checkSharedRateLimit(request, "resend-verification", { limit: 3 });
    if (limited) return limited;

    await connectDB();
    const { email } = await readJson(request, { flat: true });
    if (!email) {
      return NextResponse.json({ error: "E-posta zorunludur." }, { status: 400 });
    }

    const accountLimited = await checkKeyRateLimit("resend-account", String(email), { limit: 3, windowMs: 60 * 60 * 1000 });
    if (accountLimited) return accountLimited;

    const genericMessage = {
      message: "Hesap doğrulanmamışsa yeni bir doğrulama bağlantısı gönderildi.",
    };

    const address = String(email).toLowerCase().trim();
    const user = await User.findOne({ email: address }).select("emailVerified verifyResendCount");
    // Yoksa ya da zaten doğrulanmışsa sessizce aynı yanıt (bilgi sızmasın)
    if (!user || user.emailVerified) return NextResponse.json(genericMessage);

    if ((user.verifyResendCount || 0) >= MAX_VERIFY_RESENDS) {
      return NextResponse.json(
        {
          error: `Doğrulama e-postasını en fazla ${MAX_VERIFY_RESENDS} kez tekrar gönderebilirsin. Gelmediyse spam/gereksiz klasörüne bak.`,
          resendsLeft: 0,
        },
        { status: 429 }
      );
    }

    if (!isMailerConfigured()) {
      return NextResponse.json(
        { error: "E-posta gönderimi yapılandırılmadığı için doğrulama gönderilemiyor." },
        { status: 503 }
      );
    }

    // Hak, gönderimden ÖNCE ve tek işlemde ayrılır (aynı anda gelen isteklerle sınır aşılamasın); gönderim başarısız olursa iade edilir.
    const { token, tokenHash } = createVerifyToken();
    const reserved = await User.findOneAndUpdate(
      { _id: user._id, emailVerified: { $ne: true }, verifyResendCount: { $not: { $gte: MAX_VERIFY_RESENDS } } },
      {
        $inc: { verifyResendCount: 1 },
        $set: { verifyTokenHash: tokenHash, verifyTokenExpires: new Date(Date.now() + VERIFY_TOKEN_TTL_MS) },
      },
      { new: true }
    ).select("email verifyResendCount");
    if (!reserved) {
      return NextResponse.json({ error: "Tekrar gönderme hakkın doldu.", resendsLeft: 0 }, { status: 429 });
    }

    try {
      await sendVerifyEmail(reserved.email, buildVerifyUrl(appBaseUrl(), reserved.email, token));
    } catch (err) {
      console.warn("resend sendVerifyEmail failed:", err);
      await User.updateOne({ _id: reserved._id, verifyResendCount: { $gt: 0 } }, { $inc: { verifyResendCount: -1 } });
      return NextResponse.json(
        {
          error: "E-posta şu an gönderilemedi (gönderim kotası dolmuş olabilir). Hakkın düşülmedi, biraz sonra tekrar dene.",
          resendsLeft: MAX_VERIFY_RESENDS - Math.max(0, (reserved.verifyResendCount || 1) - 1),
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ...genericMessage,
      resendsLeft: Math.max(0, MAX_VERIFY_RESENDS - (reserved.verifyResendCount || 0)),
    });
  } catch (error) {
    console.error("POST /api/auth/resend-verification error:", error);
    return NextResponse.json({ error: "İşlem sırasında bir hata oluştu." }, { status: 500 });
  }
}
