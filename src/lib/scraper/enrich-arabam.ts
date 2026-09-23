import * as cheerio from "cheerio";
import { Car } from "@/models/Car";

export interface EnrichedCarData {
  images: string[];
  description?: string;
  damageParts?: Record<string, string>;
  damageFlag?: boolean;
  paintChange?: string;
  sellerType?: string;
  listingDate?: string;
  engineSize?: number;
  horsepower?: number;
  drivetrain?: string;
}

/**
 * Arabam.com ilan sayfasından tüm galeri fotoğraflarını (10-25 adet 800x600 HD),
 * satıcının girdiği detaylı açıklamayı ve boya/değişen hasar matrisini çeker.
 */
export async function enrichArabamDetail(listingUrl: string): Promise<EnrichedCarData | null> {
  if (!listingUrl || !listingUrl.includes("arabam.com")) return null;

  try {
    const res = await fetch(listingUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
        "Cache-Control": "no-cache",
      },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(2000),
    });

    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);

    // 1. Galeri Fotoğrafları: Sayfadaki TÜM resimleri (img, a, slider, script) yakala
    const allImages: string[] = [];
    $("img").each((_, el) => {
      const src = $(el).attr("src") || $(el).attr("data-src") || "";
      if (src.includes("ilanfotograflari")) allImages.push(src);
    });
    $("a[href*='ilanfotograflari']").each((_, el) => {
      const href = $(el).attr("href") || "";
      if (href) allImages.push(href);
    });
    $("script").each((_, el) => {
      const txt = $(el).text();
      const matches = txt.match(/https?:\/\/[^"'\s]+ilanfotograflari[^"'\s]+/g);
      if (matches) allImages.push(...matches);
    });

    const uniqueImages = Array.from(
      new Set(
        allImages
          .map((u) => u.replace(/_\d+x\d+\./, "_800x600.").split("?")[0])
          .filter((u) => u.startsWith("http"))
      )
    );

    // 2. Satıcı Açıklaması: #tab-description sekmesindeki satıcı metni
    let description = $("#tab-description")
      .text()
      .replace(/^Açıklama\s*/i, "")
      .replace(/\s+/g, " ")
      .trim();

    // Fallback: ld+json Vehicle
    if (!description || description.length < 10) {
      $('script[type="application/ld+json"]').each((_, el) => {
        if (description) return;
        try {
          const parsed = JSON.parse($(el).text());
          const list = Array.isArray(parsed) ? parsed : [parsed];
          for (const item of list) {
            if (item["@type"] === "Vehicle" || item["@type"] === "Car") {
              if (item.description && typeof item.description === "string") {
                description = item.description.trim();
                break;
              }
            }
          }
        } catch {}
      });
    }

    // 3. Hasar Parçaları Matrisi
    const damageParts: Record<string, string> = {};
    $("path[uib-tooltip], [data-part-name]").each((_, el) => {
      const partName = $(el).find("title").text().trim() || $(el).attr("data-part-name") || "";
      const status = $(el).attr("uib-tooltip") || $(el).attr("data-status") || "";
      if (partName && status) {
        damageParts[partName] = status;
      }
    });

    // 4. Detay Özellikleri (.property-item listesi)
    const props: Record<string, string> = {};
    $(".property-item").each((_, el) => {
      const key = $(el).find(".property-key").text().trim() || $(el).find("span").first().text().trim();
      const val = $(el).find(".property-value").text().trim() || $(el).find("span").last().text().trim();
      if (key && val) props[key] = val;
    });

    const damageFlag = props["Ağır Hasarlı"] === "Var" || props["Ağır Hasarlı"] === "Evet";
    const paintChange = props["Boya-değişen"];
    const sellerType = props["Kimden"];
    const listingDate = props["İlan Tarihi"];

    const engineSizeMatch = (props["Motor Hacmi"] || "").match(/[\d.,]+/);
    const engineSize = engineSizeMatch ? Math.round(Number(engineSizeMatch[0].replace(/\./g, "").replace(",", ".")) / 100) / 10 : undefined;
    const hpMatch = (props["Motor Gücü"] || "").match(/\d+/);
    const horsepower = hpMatch ? Number(hpMatch[0]) : undefined;
    const drivetrain = props["Çekiş"];

    return {
      images: uniqueImages.length > 0 ? uniqueImages : [],
      description: description.length > 0 ? description : undefined,
      damageParts: Object.keys(damageParts).length > 0 ? damageParts : undefined,
      damageFlag,
      paintChange,
      sellerType,
      listingDate,
      engineSize,
      horsepower,
      drivetrain,
    };
  } catch {
    return null;
  }
}

/**
 * Aracın tüm galeri fotoğraflarını, satıcı açıklamasını, hasar matrisini
 * ve teknik detaylarını anında kaynak sayfadan çeker ve DB'ye işler.
 */
export async function enrichArabamCarIfNeeded(carDoc: any): Promise<void> {
  if (!carDoc) return;
  const isArabam = carDoc.sourceSite === "arabam" || (carDoc.source && carDoc.source === "arabam");
  const needsEnrichment = !carDoc.images || carDoc.images.length <= 1 || !carDoc.description || carDoc.description === carDoc.title;

  if (isArabam && needsEnrichment && carDoc.listingUrl) {
    const task = (async () => {
      try {
        const enriched = await enrichArabamDetail(carDoc.listingUrl);
        if (enriched) {
          if (enriched.images && enriched.images.length > 0) {
            carDoc.images = enriched.images;
            carDoc.imageUrl = enriched.images[0];
          }
          if (enriched.description) carDoc.description = enriched.description;
          if (enriched.damageParts) carDoc.damageParts = enriched.damageParts;
          if (enriched.damageFlag !== undefined) carDoc.damageFlag = enriched.damageFlag;
          if (enriched.paintChange) carDoc.paintChange = enriched.paintChange;
          if (enriched.sellerType) carDoc.sellerType = enriched.sellerType;
          if (enriched.listingDate) carDoc.listingDate = enriched.listingDate;
          if (!carDoc.features) carDoc.features = {};
          if (enriched.engineSize) carDoc.features.engineSize = enriched.engineSize;
          if (enriched.horsepower) carDoc.features.horsepower = enriched.horsepower;
          if (enriched.drivetrain) carDoc.features.drivetrain = enriched.drivetrain;

          // Arka planda DB güncelle
          await Car.updateOne(
            { _id: carDoc._id },
            {
              $set: {
                ...(enriched.images && enriched.images.length > 0
                  ? { images: enriched.images, imageUrl: enriched.images[0] }
                  : {}),
                ...(enriched.description ? { description: enriched.description } : {}),
                ...(enriched.damageParts ? { damageParts: enriched.damageParts } : {}),
                ...(enriched.damageFlag !== undefined ? { damageFlag: enriched.damageFlag } : {}),
                ...(enriched.paintChange ? { paintChange: enriched.paintChange } : {}),
                ...(enriched.sellerType ? { sellerType: enriched.sellerType } : {}),
                ...(enriched.listingDate ? { listingDate: enriched.listingDate } : {}),
                ...(enriched.engineSize ? { "features.engineSize": enriched.engineSize } : {}),
                ...(enriched.horsepower ? { "features.horsepower": enriched.horsepower } : {}),
                ...(enriched.drivetrain ? { "features.drivetrain": enriched.drivetrain } : {}),
              },
            }
          ).exec();
        }
      } catch {
        // sessizce fallback yap
      }
    })();

    // Kullanıcı sayfasını en fazla 600ms beklet, Arabam yavaşsa/blokluysa arka planda bitirsin, kullanıcı anında sayfayı görsün!
    await Promise.race([
      task,
      new Promise((resolve) => setTimeout(resolve, 600)),
    ]);
  }
}

/**
 * Yönetim Paneli veya API üzerinden toplu Arabam galeri & detay zenginleştirme paketi
 */
export async function runEnrichArabamBatch(limit = 25): Promise<{
  success: boolean;
  message: string;
  scanned: number;
  updated: number;
  deleted: number;
  sampleVehicles: any[];
}> {
  const candidates = await Car.find(
    {
      sourceSite: "arabam",
      status: "active",
      listingUrl: { $exists: true },
      $or: [
        { images: { $size: 0 } },
        { images: { $size: 1 } },
        { images: { $exists: false } },
      ],
    },
    { _id: 1, title: 1, listingUrl: 1, brand: 1, model: 1, year: 1, price: 1, imageUrl: 1 }
  )
    .limit(limit)
    .lean();

  if (candidates.length === 0) {
    return {
      success: true,
      message: "Tüm araçların galerisi, açıklaması ve hasar detayları zaten tam!",
      scanned: 0,
      updated: 0,
      deleted: 0,
      sampleVehicles: [],
    };
  }

  let updated = 0;
  let deleted = 0;
  let scanned = 0;
  const sampleVehicles: any[] = [];

  for (const car of candidates as any[]) {
    scanned++;
    try {
      const detail = await enrichArabamDetail(car.listingUrl);
      if (detail) {
        await Car.updateOne(
          { _id: car._id },
          {
            $set: {
              ...(detail.images && detail.images.length > 0
                ? { images: detail.images, imageUrl: detail.images[0] }
                : {}),
              ...(detail.description ? { description: detail.description } : {}),
              ...(detail.damageParts && Object.keys(detail.damageParts).length > 0
                ? { damageParts: detail.damageParts }
                : {}),
              ...(detail.damageFlag !== undefined ? { damageFlag: detail.damageFlag } : {}),
              ...(detail.paintChange ? { paintChange: detail.paintChange } : {}),
              ...(detail.sellerType ? { sellerType: detail.sellerType } : {}),
              ...(detail.listingDate ? { listingDate: detail.listingDate } : {}),
              ...(detail.engineSize ? { "features.engineSize": detail.engineSize } : {}),
              ...(detail.horsepower ? { "features.horsepower": detail.horsepower } : {}),
              ...(detail.drivetrain ? { "features.drivetrain": detail.drivetrain } : {}),
              lastVerifiedAt: new Date(),
            },
          }
        );
        updated++;
        if (sampleVehicles.length < 24) {
          sampleVehicles.push({
            _id: String(car._id),
            brand: car.brand || "Bilinmiyor",
            model: car.model || "Bilinmiyor",
            year: car.year || 0,
            price: car.price || 0,
            source: "arabam",
            title: car.title || `${car.brand} ${car.model}`,
            imageUrl: detail.images?.[0] || car.imageUrl || "",
            listingUrl: car.listingUrl,
          });
        }
      }
      await new Promise((r) => setTimeout(r, 600));
    } catch {
      // devam et
    }
  }

  return {
    success: true,
    message: `${updated} araç tüm HD fotoğrafları, satıcı açıklaması ve hasar matrisiyle başarıyla zenginleştirildi.`,
    scanned,
    updated,
    deleted,
    sampleVehicles,
  };
}

