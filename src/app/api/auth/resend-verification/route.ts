import { NextResponse } from "next/server";
import { appBaseUrl } from "@/lib/app-url";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { checkRateLimit } from "@/lib/api-rate-limit";
import { isMailerConfigured, sendVerifyEmail } from "@/lib/mailer";
import { createVerifyToken, buildVerifyUrl, VERIFY_TOKEN_TTL_MS } from "@/lib/auth-verify";

/**
 * Doğrulama e-postasını yeniden gönderir (bağlantı kaybolduysa/süresi dolduysa).
 * Kayıtlı e-postayı ele vermemek için, hesap olmasa da hep aynı yanıtı döner.
 */
export async function POST(request: Request) {
  try {
    const limited = checkRateLimit(request, "resend-verification", { limit: 3 });
    if (limited) return limited;

    await connectDB();
    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ error: "E-posta zorunludur." }, { status: 400 });
    }

    const genericMessage = {
      message: "Hesap doğrulanmamışsa yeni bir doğrulama bağlantısı gönderildi.",
    };

    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    // Yoksa ya da zaten doğrulanmışsa sessizce aynı yanıt (bilgi sızmasın)
    if (!user || user.emailVerified) return NextResponse.json(genericMessage);

    if (!isMailerConfigured()) {
      return NextResponse.json(
        { error: "E-posta gönderimi yapılandırılmadığı için doğrulama gönderilemiyor." },
        { status: 503 }
      );
    }

    const { token, tokenHash } = createVerifyToken();
    user.verifyTokenHash = tokenHash;
    user.verifyTokenExpires = new Date(Date.now() + VERIFY_TOKEN_TTL_MS);
    await user.save();

    const appUrl = appBaseUrl();
    try {
      await sendVerifyEmail(user.email, buildVerifyUrl(appUrl, user.email, token));
    } catch (err) {
      console.warn("resend sendVerifyEmail failed:", err);
    }

    return NextResponse.json(genericMessage);
  } catch (error) {
    console.error("POST /api/auth/resend-verification error:", error);
    return NextResponse.json({ error: "İşlem sırasında bir hata oluştu." }, { status: 500 });
  }
}
