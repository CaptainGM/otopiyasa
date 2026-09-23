import { NextResponse } from "next/server";
import { passwordError } from "@/lib/password-policy";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { getCurrentUser } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { Session } from "@/models/Session";

export async function POST(request: Request) {
  try {
    const authUser = await getCurrentUser();
    if (!authUser) {
      return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });
    }

    const { currentPassword, newPassword, confirmPassword } = await request.json();

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { error: "Tüm alanları doldurun." },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: "Yeni şifreler birbiriyle eşleşmiyor." },
        { status: 400 }
      );
    }

    const weak = passwordError(newPassword);
    if (weak) {
      return NextResponse.json({ error: weak }, { status: 400 });
    }

    await connectDB();
    const user = await User.findById(authUser.userId);
    if (!user) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
    }

    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "Mevcut şifreniz hatalı." },
        { status: 400 }
      );
    }

    const sameAsOld = await verifyPassword(newPassword, user.passwordHash);
    if (sameAsOld) {
      return NextResponse.json(
        { error: "Yeni şifre mevcut şifreyle aynı olamaz." },
        { status: 400 }
      );
    }

    user.passwordHash = await hashPassword(newPassword);
    await user.save();

    // Güvenlik: şifre değişince bu cihaz HARİÇ diğer tüm cihazlardaki
    // oturumlar kapatılır (hesaba başka bir cihazdan girilmişse şifre
    // değişikliği onu anında düşürür; kullanıcı kendi cihazında oturum
    // açık kalır çünkü zaten eski şifreyi doğrulayarak buraya geldi).
    await Session.updateMany(
      { userId: authUser.userId, jti: { $ne: authUser.jti }, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );

    return NextResponse.json({
      success: true,
      message: "Şifreniz güncellendi. Diğer cihazlardaki oturumlar güvenlik için kapatıldı.",
    });
  } catch (error) {
    console.error("POST /api/auth/change-password error:", error);
    return NextResponse.json(
      { error: "Şifre güncellenirken bir hata oluştu." },
      { status: 500 }
    );
  }
}
