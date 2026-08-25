import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getCurrentUser, clearAuthCookie } from "@/lib/auth";
import { Session } from "@/models/Session";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });
    }

    await connectDB();
    const { id } = await context.params;
    // Sahiplik kontrolü — başka bir kullanıcının oturumu iptal edilemez.
    const session = await Session.findOne({ _id: id, userId: user.userId });
    if (!session) {
      return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 404 });
    }

    const wasCurrent = session.jti === user.jti;
    session.revokedAt = new Date();
    await session.save();

    if (wasCurrent) {
      // Kullanıcı kendi bulunduğu cihazı listeden çıkardıysa çerezi de temizle.
      await clearAuthCookie();
    }

    return NextResponse.json({ success: true, wasCurrent });
  } catch (error) {
    console.error("DELETE /api/sessions/[id] error:", error);
    return NextResponse.json(
      { error: "Oturum sonlandırılırken bir hata oluştu." },
      { status: 500 }
    );
  }
}
