import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";
import { PushSubscription } from "@/models/PushSubscription";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const sub = body.subscription;
    if (
      !sub ||
      typeof sub.endpoint !== "string" ||
      !sub.keys ||
      typeof sub.keys.p256dh !== "string" ||
      typeof sub.keys.auth !== "string"
    ) {
      return NextResponse.json({ error: "Geçersiz abonelik." }, { status: 400 });
    }

    await connectDB();
    // Aynı endpoint tekrar gelirse güncelle (upsert) — kullanıcı/anahtar tazelensin
    await PushSubscription.updateOne(
      { endpoint: sub.endpoint },
      {
        $set: {
          userId: user.userId,
          endpoint: sub.endpoint,
          keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
        },
      },
      { upsert: true }
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/push/subscribe error:", error);
    return NextResponse.json({ error: "Abonelik kaydedilemedi." }, { status: 500 });
  }
}
