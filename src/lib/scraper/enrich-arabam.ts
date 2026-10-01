import { Car } from "@/models/Car";
import { isCloudflareChallenge, isListingGone, parseArabamDetailHtml } from "@/lib/scraper/browser-scrape";
import { archiveListings } from "@/lib/scraper/listing-lifecycle";
import { isUnknownValue, shouldReplaceFuel } from "@/lib/scraper/enrich-detail";
import type { ScrapedListing } from "@/lib/scraper/types";
import { normalizeFuelType } from "@/lib/normalize-fuel";

/**
 * Arabam ilan sayfasından galeri, satıcı açıklaması, parça bazlı hasar ve teknik bilgiyi
 * tamamlar. Ayrıştırma scrape.bat (G) ve yeni ilan keşfiyle aynı fonksiyondan
 * (parseArabamDetailHtml) yapılır. Eskiden burada ayrı bir kopya vardı: hasar parçalarını
 * şemadaki [{name, state}] yerine nesne olarak yazıyor, benzer ilanların fotoğraflarını da
 * galeriye katıyordu.
 *
 * Not: Kaynak site Cloudflare arkasında; yurt dışı IP'den (Vercel) istek çoğunlukla doğrulama
 * sayfasına düşer. Bu durumda hiçbir şey yazılmaz.
 */
export type ArabamDetailResult =
  | { kind: "ok"; listing: ScrapedListing }
  | { kind: "gone"; reason: string }
  | { kind: "failed" };

export async function fetchArabamDetail(listingUrl: string, timeoutMs = 8000): Promise<ArabamDetailResult> {
  if (!listingUrl || !listingUrl.includes("arabam.com")) return { kind: "failed" };
  try {
    const res = await fetch(listingUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.status === 404 || res.status === 410) return { kind: "gone", reason: `HTTP ${res.status}` };
    if (!res.ok) return { kind: "failed" };
    const html = await res.text();
    if (isCloudflareChallenge(html)) return { kind: "failed" };
    if (isListingGone(html, res.url || listingUrl)) {
      return { kind: "gone", reason: "ilan sayfası kaldırılmış / kategoriye yönlendirilmiş" };
    }
    const listing = parseArabamDetailHtml(html, listingUrl);
    return listing ? { kind: "ok", listing } : { kind: "failed" };
  } catch {
    return { kind: "failed" };
  }
}

type StoredCar = {
  _id: unknown;
  price?: number;
  city?: string;
  address?: string;
  features?: { color?: string; bodyType?: string; fuelType?: string; transmission?: string };
};

/** Ayrıştırılan ilandan DB'ye yazılacak alanlar (yalnızca gerçekten bilinenler). */
export function arabamDetailSet(listing: ScrapedListing, car: StoredCar): Record<string, unknown> {
  // Satıcı açıklama yazmamışsa ayrıştırıcı "<başlık> - Arabam ilanı" döndürür; mevcut metni ezmesin.
  const description = listing.description && !/- Arabam ilanı$/.test(listing.description) ? listing.description : "";
  const f = car.features || {};
  const fill = (key: "color" | "bodyType" | "fuelType" | "transmission", value?: string) =>
    value && !isUnknownValue(value) && isUnknownValue(f[key]) ? { [`features.${key}`]: value } : {};
  const x = listing.features || ({} as ScrapedListing["features"]);

  return {
    ...(listing.images && listing.images.length > 0 ? { images: listing.images, imageUrl: listing.images[0] } : {}),
    ...(description ? { description } : {}),
    ...(listing.damageParts && listing.damageParts.length > 0 ? { damageParts: listing.damageParts } : {}),
    ...(listing.damageFlag !== undefined ? { damageFlag: listing.damageFlag } : {}),
    ...(listing.paintChange ? { paintChange: listing.paintChange } : {}),
    ...(listing.sellerType ? { sellerType: listing.sellerType } : {}),
    ...(listing.listingDate ? { listingDate: listing.listingDate } : {}),
    ...(listing.city && !car.city ? { city: listing.city } : {}),
    ...(listing.address && !car.address ? { address: listing.address } : {}),
    ...fill("color", x.color),
    ...fill("bodyType", x.bodyType),
    // Liste sayfasından gelen yakıt/vites tahmindir (bulamayınca "Benzin"/"Manuel" yazılıyordu:
    // 2021 Evoque manuel görünüyordu). İlan sayfasındaki değer onu düzeltir.
    ...(shouldReplaceFuel(f.fuelType, x.fuelType) ? { "features.fuelType": normalizeFuelType(x.fuelType) } : {}),
    ...(x.transmission && !isUnknownValue(x.transmission) && x.transmission !== f.transmission
      ? { "features.transmission": x.transmission }
      : {}),
    ...(x.engineSize ? { "features.engineSize": x.engineSize } : {}),
    ...(x.horsepower ? { "features.horsepower": x.horsepower } : {}),
    ...(x.drivetrain ? { "features.drivetrain": x.drivetrain } : {}),
    ...(x.avgFuelConsumption ? { "features.avgFuelConsumption": x.avgFuelConsumption } : {}),
    ...(x.fuelTank ? { "features.fuelTank": x.fuelTank } : {}),
    detailCheckedAt: new Date(),
  };
}

/**
 * İlan sayfası açıldığında detayı eksik Arabam ilanını tamamlamayı dener. Kullanıcıyı en
 * fazla 600 ms bekletir; kalan iş arka planda biter.
 */
export async function enrichArabamCarIfNeeded(carDoc: any): Promise<void> {
  if (!carDoc) return;
  const isArabam = carDoc.sourceSite === "arabam" || carDoc.source === "arabam";
  const needsEnrichment =
    !carDoc.images || carDoc.images.length <= 1 || !carDoc.description || carDoc.description === carDoc.title;
  if (!isArabam || !needsEnrichment || !carDoc.listingUrl || carDoc.detailCheckedAt) return;

  const task = (async () => {
    const result = await fetchArabamDetail(carDoc.listingUrl, 4000);
    if (result.kind !== "ok") return;
    const set = arabamDetailSet(result.listing, carDoc);
    // Bu istekte gösterilecek belge de güncellensin.
    for (const [key, value] of Object.entries(set)) {
      if (key.startsWith("features.")) {
        carDoc.features = { ...(carDoc.features || {}), [key.slice(9)]: value };
      } else {
        carDoc[key] = value;
      }
    }
    await Car.updateOne({ _id: carDoc._id }, { $set: set }, { timestamps: false }).exec();
  })().catch(() => {});

  await Promise.race([task, new Promise((resolve) => setTimeout(resolve, 600))]);
}

/**
 * Yönetim panelinden toplu Arabam detay tamamlama (scrape.bat G'nin küçük sürümü).
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
        { detailCheckedAt: { $exists: false }, sellerType: { $in: ["", null] } },
      ],
    },
    { _id: 1, title: 1, listingUrl: 1, brand: 1, model: 1, year: 1, price: 1, imageUrl: 1, city: 1, address: 1, features: 1 }
  )
    .limit(limit)
    .lean<any[]>();

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

  for (const car of candidates) {
    scanned++;
    const result = await fetchArabamDetail(car.listingUrl);
    if (result.kind === "gone") {
      deleted += await archiveListings([car._id], `arabam: ${result.reason}`);
    } else if (result.kind === "ok") {
      const listing = result.listing;
      const priceChanged = listing.price > 0 && listing.price !== car.price;
      await Car.updateOne(
        { _id: car._id },
        {
          ...(priceChanged ? { $push: { priceHistory: { price: listing.price, recordedAt: new Date() } } } : {}),
          $set: {
            ...arabamDetailSet(listing, car),
            ...(priceChanged ? { price: listing.price } : {}),
            lastVerifiedAt: new Date(),
            lastVerifyAttemptAt: new Date(),
          },
          $unset: { missingSince: 1, missingChecks: 1 },
        },
        { timestamps: priceChanged }
      );
      updated++;
      if (sampleVehicles.length < 24) {
        sampleVehicles.push({
          _id: String(car._id),
          brand: car.brand || "Bilinmiyor",
          model: car.model || "Bilinmiyor",
          year: car.year || 0,
          price: listing.price || car.price || 0,
          source: "arabam",
          title: car.title || `${car.brand} ${car.model}`,
          imageUrl: listing.images?.[0] || car.imageUrl || "",
          listingUrl: car.listingUrl,
        });
      }
    }
    await new Promise((r) => setTimeout(r, 600));
  }

  return {
    success: true,
    message:
      updated + deleted > 0
        ? `${updated} araç galeri, satıcı açıklaması ve hasar bilgisiyle tamamlandı${deleted ? `, ${deleted} kaldırılmış ilan arşivlendi` : ""}.`
        : `${scanned} ilan denendi ama sayfalar okunamadı (bu sunucudan kaynak siteye erişim engelli olabilir; scrape.bat G ev ağından çalışır).`,
    scanned,
    updated,
    deleted,
    sampleVehicles,
  };
}
