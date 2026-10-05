import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { HOME_WATCHER_ID, HomeWatcherHour, HomeWatcherState } from "@/models/HomeWatcher";
import { describeWatcher, estimateRemaining, fillDayHours, summarizeDays, type HourRow } from "@/lib/home-watcher-status";
import { getTurkeyDateStr } from "@/lib/utils";

export const dynamic = "force-dynamic";

const DAYS_SHOWN = 14;

let cachedQueue: { active: number; neverVerified: number; verifiedLast24h: number; ts: number } | null = null;

async function queueCounts() {
  const now = Date.now();
  if (cachedQueue && now - cachedQueue.ts < 60_000) return cachedQueue;
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
  const [active, neverVerified, verifiedLast24h] = await Promise.all([
    Car.countDocuments({ sourceSite: "arabam", status: "active" }),
    Car.countDocuments({ sourceSite: "arabam", status: "active", lastVerifiedAt: { $exists: false } }),
    Car.countDocuments({ sourceSite: "arabam", status: "active", lastVerifiedAt: { $gte: dayAgo } }),
  ]);
  cachedQueue = { active, neverVerified, verifiedLast24h, ts: now };
  return cachedQueue;
}

/**
 * Evdeki bilgisayarda çalışan Arabam bekçisinin durumu, günlük özeti ve (?date=GG.AA.YYYY ile) saat saat dökümü.
 * Yalnızca yöneticiler (web yönetim paneli ve mobil yönetim ekranı kullanır).
 */
export async function GET(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Bu panel yalnızca yöneticiler içindir." }, { status: 401 });
    }
    await connectDB();

    const url = new URL(request.url);
    const dateParam = url.searchParams.get("date");
    const hourParam = url.searchParams.get("hour");
    const kindParam = url.searchParams.get("kind");

    // Saat satırına tıklayınca o saatte arşive giden / yeni eklenen ilanların kendisi (başlık, bağlantı).
    if (dateParam && hourParam && kindParam) {
      if (!/^\d{2}\.\d{2}\.\d{4}$/.test(dateParam) || !/^\d{1,2}$/.test(hourParam)) {
        return NextResponse.json({ error: "Tarih/saat geçersiz." }, { status: 400 });
      }
      if (kindParam !== "archived" && kindParam !== "inserted") {
        return NextResponse.json({ error: "Geçersiz liste türü." }, { status: 400 });
      }
      const hourRow = await HomeWatcherHour.findOne({
        watcherId: HOME_WATCHER_ID,
        dateStr: dateParam,
        hour: Number(hourParam),
      })
        .select("timestamp")
        .lean<{ timestamp: Date } | null>();
      if (!hourRow) {
        return NextResponse.json({ items: [] }, { headers: { "Cache-Control": "no-store" } });
      }
      const from = new Date(hourRow.timestamp);
      const to = new Date(from.getTime() + 60 * 60 * 1000);
      const LIMIT = 200;
      if (kindParam === "archived") {
        const items = await Car.find(
          { sourceSite: "arabam", status: "removed", removedAt: { $gte: from, $lt: to } },
          { title: 1, brand: 1, model: 1, year: 1, price: 1, listingUrl: 1, removedAt: 1, removedReason: 1 }
        )
          .sort({ removedAt: 1 })
          .limit(LIMIT)
          .lean();
        return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
      }
      const items = await Car.find(
        { sourceSite: "arabam", createdAt: { $gte: from, $lt: to } },
        { title: 1, brand: 1, model: 1, year: 1, price: 1, listingUrl: 1, createdAt: 1 }
      )
        .sort({ createdAt: 1 })
        .limit(LIMIT)
        .lean();
      return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
    }

    if (dateParam) {
      if (!/^\d{2}\.\d{2}\.\d{4}$/.test(dateParam)) {
        return NextResponse.json({ error: "Tarih GG.AA.YYYY biçiminde olmalı." }, { status: 400 });
      }
      const rows = await HomeWatcherHour.find({ watcherId: HOME_WATCHER_ID, dateStr: dateParam }).lean<HourRow[]>();
      return NextResponse.json({ date: dateParam, hours: fillDayHours(dateParam, rows) }, { headers: { "Cache-Control": "no-store" } });
    }

    const since = new Date(Date.now() - (DAYS_SHOWN + 1) * 24 * 60 * 60 * 1000);
    const [stateDoc, rows, queue] = await Promise.all([
      HomeWatcherState.findOne({ watcherId: HOME_WATCHER_ID }).lean(),
      HomeWatcherHour.find({ watcherId: HOME_WATCHER_ID, timestamp: { $gte: since } }).lean<HourRow[]>(),
      queueCounts(),
    ]);

    const days = summarizeDays(rows).slice(0, DAYS_SHOWN);
    const todayStr = getTurkeyDateStr();
    const today = days.find((d) => d.dateStr === todayStr) || {
      dateStr: todayStr,
      checked: 0,
      alive: 0,
      archived: 0,
      blocked: 0,
      uncertain: 0,
      activeSeconds: 0,
      pausedMinutes: 0,
      inserted: 0,
    };

    return NextResponse.json(
      {
        watcher: describeWatcher(stateDoc as any),
        today,
        days,
        queue: {
          active: queue.active,
          neverVerified: queue.neverVerified,
          verifiedLast24h: queue.verifiedLast24h,
          estimate: estimateRemaining(queue.neverVerified, days),
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("GET /api/admin/home-watcher error:", error);
    return NextResponse.json({ error: "Bekçi durumu alınamadı." }, { status: 500 });
  }
}
