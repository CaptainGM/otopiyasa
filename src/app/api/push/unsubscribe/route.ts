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
    const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
    if (!endpoint) {
      return NextResponse.json({ error: "endpoint zorunludur." }, { status: 400 });
    }

    await connectDB();
    await PushSubscription.deleteOne({ endpoint, userId: user.userId });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/push/unsubscribe error:", error);
    return NextResponse.json({ error: "Abonelik silinemedi." }, { status: 500 });
  }
}
