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
    let endpointUrl: URL | null = null;
    if (sub && typeof sub.endpoint === "string" && sub.endpoint.length <= 2048) {
      try { endpointUrl = new URL(sub.endpoint); } catch { endpointUrl = null; }
    }
    const allowedHosts = [
      "fcm.googleapis.com",
      "push.services.mozilla.com",
      "push.apple.com",
      "notify.windows.com",
    ];
    const supportedEndpoint = !!endpointUrl &&
      endpointUrl.protocol === "https:" &&
      !endpointUrl.username && !endpointUrl.password &&
      (!endpointUrl.port || endpointUrl.port === "443") &&
      allowedHosts.some((host) => endpointUrl!.hostname === host || endpointUrl!.hostname.endsWith(`.${host}`));
    if (
      !sub ||
      !supportedEndpoint ||
      !sub.keys ||
      typeof sub.keys.p256dh !== "string" || !/^[A-Za-z0-9_-]{40,200}$/.test(sub.keys.p256dh) ||
      typeof sub.keys.auth !== "string" || !/^[A-Za-z0-9_-]{16,200}$/.test(sub.keys.auth)
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
