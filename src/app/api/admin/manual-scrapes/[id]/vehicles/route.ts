import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/auth";
import { ManualScrapeLog } from "@/models/ManualScrapeLog";
import { Car } from "@/models/Car";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 403 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Geçersiz log ID." }, { status: 400 });
    }

    await connectDB();
    const log = await ManualScrapeLog.findById(id).lean() as any;
    if (!log) {
      return NextResponse.json({ error: "Tarama kaydı bulunamadı." }, { status: 404 });
    }

    const initialVehicles: any[] = log.sampleVehicles || [];
    const src = log.source === "popular-recent" ? "arabam" : (log.source || "arabam");
    const startTime = new Date(new Date(log.createdAt).getTime() - 60000);
    const endTime = new Date(new Date(log.createdAt).getTime() + (Math.max(log.durationSeconds || 60, 60) + 180) * 1000);

    let dbVehicles: any[] = [];

    // 1. Eğer güncelleme / zenginleştirme taramasıysa
    if (log.updated > 0 || (log.label && log.label.toLowerCase().includes("zenginleştir"))) {
      const updatedDocs = await Car.find(
        {
          sourceSite: src,
          lastVerifiedAt: { $gte: startTime, $lte: endTime },
        },
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
        }
      )
        .sort({ lastVerifiedAt: -1 })
        .limit(150)
        .lean();

      if (updatedDocs.length > 0) {
        dbVehicles = updatedDocs.map((c: any) => {
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
            action: "updated",
            changes,
            reason: `📸 ${photoCount} Fotoğraf • 📝 Açıklama • 🛠️ Hasar Matrisi Zenginleştirildi`,
          };
        });
      }
    }

    // 2. Eğer yeni ilan çekimiyse ve araç sayısı azsa
    if (dbVehicles.length === 0 && (log.inserted > 0 || (log.label && log.label.toLowerCase().includes("yeni")))) {
      const insertedDocs = await Car.find(
        {
          sourceSite: src,
          createdAt: { $gte: startTime, $lte: endTime },
        },
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
          createdAt: 1,
        }
      )
        .sort({ createdAt: -1 })
        .limit(150)
        .lean();

      if (insertedDocs.length > 0) {
        dbVehicles = insertedDocs.map((c: any) => {
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
            action: "inserted",
            changes: [
              "✨ Veritabanına İlk Kez Eklendi",
              photoCount > 1 ? `📸 ${photoCount} Adet HD Fotoğraf Kaydedildi` : "📸 Fotoğraf Eklendi",
              hasDesc ? "📝 Detaylı Satıcı Açıklaması Eklendi" : "",
              hasDamage ? "🛠️ Ekspertiz & Hasar Matrisi İşlendi" : "",
              "🟢 Canlı İlan Olarak Yayında",
            ].filter(Boolean),
            reason: `✨ İlk kez veritabanına eklendi (${photoCount} fotoğraf)`,
          };
        });
      }
    }

    // 3. Mevcut silinmiş / kaldırılmış araçları kaybetmeden birleştir
    const seenIds = new Set<string>();
    const finalVehicles: any[] = [];

    // Önce kaldırılan ölü ilanları koru
    for (const v of initialVehicles) {
      if (v.status === "removed" || v.action === "deleted") {
        finalVehicles.push(v);
        if (v._id) seenIds.add(String(v._id));
      }
    }

    // Sonra veritabanından çekilen canlı araçları ekle
    for (const v of dbVehicles) {
      if (v._id && seenIds.has(String(v._id))) continue;
      if (v._id) seenIds.add(String(v._id));
      finalVehicles.push(v);
    }

    // Eğer veritabanından hiç araç çıkmadıysa orijinal sampleVehicles'ı dön
    if (finalVehicles.length === 0) {
      for (const v of initialVehicles) {
        finalVehicles.push(v);
      }
    }

    return NextResponse.json({
      success: true,
      logId: id,
      totalCount: finalVehicles.length,
      vehicles: finalVehicles,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Araçlar yüklenemedi." },
      { status: 500 }
    );
  }
}
