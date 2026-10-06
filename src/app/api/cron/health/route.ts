import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { runHealthCheck } from "@/lib/health-check";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Günlük sağlık denetimi (Vercel zamanlayıcısı, vercel.json). Sunucu motoru saatte bir aynı denetimi kendisi yapar;
 * bu uç motor çökmüşse de çalışsın diye Vercel'den tetiklenir (bkz. lib/health-check.ts).
 *
 * Yetki: CRON_SECRET tanımlıysa Vercel onu "Authorization: Bearer" ile gönderir ve zorunludur. Tanımlı değilse
 * Vercel zamanlayıcısının çağrısı ya da motorun SCRAPE_RUN_SECRET başlığı kabul edilir. Denetim en kötü ihtimalle
 * yöneticiye günde bir bildirim gönderir; kötüye kullanılacak bir yan etkisi yok.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const scrapeSecret = process.env.SCRAPE_RUN_SECRET;
  const auth = request.headers.get("authorization") || "";
  const viaSecret = Boolean(scrapeSecret) && request.headers.get("x-scrape-secret") === scrapeSecret;
  const viaCron = cronSecret
    ? auth === `Bearer ${cronSecret}`
    : (request.headers.get("user-agent") || "").startsWith("vercel-cron");
  if (!viaSecret && !viaCron) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  try {
    await connectDB();
    const result = await runHealthCheck({ notify: true });
    return NextResponse.json(
      { ok: true, issues: result.issues.map((i) => i.key), notified: result.notified, resolved: result.resolved },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("GET /api/cron/health error:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
