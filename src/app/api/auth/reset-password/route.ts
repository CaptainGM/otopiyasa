import { NextResponse } from "next/server";
import { passwordError } from "@/lib/password-policy";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { hashPassword, hashResetToken } from "@/lib/password";
import { checkSharedRateLimit } from "@/lib/api-rate-limit";
import { Session } from "@/models/Session";
import { attemptsLeft, checkResetCode } from "@/lib/reset-code";

export async function POST(request: Request) {
  try {
    // Token'ı TÜKETEN asıl uç nokta — /forgot-password (mail gönderimi) zaten
    // sınırlı ama bu uçta hiç sınır yoktu; savunma derinliği için eklendi.
    const limited = await checkSharedRateLimit(request, "reset-password", { limit: 10, windowMs: 15 * 60 * 1000 });
    if (limited) return limited;

    await connectDB();
    const { email, token, code, password, confirmPassword } = await request.json();

    // Web e-postadaki bağlantıdan gelen `token` ile, mobil uygulama 6 haneli `code` ile sıfırlar.
    if (!email || (!token && !code) || !password) {
      return NextResponse.json(
        { error: "E-posta, sıfırlama kodu ve yeni şifre zorunludur." },
        { status: 400 }
      );
    }

    // Tekrar alanı gönderildiyse sunucuda da doğrula (change-password ile aynı
    // davranış). İstemci kontrolü tek başına yeterli değil: bu uç noktaya
    // doğrudan istek atılabilir.
    if (confirmPassword !== undefined && password !== confirmPassword) {
      return NextResponse.json(
        { error: "Şifreler birbiriyle eşleşmiyor." },
        { status: 400 }
      );
    }

    const weak = passwordError(password);
    if (weak) {
      return NextResponse.json({ error: weak }, { status: 400 });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (token) {
      if (!user || !user.resetTokenHash || !user.resetTokenExpires) {
        return NextResponse.json(
          { error: "Geçersiz veya süresi dolmuş sıfırlama bağlantısı." },
          { status: 400 }
        );
      }

      if (user.resetTokenExpires.getTime() < Date.now()) {
        return NextResponse.json(
          { error: "Sıfırlama bağlantısının süresi dolmuş." },
          { status: 400 }
        );
      }

      const tokenHash = hashResetToken(token);
      if (tokenHash !== user.resetTokenHash) {
        return NextResponse.json(
          { error: "Geçersiz sıfırlama kodu." },
          { status: 400 }
        );
      }
    } else {
      const state = user ? checkResetCode(user, String(code)) : "expired";
      if (!user || state === "expired") {
        return NextResponse.json(
          { error: "Kodun süresi dolmuş ya da hiç istenmemiş. Yeni bir kod iste." },
          { status: 400 }
        );
      }
      if (state === "locked") {
        user.resetCodeHash = null;
        user.resetCodeExpires = null;
        user.resetCodeAttempts = 0;
        await user.save();
        return NextResponse.json(
          { error: "Çok fazla hatalı deneme. Yeni bir kod iste." },
          { status: 429 }
        );
      }
      if (state === "wrong") {
        user.resetCodeAttempts = (user.resetCodeAttempts || 0) + 1;
        await user.save();
        const left = attemptsLeft(user.resetCodeAttempts);
        return NextResponse.json(
          { error: `Kod hatalı.${left > 0 ? ` ${left} deneme hakkın kaldı.` : " Yeni bir kod iste."}` },
          { status: 400 }
        );
      }
    }

    user.passwordHash = await hashPassword(password);
    user.resetTokenHash = null;
    user.resetTokenExpires = null;
    user.resetCodeHash = null;
    user.resetCodeExpires = null;
    user.resetCodeAttempts = 0;
    await user.save();

    // E-posta ile şifre sıfırlama = hesap ele geçirilmiş olabileceği
    // ihtimaline karşı en güçlü sinyal. Bu akışta "kendi cihazım" diye
    // korunacak bir oturum yok (kullanıcı zaten yeniden giriş yapacak) —
    // TÜM cihazlardaki oturumlar kapatılır.
    await Session.updateMany(
      { userId: user._id, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );

    return NextResponse.json({
      message:
        "Şifren başarıyla güncellendi. Güvenlik için tüm cihazlardaki oturumlar kapatıldı, tekrar giriş yapabilirsin.",
    });
  } catch (error) {
    console.error("POST /api/auth/reset-password error:", error);
    return NextResponse.json(
      { error: "Şifre güncellenemedi." },
      { status: 500 }
    );
  }
}
