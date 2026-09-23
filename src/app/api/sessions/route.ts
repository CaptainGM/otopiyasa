import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";
import { Session } from "@/models/Session";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });
    }

    await connectDB();
    const sessions = await Session.find({ userId: user.userId, revokedAt: null })
      .sort({ lastSeenAt: -1 })
      .lean<
        { _id: unknown; jti: string; deviceLabel: string; lastSeenAt: Date; createdAt: Date }[]
      >();

    return NextResponse.json({
      sessions: sessions.map((s) => ({
        id: String(s._id),
        deviceLabel: s.deviceLabel,
        lastSeenAt: s.lastSeenAt,
        createdAt: s.createdAt,
        current: s.jti === user.jti,
      })),
    });
  } catch (error) {
    console.error("GET /api/sessions error:", error);
    return NextResponse.json(
      { error: "Cihazlar yüklenirken bir hata oluştu." },
      { status: 500 }
    );
  }
}
