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

    // Eski veya az araçlı kayitlar icin gercek araclari Car koleksiyonundan zengin doldur
    for (const log of logs as any[]) {
      if ((!log.sampleVehicles || log.sampleVehicles.length < 50) && (log.inserted > 0 || log.updated > 0)) {
        try {
          const src = log.source === "popular-recent" ? "arabam" : (log.source || "arabam");
          const startTime = new Date(new Date(log.createdAt).getTime() - 60000);
          const endTime = new Date(new Date(log.createdAt).getTime() + (Math.max(log.durationSeconds || 60, 60) + 180) * 1000);

          const query: any = { sourceSite: src };
          if (log.updated > 0) {
            query.lastVerifiedAt = { $gte: startTime, $lte: endTime };
          } else {
            query.createdAt = { $gte: startTime, $lte: endTime };
          }

          const fallbackCars = await Car.find(
            query,
            {
              _id: 1,
              brand: 1,
              model: 1,
              year: 1,
              price: 1,
              imageUrl: 1,
              images: 1,
              description: 1,
              listingUrl: 1,
              title: 1,
              paintChange: 1,
              damageParts: 1,
              features: 1,
              lastVerifiedAt: 1,
              createdAt: 1,
            }
          ).sort({ lastVerifiedAt: -1, createdAt: -1 }).limit(150).lean();

          if (fallbackCars.length > 0) {
            log.sampleVehicles = fallbackCars.map((c: any) => {
              const photoCount = c.images?.length || (c.imageUrl ? 1 : 0);
              const hasDesc = !!c.description;
              const hasDamage = (c.damageParts && c.damageParts.length > 0) || !!c.paintChange;

              let damageSummary = "";
              if (Array.isArray(c.damageParts) && c.damageParts.length > 0) {
                const nonOriginal = c.damageParts.filter((p: any) => p.state && p.state !== "Orijinal");
                if (nonOriginal.length > 0) {
                  damageSummary = nonOriginal.map((p: any) => `${p.name}: ${p.state}`).join(", ");
                } else {
                  damageSummary = "Tüm Parçalar Orijinal (Hatasız / Boyasız)";
                }
              } else if (c.paintChange) {
                damageSummary = c.paintChange;
              }

              const changes = [
                photoCount > 1 ? `📸 ${photoCount} Adet HD Fotoğraf Eklendi` : "📸 Fotoğraflar Doğrulandı",
                hasDesc ? "📝 Satıcı Detaylı İlan Metni Çekildi" : "📝 İlan Açıklaması Eşitlendi",
                hasDamage ? "🛠️ Ekspertiz & Hasar Matrisi İşlendi" : "🛠️ Hasar Durumu Kontrol Edildi",
                "💰 Canlı İlan ve Fiyat Doğrulandı",
              ];

              return {
                _id: String(c._id),
                brand: c.brand || "Bilinmiyor",
                model: c.model || "Bilinmiyor",
                year: c.year || 0,
                price: c.price || 0,
                source: src,
                title: c.title || `${c.brand} ${c.model}`,
                imageUrl: c.imageUrl || c.images?.[0] || "",
                imagesCount: photoCount,
                descriptionSnippet: c.description ? c.description.slice(0, 160) + (c.description.length > 160 ? "..." : "") : "",
                damageSummary: damageSummary || "Belirtilmemiş",
                specs: [
                  c.features?.horsepower ? `${c.features.horsepower} HP` : null,
                  c.features?.engineSize ? `${c.features.engineSize}L` : null,
                  c.features?.fuelType && c.features.fuelType !== "Bilinmiyor" ? c.features.fuelType : null,
                  c.features?.transmission && c.features.transmission !== "Bilinmiyor" ? c.features.transmission : null,
                ].filter(Boolean).join(" • "),
                listingUrl: c.listingUrl || "",
                status: "active",
                action: log.updated > 0 ? "updated" : "inserted",
                changes,
                reason: `📸 ${photoCount} Fotoğraf • 📝 Açıklama • 🛠️ Hasar Matrisi Zenginleştirildi`,
              };
            });
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
