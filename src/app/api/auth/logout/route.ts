import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clearAuthCookie, verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Session } from "@/models/Session";
import { forgetPushForSessions } from "@/lib/push-sessions";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (token) {
      const payload = await verifyToken(token);
      if (payload?.jti) {
        await connectDB();
        await Session.updateOne(
          { jti: payload.jti },
          { $set: { revokedAt: new Date() } }
        );
        // Bu cihazın bildirim jetonu/aboneliği de silinir: çıkış yapılan cihaza bildirim gitmez.
        await forgetPushForSessions([payload.jti]);
      }
    }
  } catch (error) {
    console.error("Çıkışta oturum kaydı iptal edilemedi:", error);
    await clearAuthCookie();
    return NextResponse.json({ error: "Oturum güvenli biçimde kapatılamadı." }, { status: 503 });
  }

  await clearAuthCookie();
  return NextResponse.json({ success: true });
}
