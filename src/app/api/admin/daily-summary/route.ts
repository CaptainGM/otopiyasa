import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { loadDailyRange, loadDailySummary } from "@/lib/daily-summary-server";
import { SUMMARY_RANGE_DAYS, turkeyDayList } from "@/lib/daily-summary";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{2}\.\d{2}\.\d{4}$/;

/**
 * Yönetim panelindeki günlük özet.
 *
 *  - (parametresiz)        → bugün
 *  - ?date=GG.AA.YYYY      → o gün
 *  - ?range=14             → son N gün, gün gün (en fazla SUMMARY_RANGE_DAYS)
 */
export async function GET(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Bu panel yalnızca yöneticiler içindir." }, { status: 401 });
    }
    await connectDB();

    const params = new URL(request.url).searchParams;
    const rangeParam = params.get("range");
    const dateParam = params.get("date");

    if (rangeParam !== null) {
      const requested = Number(rangeParam);
      const days = Number.isFinite(requested) && requested > 0 ? Math.min(Math.floor(requested), SUMMARY_RANGE_DAYS) : SUMMARY_RANGE_DAYS;
      const range = await loadDailyRange(turkeyDayList(days));
      return NextResponse.json(range, { headers: { "Cache-Control": "no-store" } });
    }

    if (dateParam && !DATE_RE.test(dateParam)) {
      return NextResponse.json({ error: "Tarih GG.AA.YYYY biçiminde olmalı." }, { status: 400 });
    }

    const summary = await loadDailySummary(new Date(), dateParam || undefined);
    return NextResponse.json(summary, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("daily-summary API hatası:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Günlük özet alınamadı" }, { status: 500 });
  }
}
