import { NextResponse } from "next/server";
import { readJson } from "@/lib/http";
import { appBaseUrl } from "@/lib/app-url";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { createResetToken } from "@/lib/password";
import { sendResetEmail, sendResetCodeEmail } from "@/lib/mailer";
import { generateCode, hashCode, codeExpiry } from "@/lib/email-change";
import { checkSharedRateLimit } from "@/lib/api-rate-limit";

export async function POST(request: Request) {
  try {
    const limited = await checkSharedRateLimit(request, "forgot-password", { limit: 5 });
    if (limited) return limited;

    await connectDB();
    const { email, method } = await readJson(request, { flat: true });

    if (!email) {
      return NextResponse.json({ error: "E-posta zorunludur." }, { status: 400 });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    // Mobil uygulama bağlantı yerine 6 haneli kod ister (uygulamadan çıkmadan sıfırlasın).
    const byCode = method === "code";
    const genericResponse = {
      message: byCode
        ? "Bu e-posta kayıtlıysa 6 haneli sıfırlama kodu gönderilecektir."
        : "Bu e-posta kayıtlıysa şifre sıfırlama bağlantısı gönderilecektir.",
    };
    if (!user) return NextResponse.json(genericResponse);

    if (byCode) {
      const code = generateCode();
      user.resetCodeHash = hashCode(code);
      user.resetCodeExpires = codeExpiry();
      user.resetCodeAttempts = 0;
      await user.save();
      try {
        await sendResetCodeEmail(user.email, code);
      } catch (err) {
        console.warn("sendResetCodeEmail failed:", err);
      }
      const payload: Record<string, unknown> = { ...genericResponse };
      if (process.env.NODE_ENV !== "production") payload.resetCode = code;
      return NextResponse.json(payload);
    }

    const { token, tokenHash } = createResetToken();
    user.resetTokenHash = tokenHash;
    user.resetTokenExpires = new Date(Date.now() + 1000 * 60 * 60);
    await user.save();

    const appUrl = appBaseUrl();
    const resetUrl = `${appUrl}/reset-password?email=${encodeURIComponent(
      user.email
    )}&token=${token}`;

    // Try to send email if SMTP is configured; fall back to returning URL in non-production
    try {
      await sendResetEmail(user.email, resetUrl);
    } catch (err) {
      console.warn("sendResetEmail failed:", err);
      // do not fail the request; keep behavior for development
    }

    const responsePayload: Record<string, unknown> = genericResponse;
    if (process.env.NODE_ENV !== "production") responsePayload.resetUrl = resetUrl;

    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error("POST /api/auth/forgot-password error:", error);
    return NextResponse.json(
      { error: "Şifre sıfırlama isteği oluşturulamadı." },
      { status: 500 }
    );
  }
}
