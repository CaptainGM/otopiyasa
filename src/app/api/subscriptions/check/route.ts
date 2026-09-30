import { NextResponse } from "next/server";
import { checkSubscriptions } from "@/lib/subscriptions";

export async function POST(request: Request) {
  try {
    // SUBSCRIPTIONS_RUN_SECRET zorunlu: tanımlı değilse endpoint tamamen kapalı (fail-closed).
    if (!process.env.SUBSCRIPTIONS_RUN_SECRET) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const secret = body.secret || null;
    if (process.env.SUBSCRIPTIONS_RUN_SECRET !== secret) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await checkSubscriptions();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Check failed" }, { status: 500 });
  }
}
