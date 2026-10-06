import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/auth";
import { ManualScrapeLog } from "@/models/ManualScrapeLog";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 403 });
    }

    await connectDB();
    const logs = await ManualScrapeLog.find(
      {},
      {
        actor: 1,
        source: 1,
        label: 1,
        scanned: 1,
        inserted: 1,
        updated: 1,
        deleted: 1,
        durationSeconds: 1,
        status: 1,
        message: 1,
        createdAt: 1,
        sampleVehicles: { $slice: 10 },
      }
    )
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    // "Bugün" Türkiye gününe göre (sunucu UTC'de çalışıyor; eskiden gün 03:00'te başlıyordu).
    const trNow = new Date(Date.now() + 3 * 60 * 60 * 1000);
    const todayStart = new Date(Date.UTC(trNow.getUTCFullYear(), trNow.getUTCMonth(), trNow.getUTCDate()) - 3 * 60 * 60 * 1000);

    let todayScanned = 0;
    let todayInserted = 0;
    let todayUpdated = 0;
    let todayDeleted = 0;
    let todayDuration = 0;
    let todayOperations = 0;

    for (const log of logs as any[]) {
      if (new Date(log.createdAt) >= todayStart) {
        todayScanned += log.scanned || 0;
        todayInserted += log.inserted || 0;
        todayUpdated += log.updated || 0;
        todayDeleted += log.deleted || 0;
        todayDuration += log.durationSeconds || 0;
        todayOperations += 1;
      }
    }

    const today = {
      date: new Date().toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" }),
      scanned: todayScanned,
      inserted: todayInserted,
      updated: todayUpdated,
      deleted: todayDeleted,
      durationSeconds: Math.round(todayDuration * 10) / 10,
      operations: todayOperations,
    };

    return NextResponse.json(
      { success: true, logs, today },
      {
        headers: {
          // Yöneticiye özel veri: CDN'de ortak önbelleğe ALINMAZ (eskiden public idi; 5 sn içinde gelen
          // herhangi bir ziyaretçi yöneticinin tarama günlüğünü alabilirdi).
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Kayıtlar alınamadı." },
      { status: 500 }
    );
  }
}
