import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/auth";
import { ManualScrapeLog } from "@/models/ManualScrapeLog";
import { Car } from "@/models/Car";

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
        bySource: 1,
        sampleVehicles: { $slice: 500 },
      }
    )
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    // Eski veya bos kayitlar icin gercek araclari Car koleksiyonundan doldur
    for (const log of logs as any[]) {
      if ((!log.sampleVehicles || log.sampleVehicles.length === 0) && (log.inserted > 0 || log.updated > 0)) {
        try {
          const src = log.source === "popular-recent" ? "arabam" : (log.source || "arabam");
          const end = new Date(new Date(log.createdAt).getTime() + (Math.max(log.durationSeconds || 60, 60) + 120) * 1000);
          
          const fallbackCars = await Car.find(
            { sourceSite: src, createdAt: { $lte: end } },
            { brand: 1, model: 1, year: 1, price: 1, imageUrl: 1, listingUrl: 1, title: 1 }
          ).sort({ createdAt: -1 }).limit(30).lean();

          if (fallbackCars.length > 0) {
            log.sampleVehicles = fallbackCars.map((c: any) => ({
              _id: String(c._id),
              brand: c.brand || "Bilinmiyor",
              model: c.model || "Bilinmiyor",
              year: c.year || 0,
              price: c.price || 0,
              source: src,
              title: c.title || `${c.brand} ${c.model}`,
              imageUrl: c.imageUrl || "",
              listingUrl: c.listingUrl,
              status: "active",
              action: log.inserted > 0 ? "inserted" : "updated",
            }));
          }
        } catch {}
      }
    }

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
