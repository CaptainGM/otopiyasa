import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clearAuthCookie, verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Session } from "@/models/Session";

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
      }
    }
  } catch (error) {
    console.error("Çıkışta oturum kaydı iptal edilemedi:", error);
  }
  await clearAuthCookie();
  return NextResponse.json({ success: true });
}
