import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clearAuthCookie, verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Session } from "@/models/Session";

export async function POST() {
  await clearAuthCookie();

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (token) {
      // Arka planda oturumu revoke et, HTTP yanıtını asla bekletme
      void (async () => {
        try {
          const payload = await verifyToken(token);
          if (payload?.jti) {
            await connectDB();
            await Session.updateOne(
              { jti: payload.jti },
              { $set: { revokedAt: new Date() } }
            );
          }
        } catch {
          // ignore
        }
      })();
    }
  } catch (error) {
    console.error("Çıkışta oturum kaydı iptal edilemedi:", error);
  }

  return NextResponse.json({ success: true });
}
