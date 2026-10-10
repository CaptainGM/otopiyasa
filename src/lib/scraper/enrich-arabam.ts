import { Car } from "@/models/Car";
import { isCloudflareChallenge, isListingGone, parseArabamDetailHtml } from "@/lib/scraper/browser-scrape";
import { archiveListings } from "@/lib/scraper/listing-lifecycle";
import { isUnknownValue, shouldReplaceDetailDescription, shouldReplaceFuel } from "@/lib/scraper/enrich-detail";
import type { ScrapedListing } from "@/lib/scraper/types";
import { normalizeFuelType } from "@/lib/normalize-fuel";
import { isPlausibleScrapedPrice } from "@/lib/scraper/price-guard";

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
  images?: string[];
  description?: string;
  damageParts?: { name: string; state: string }[];
  features?: { color?: string; bodyType?: string; fuelType?: string; transmission?: string };
};

/** Sayfada açıkça yazan özellikler "doğrulandı" listesine eklenir (bkz. Car.verifiedFeatures). */
function verifiedAdd(listing: ScrapedListing) {
  const keys = listing.confirmedFeatures || [];
  return keys.length ? { $addToSet: { verifiedFeatures: { $each: keys } } } : {};
}

/** Ayrıştırılan ilandan DB'ye yazılacak alanlar (yalnızca gerçekten bilinenler). */
export function arabamDetailSet(listing: ScrapedListing, car: StoredCar): Record<string, unknown> {
  // Satıcı açıklama yazmamışsa ayrıştırıcı "<başlık> - Arabam ilanı" döndürür; mevcut metni ezmesin.
  const candidateDescription = listing.description && !/- Arabam ilanı$/.test(listing.description) ? listing.description : "";
  const description = candidateDescription.length > 20 && shouldReplaceDetailDescription(car.description, candidateDescription) ? candidateDescription : "";
  const f = car.features || {};
  const fill = (key: "color" | "bodyType" | "fuelType" | "transmission", value?: string) =>
    value && !isUnknownValue(value) && isUnknownValue(f[key]) ? { [`features.${key}`]: value } : {};
  const x = listing.features || ({} as ScrapedListing["features"]);
  const confirmed = new Set(listing.confirmedFeatures || []);

  return {
    ...(listing.images && listing.images.length > 0 && listing.images.length >= (car.images?.length ?? 0) &&
      JSON.stringify(listing.images) !== JSON.stringify(car.images || [])
      ? { images: listing.images, imageUrl: listing.images[0] }
      : {}),
    ...(description ? { description } : {}),
    ...(listing.damageParts && listing.damageParts.length > 0 && listing.damageParts.length >= (car.damageParts?.length ?? 0) &&
      JSON.stringify(listing.damageParts) !== JSON.stringify(car.damageParts || [])
      ? { damageParts: listing.damageParts }
      : {}),
    ...(listing.damageFlag !== undefined ? { damageFlag: listing.damageFlag } : {}),
    ...(listing.paintChange ? { paintChange: listing.paintChange } : {}),
    ...(listing.sellerType ? { sellerType: listing.sellerType } : {}),
    ...(listing.listingDate ? { listingDate: listing.listingDate } : {}),
    ...(listing.city && !car.city ? { city: listing.city } : {}),
    ...(listing.address && !car.address ? { address: listing.address } : {}),
    ...fill("color", x.color),
    // Sayfada AÇIKÇA yazan kasa tipi, listeden tahmin edilenin ("Sedan"/"SUV" anahtar kelime tahmini) yerine geçer.
    ...(confirmed.has("bodyType") && x.bodyType && !isUnknownValue(x.bodyType) ? { "features.bodyType": x.bodyType } : fill("bodyType", x.bodyType)),
    // Liste sayfasından gelen yakıt/vites tahmindir (bulamayınca "Benzin"/"Manuel" yazılıyordu:
    // 2021 Evoque manuel görünüyordu). İlan sayfasındaki değer onu düzeltir.
    // Sayfada AÇIKÇA yazan yakıt tipi her zaman geçerlidir; yoksa yalnızca belirsiz/tahmin değer değiştirilir.
    ...(confirmed.has("fuelType") && x.fuelType && !isUnknownValue(x.fuelType)
      ? { "features.fuelType": normalizeFuelType(x.fuelType) }
      : shouldReplaceFuel(f.fuelType, x.fuelType)
        ? { "features.fuelType": normalizeFuelType(x.fuelType) }
        : {}),
    ...(x.transmission && !isUnknownValue(x.transmission) && x.transmission !== f.transmission
      ? { "features.transmission": x.transmission }
      : {}),
    ...(x.engineSize ? { "features.engineSize": x.engineSize } : {}),
    ...(x.horsepower ? { "features.horsepower": x.horsepower } : {}),
    ...(x.drivetrain ? { "features.drivetrain": x.drivetrain } : {}),
    ...(x.avgFuelConsumption ? { "features.avgFuelConsumption": x.avgFuelConsumption } : {}),
    ...(x.fuelTank ? { "features.fuelTank": x.fuelTank } : {}),
    detailCheckedAt: new Date(),
    ...(confirmed.size > 0 ? { featuresVerifiedAt: new Date() } : {}),
  };
}

/**
 * Aynı ilan için eşzamanlı tamamlama denemelerini engeller. Uç noktada hız sınırı olmadığı ve
 * ilan detayı herkese açık olduğu için, kilit olmadan aynı ilanı arka arkaya isteyen bir çağıran
 * her seferinde kaynağa yeni bir dış istek açtırıyordu (istek çoğaltma).
 */
const enrichmentInFlight = new Set<string>();

/**
 * İlan sayfası açıldığında detayı eksik Arabam ilanını tamamlamayı dener. Kullanıcıyı en
 * fazla 600 ms bekletir; kalan iş arka planda biter.
 *
 * Denemenin kendisi (başarılı da olsa başarısız da) işaretlenir: aksi hâlde kaynak sayfa
 * okunamadığında detailCheckedAt hiç yazılmıyor ve aynı ilanın her görüntülenmesi yeni bir dış
 * istek başlatıyordu. Başarısız deneme ayrıca detailCheckFailedAt ile damgalanır; toplu
 * tamamlama (runEnrichArabamBatch) bu ilanları yine aday olarak alır, yani "vazgeçildi" değil
 * "şimdilik ertelendi" demektir.
 */
export async function enrichArabamCarIfNeeded(carDoc: any): Promise<void> {
  if (!carDoc) return;
  const isArabam = carDoc.sourceSite === "arabam" || carDoc.source === "arabam";
  const needsEnrichment =
    !carDoc.images || carDoc.images.length <= 1 || !carDoc.description || carDoc.description === carDoc.title;
  if (!isArabam || !needsEnrichment || !carDoc.listingUrl || carDoc.detailCheckedAt) return;

  const key = String(carDoc._id ?? carDoc.listingUrl);
  if (enrichmentInFlight.has(key)) return;
  enrichmentInFlight.add(key);

  const task = (async () => {
    try {
      const result = await fetchArabamDetail(carDoc.listingUrl, 4000);
      if (result.kind !== "ok") {
        await Car.updateOne(
          { _id: carDoc._id },
          { $set: { detailCheckedAt: new Date(), detailCheckFailedAt: new Date() } },
          { timestamps: false }
        ).exec();
        return;
      }
      const set = arabamDetailSet(result.listing, carDoc);
      // Bu istekte gösterilecek belge de güncellensin.
      for (const [field, value] of Object.entries(set)) {
        if (field.startsWith("features.")) {
          carDoc.features = { ...(carDoc.features || {}), [field.slice(9)]: value };
        } else {
          carDoc[field] = value;
        }
      }
      await Car.updateOne(
        { _id: carDoc._id },
        { $set: set, $unset: { detailCheckFailedAt: 1 }, ...verifiedAdd(result.listing) },
        { timestamps: false }
      ).exec();
    } catch {
      // Ağ hatasında da damga vurulur ki aynı ilan istek başına yeniden denenmesin.
      await Car.updateOne(
        { _id: carDoc._id },
        { $set: { detailCheckedAt: new Date(), detailCheckFailedAt: new Date() } },
        { timestamps: false }
      )
        .exec()
        .catch(() => {});
    } finally {
      enrichmentInFlight.delete(key);
    }
  })();

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
  const now = new Date();
  const retryFailedBefore = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const batchLimit = Math.max(1, Math.min(250, Math.floor(Number.isFinite(limit) ? limit : 25)));
  const candidates = await Car.find(
    {
      sourceSite: "arabam",
      status: "active",
      listingUrl: { $exists: true },
      $and: [
        { $or: [{ detailCheckFailedAt: { $exists: false } }, { detailCheckFailedAt: { $lt: retryFailedBefore } }] },
        {
          $or: [
            { images: { $size: 0 } },
            { images: { $size: 1 } },
            { images: { $exists: false } },
            { detailCheckedAt: { $exists: false }, sellerType: { $in: ["", null] } },
            // Engel/zaman aşımı alanları bir gün sonra yeniden sıraya girer; her yönetim turunda
            // aynı ilk ilanları tekrar denememek için aşağıda en eski deneme önce seçilir.
            { detailCheckFailedAt: { $lt: retryFailedBefore } },
          ],
        },
      ],
    },
    { _id: 1, title: 1, listingUrl: 1, brand: 1, model: 1, year: 1, price: 1, imageUrl: 1, images: 1, description: 1, damageParts: 1, city: 1, address: 1, features: 1 }
  )
    .sort({ detailCheckFailedAt: 1, detailCheckedAt: 1, createdAt: 1, _id: 1 })
    .limit(batchLimit)
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
      const priceChanged = listing.price !== car.price && isPlausibleScrapedPrice(car.price, listing.price);
      await Car.updateOne(
        { _id: car._id },
        {
          ...(priceChanged ? { $push: { priceHistory: { price: listing.price, recordedAt: new Date() } } } : {}),
          $set: {
            ...arabamDetailSet(listing, car),
            ...(priceChanged ? { price: listing.price } : {}),
            lastVerifiedAt: new Date(),
            lastVerifyAttemptAt: new Date(),
            detailCheckedAt: new Date(),
          },
          $unset: { missingSince: 1, missingChecks: 1, detailCheckFailedAt: 1 },
          ...verifiedAdd(listing),
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
          price: priceChanged ? listing.price : car.price || 0,
          source: "arabam",
          title: car.title || `${car.brand} ${car.model}`,
          imageUrl: listing.images?.[0] || car.imageUrl || "",
          listingUrl: car.listingUrl,
        });
      }
    } else {
      const attemptedAt = new Date();
      await Car.updateOne(
        { _id: car._id },
        { $set: { detailCheckFailedAt: attemptedAt, lastVerifyAttemptAt: attemptedAt } },
        { timestamps: false }
      );
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
