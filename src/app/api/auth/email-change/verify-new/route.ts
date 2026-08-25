import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/api-rate-limit";
import { canonicalEmail } from "@/lib/email-policy";
import { codeMatches, stageOf, MAX_CODE_ATTEMPTS } from "@/lib/email-change";

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

    const clearPending = () => {
      user.emailChangePendingEmail = null;
      user.emailChangeCurrentCodeHash = null;
      user.emailChangeNewCodeHash = null;
      user.emailChangeCodeExpires = null;
      user.emailChangeAttempts = 0;
    };

    if (stage !== "awaiting-new") {
      clearPending();
      await user.save();
      return NextResponse.json(
        { error: "İşlemin süresi doldu ya da bulunamadı. E-posta değiştirmeyi yeniden başlat." },
        { status: 400 }
      );
    }

    if (user.emailChangeAttempts >= MAX_CODE_ATTEMPTS) {
      clearPending();
      await user.save();
      return NextResponse.json(
        { error: "Çok fazla hatalı deneme. E-posta değiştirmeyi yeniden başlat." },
        { status: 429 }
      );
    }

    if (!codeMatches(code, user.emailChangeNewCodeHash)) {
      user.emailChangeAttempts += 1;
      await user.save();
      const remaining = MAX_CODE_ATTEMPTS - user.emailChangeAttempts;
      return NextResponse.json(
        { error: `Kod hatalı. ${remaining > 0 ? `${remaining} deneme hakkın kaldı.` : ""}`.trim() },
        { status: 400 }
      );
    }

    const finalEmail = user.emailChangePendingEmail!;
    const canonical = canonicalEmail(finalEmail);

    // Kod gönderildikten sonra bu adres başka bir hesapça alınmış olabilir — son an kontrolü.
    const takenBySomeoneElse = await User.findOne({
      _id: { $ne: user._id },
      $or: [{ email: finalEmail }, { canonicalEmail: canonical }],
    });
    if (takenBySomeoneElse) {
      clearPending();
      await user.save();
      return NextResponse.json(
        { error: "Bu e-posta adresi az önce başka bir hesapta kayıt oldu. Farklı bir adresle tekrar dene." },
        { status: 409 }
      );
    }

    user.email = finalEmail;
    user.canonicalEmail = canonical;
    user.emailVerified = true;
    clearPending();
    await user.save();

    return NextResponse.json({
      success: true,
      stage: "idle",
      message: "E-posta adresin güncellendi.",
      email: finalEmail,
    });
  } catch (error) {
    console.error("POST /api/auth/email-change/verify-new error:", error);
    return NextResponse.json({ error: "Kod doğrulanamadı." }, { status: 500 });
  }
}
