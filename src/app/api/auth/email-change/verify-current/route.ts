import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/api-rate-limit";
import { sendEmailChangeCode } from "@/lib/mailer";
import {
  generateCode,
  hashCode,
  codeMatches,
  codeExpiry,
  stageOf,
  MAX_CODE_ATTEMPTS,
} from "@/lib/email-change";

export async function POST(request: Request) {
  try {
    const authUser = await getCurrentUser();
    if (!authUser) {
      return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });
    }

    const limited = checkRateLimit(request, "email-change-verify", { limit: 20 });
    if (limited) return limited;

    const { code } = await request.json();
    if (!code) {
      return NextResponse.json({ error: "Kod zorunludur." }, { status: 400 });
    }

    await connectDB();
    const user = await User.findById(authUser.userId);
    if (!user) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
    }

    const stage = stageOf({
      pendingEmail: user.emailChangePendingEmail,
      currentCodeHash: user.emailChangeCurrentCodeHash,
      newCodeHash: user.emailChangeNewCodeHash,
      codeExpires: user.emailChangeCodeExpires,
    });

    if (stage !== "awaiting-current") {
      user.emailChangePendingEmail = null;
      user.emailChangeCurrentCodeHash = null;
      user.emailChangeNewCodeHash = null;
      user.emailChangeCodeExpires = null;
      user.emailChangeAttempts = 0;
      await user.save();
      return NextResponse.json(
        { error: "İşlemin süresi doldu ya da bulunamadı. E-posta değiştirmeyi yeniden başlat." },
        { status: 400 }
      );
    }

    if (user.emailChangeAttempts >= MAX_CODE_ATTEMPTS) {
      user.emailChangePendingEmail = null;
      user.emailChangeCurrentCodeHash = null;
      user.emailChangeNewCodeHash = null;
      user.emailChangeCodeExpires = null;
      user.emailChangeAttempts = 0;
      await user.save();
      return NextResponse.json(
        { error: "Çok fazla hatalı deneme. E-posta değiştirmeyi yeniden başlat." },
        { status: 429 }
      );
    }

    if (!codeMatches(code, user.emailChangeCurrentCodeHash)) {
      user.emailChangeAttempts += 1;
      await user.save();
      const remaining = MAX_CODE_ATTEMPTS - user.emailChangeAttempts;
      return NextResponse.json(
        { error: `Kod hatalı. ${remaining > 0 ? `${remaining} deneme hakkın kaldı.` : ""}`.trim() },
        { status: 400 }
      );
    }

    const newCode = generateCode();
    user.emailChangeCurrentCodeHash = null;
    user.emailChangeNewCodeHash = hashCode(newCode);
    user.emailChangeCodeExpires = codeExpiry();
    user.emailChangeAttempts = 0;
    await user.save();

    try {
      await sendEmailChangeCode(user.emailChangePendingEmail!, { code: newCode, stage: "new" });
    } catch (err) {
      console.warn("sendEmailChangeCode (new) failed:", err);
    }

    const payload: Record<string, unknown> = {
      stage: "awaiting-new",
      message: `Yeni adresine (${user.emailChangePendingEmail}) bir doğrulama kodu gönderdik.`,
      expiresInMinutes: 15,
    };
    if (process.env.NODE_ENV !== "production") payload.devCode = newCode;

    return NextResponse.json(payload);
  } catch (error) {
    console.error("POST /api/auth/email-change/verify-current error:", error);
    return NextResponse.json({ error: "Kod doğrulanamadı." }, { status: 500 });
  }
}
