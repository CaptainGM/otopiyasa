import { NextResponse } from "next/server";
import { appBaseUrl } from "@/lib/app-url";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { createResetToken } from "@/lib/password";
import { sendResetEmail } from "@/lib/mailer";
import { checkRateLimit } from "@/lib/api-rate-limit";

export async function POST(request: Request) {
  try {
    const limited = checkRateLimit(request, "forgot-password", { limit: 5 });
    if (limited) return limited;

    await connectDB();
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "E-posta zorunludur." }, { status: 400 });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      return NextResponse.json({
        message:
          "Bu e-posta kayıtlıysa şifre sıfırlama bağlantısı oluşturuldu.",
      });
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

    const responsePayload: any = { message: "Şifre sıfırlama bağlantısı oluşturuldu.", expiresInMinutes: 60 };
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
