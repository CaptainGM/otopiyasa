import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/api-rate-limit";
import { isDisposableEmail, canonicalEmail } from "@/lib/email-policy";
import { sendEmailChangeCode } from "@/lib/mailer";
import { generateCode, hashCode, codeExpiry } from "@/lib/email-change";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const authUser = await getCurrentUser();
    if (!authUser) {
      return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });
    }

    const limited = checkRateLimit(request, "email-change-start", { limit: 5 });
    if (limited) return limited;

    const { newEmail } = await request.json();

    if (typeof newEmail !== "string" || !EMAIL_PATTERN.test(newEmail)) {
      return NextResponse.json({ error: "Geçerli bir e-posta adresi giriniz." }, { status: 400 });
    }
    if (isDisposableEmail(newEmail)) {
      return NextResponse.json(
        { error: "Geçici/tek kullanımlık e-posta adresleri kullanılamaz." },
        { status: 400 }
      );
    }

    await connectDB();
    const user = await User.findById(authUser.userId);
    if (!user) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
    }

    const normalizedNew = newEmail.toLowerCase().trim();
    if (normalizedNew === user.email) {
      return NextResponse.json(
        { error: "Bu adres zaten kayıtlı e-postan." },
        { status: 400 }
      );
    }

    const canonical = canonicalEmail(normalizedNew);
    const existing = await User.findOne({
      _id: { $ne: user._id },
      $or: [{ email: normalizedNew }, { canonicalEmail: canonical }],
    });
    if (existing) {
      return NextResponse.json(
        { error: "Bu e-posta adresi başka bir hesapta kayıtlı." },
        { status: 409 }
      );
    }

    const code = generateCode();
    user.emailChangePendingEmail = normalizedNew;
    user.emailChangeCurrentCodeHash = hashCode(code);
    user.emailChangeNewCodeHash = null;
    user.emailChangeCodeExpires = codeExpiry();
    user.emailChangeAttempts = 0;
    await user.save();

    try {
      await sendEmailChangeCode(user.email, { code, stage: "current", newEmail: normalizedNew });
    } catch (err) {
      console.warn("sendEmailChangeCode (current) failed:", err);
    }

    const payload: Record<string, unknown> = {
      stage: "awaiting-current",
      message: `Mevcut e-postana (${user.email}) bir doğrulama kodu gönderdik.`,
      expiresInMinutes: 15,
    };
    if (process.env.NODE_ENV !== "production") payload.devCode = code;

    return NextResponse.json(payload);
  } catch (error) {
    console.error("POST /api/auth/email-change/start error:", error);
    return NextResponse.json({ error: "İşlem başlatılamadı." }, { status: 500 });
  }
}
