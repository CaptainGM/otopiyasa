import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { DaemonHeartbeat, HourlyScrapeStat } from "@/models/ScrapeMetric";
import { SourceSyncState } from "@/models/SourceSyncState";
import { Car } from "@/models/Car";
import { getTurkeyDateStr } from "@/lib/utils";
import { describeDaemon } from "@/lib/daemon-status";

export const dynamic = "force-dynamic";

let cachedCounts: { active: number | null; archived: number | null; ts: number } | null = null;
async function getInventoryCounts() {
  const now = Date.now();
  if (cachedCounts && now - cachedCounts.ts < 60000) {
    return cachedCounts;
  }
  try {
    const [active, archived] = await Promise.all([
      Car.countDocuments({ status: { $ne: "removed" } }),
      Car.countDocuments({ status: "removed" }),
    ]);
    cachedCounts = { active, archived, ts: now };
    return cachedCounts;
  } catch {
    // Sayılamadıysa uydurma sayı değil "bilinmiyor" döner.
    return cachedCounts || { active: null, archived: null, ts: now };
  }
}

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Bu panel yalnızca yöneticiler içindir." }, { status: 401 });
    }

    await connectDB();

    const [heartbeatDoc, rawHourlyDocs, counts, syncDocs] = await Promise.all([
      DaemonHeartbeat.findOne({ daemonId: "primary-daemon" }).lean(),
      HourlyScrapeStat.find().sort({ timestamp: -1 }).limit(48).lean(),
      getInventoryCounts(),
      SourceSyncState.find().sort({ source: 1 }).lean(),
    ]);

    const todayStr = getTurkeyDateStr();

    // Saatlik otonom daemon kayıtları (Manuel script silmeleri otonom tablosuna karıştırılmaz)
    const hourlyDocs = (rawHourlyDocs as any[]).map((stat) => ({
      ...stat,
      scanned: stat.scanned || 0,
      deleted: stat.deleted || 0,
      inserted: stat.inserted || 0,
      updated: stat.updated || 0,
    }));

    // Bugünün toplamları (senkron veriler üzerinden)
    let todayScanned = 0;
    let todayInserted = 0;
    let todayUpdated = 0;
    let todayDeleted = 0;

    for (const stat of hourlyDocs as any[]) {
      if (stat.dateStr === todayStr) {
        todayScanned += stat.scanned || 0;
        todayInserted += stat.inserted || 0;
        todayUpdated += stat.updated || 0;
        todayDeleted += stat.deleted || 0;
      }
    }

    const syncStates = (syncDocs as any[]).map((s) => ({
      source: s.source,
      lastRunAt: s.lastRunAt || null,
      lastSuccessAt: s.lastSuccessAt || null,
      lastStatus: s.lastStatus || null,
      lastMessage: s.lastMessage || "",
      seen: s.seen ?? null,
      inserted: s.inserted ?? 0,
      updated: s.updated ?? 0,
      reactivated: s.reactivated ?? 0,
      archived: s.archived ?? 0,
      markedMissing: s.markedMissing ?? 0,
      durationMs: s.durationMs ?? null,
    }));

    return NextResponse.json(
      {
        success: true,
        isAdmin: true,
        activeCount: counts.active,
        archivedCount: counts.archived,
        syncStates,
        daemon: describeDaemon(heartbeatDoc as any),
        today: {
          date: todayStr,
          scanned: todayScanned,
          inserted: todayInserted,
          updated: todayUpdated,
          deleted: todayDeleted,
        },
        hourly: hourlyDocs,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
          "CDN-Cache-Control": "no-store",
          "Vercel-CDN-Cache-Control": "no-store",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error: any) {
    console.error("daemon-stats API hatası:", error);
    return NextResponse.json(
      { error: error?.message || "İstatistikler alınamadı" },
      { status: 500 }
    );
  }
}
