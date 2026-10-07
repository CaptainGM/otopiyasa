import { Car } from "@/models/Car";
import { PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";
import { derivePainted, predictPrice, withPredictionMemo, type Condition } from "@/lib/price-prediction";
import { DEAL_MAX_MILEAGE, DEAL_MIN_YEAR, SUSPICIOUS_DISCOUNT } from "@/lib/deals";
import { MIN_MARKET_COMPARABLES } from "@/lib/market-position";

/**
 * ADİL PİYASA DEĞERİ: her ilan için ilan sayfasındaki fiyat analiziyle AYNI hesap (predictPrice: model yılı, km,
 * hasar/boya, donanım ve en yakın emsaller). Eskiden kartlar ham segment ortalamasını ("aynı marka/model/yıl"),
 * ilan sayfası ise bu düzeltilmiş değeri kullanıyordu: aynı ilan kartta "%12 ucuz", sayfada "piyasa değerinde"
 * görünebiliyordu. Artık kart göstergesi, ilan sayfası, "Haftanın fırsatları" ve ana sayfa panosu tek sayıya bakar.
 *
 * Oracle sunucusundaki daemon saatte bir, adil değeri hiç hesaplanmamış, fiyatı değişmiş ya da 24 saatten eski
 * ilanları yeniden hesaplar. İlan sayfası açılınca da anlık sonuç ilanın üstüne yazılır (bkz. CarDetailBody).
 */

const STALE_MS = 24 * 60 * 60 * 1000;

/**
 * Fırsat eşiği: adil değerin en az %18 altı. Adil değer tahmini olduğu için küçük farklar tahmin hatası olabilir;
 * %12 eşiğinde ~1.000 ilan "fırsat" çıkıyordu (her 25 ilandan biri), %18'de ~300: gerçekten öne çıkanlar.
 */
export const DEAL_MIN_FAIR_DISCOUNT = 0.18;

// Büyük harfli başlıklar ("PERTLİ", "AĞIR HASARLI") da yakalansın: Türkçe küçük harfe çevrilip ı→i yapılır
// (JavaScript'in büyük/küçük harf duyarsız araması İ ile i'yi eşlemiyor).
const trFold = (text: string) => text.toLocaleLowerCase("tr").replace(/ı/g, "i");
const HEAVY_DAMAGE = new RegExp(
  ["ağır hasar", "pert kayıt", "pertli", "tam ziyan", "çekme belge", "hurda belge", "ihale", "airbag aç", "şase hasar", "taksi çıkma"]
    .map(trFold)
    .join("|")
);

export function conditionOf(car: { damageFlag?: boolean; paintChange?: string }): Condition {
  if (car.damageFlag) return "damaged";
  return derivePainted(car.paintChange) ? "painted" : "clean";
}

interface DealInput {
  year: number;
  mileage: number;
  price: number;
  damageFlag?: boolean;
  title?: string;
  description?: string;
  paintChange?: string;
}

/**
 * "Haftanın fırsatları" ölçütü: 2010 ve sonrası, en fazla 150 bin km, hasar kaydı ve ağır hasar/pert ifadesi yok,
 * adil değerin %18–%30 altında. %30'dan fazla altı fırsat değil uyarıdır (hatalı fiyat ya da kapora dolandırıcılığı).
 */
export function isDealCandidate(car: DealInput, disc: number, fairN: number): boolean {
  if (fairN < MIN_MARKET_COMPARABLES) return false;
  if (disc < DEAL_MIN_FAIR_DISCOUNT || disc > SUSPICIOUS_DISCOUNT) return false;
  if (car.year < DEAL_MIN_YEAR || car.mileage > DEAL_MAX_MILEAGE || car.damageFlag || car.price <= 0) return false;
  return !HEAVY_DAMAGE.test(trFold(`${car.title ?? ""} ${car.description ?? ""} ${car.paintChange ?? ""}`));
}

/** Bir ilanın adil değer alanları ($set için). Emsal yetersizse null. */
export function fairFields(car: DealInput, predictedPrice: number, sampleSize: number, at = new Date()) {
  if (!predictedPrice || predictedPrice <= 0 || sampleSize < MIN_MARKET_COMPARABLES) return null;
  const fair = Math.round(predictedPrice);
  const disc = Math.round(((fair - car.price) / fair) * 1000) / 1000;
  return {
    "market.fair": fair,
    "market.fairN": sampleSize,
    "market.disc": disc,
    "market.deal": isDealCandidate(car, disc, sampleSize),
    "market.fp": car.price,
    "market.fairAt": at,
  };
}

type FairCandidate = DealInput & {
  _id: unknown;
  brand: string;
  model: string;
  market?: { fairAt?: Date; fp?: number } | null;
};

/**
 * Adil değeri eksik, eski (24 saat) ya da fiyatı değişmiş ilanları hesaplar. `limit` bir turda en çok kaç ilan
 * hesaplanacağı (veritabanı yükü saate yayılsın). Marka marka ilerler: aynı markanın sorguları paylaşılır, bellek
 * her markadan sonra boşalır.
 */
export async function refreshFairValues(limit = 8000): Promise<{ scanned: number; updated: number; cleared: number; ms: number }> {
  const started = Date.now();
  const staleBefore = new Date(Date.now() - STALE_MS);
  const candidates = await Car.find({
    ...PUBLIC_LISTING_FILTER,
    price: { $gt: 0 },
    $or: [
      { "market.fairAt": { $exists: false } },
      { "market.fairAt": { $lt: staleBefore } },
      { $expr: { $ne: ["$market.fp", "$price"] } },
    ],
  })
    .select("brand model year mileage price damageFlag paintChange title description market.fairAt market.fp")
    // Sıralama yok: Atlas sıralamayı bellekte (32 MB) yapıyor, açıklamalarla birlikte 27 bin ilan sığmıyordu.
    // Sıra önemsiz: bu turda kalanlar bir sonraki saatte seçilir.
    .limit(limit)
    .lean<FairCandidate[]>();

  const byBrand = new Map<string, FairCandidate[]>();
  for (const car of candidates) {
    const list = byBrand.get(car.brand);
    if (list) list.push(car);
    else byBrand.set(car.brand, [car]);
  }

  let updated = 0;
  let cleared = 0;
  let ops: Parameters<typeof Car.bulkWrite>[0] = [];
  const flush = async () => {
    if (ops.length === 0) return;
    await Car.bulkWrite(ops, { ordered: false });
    ops = [];
  };

  for (const cars of byBrand.values()) {
    await withPredictionMemo(async () => {
      for (const car of cars) {
        if (!car.brand || !car.model || !car.year) continue;
        let fields: ReturnType<typeof fairFields> = null;
        try {
          const prediction = await predictPrice(car.brand, car.model, car.year, car.mileage, conditionOf(car), car.title, {
            modelFromDb: true,
          });
          fields = fairFields(car, prediction.predictedPrice, prediction.sampleSize);
        } catch {
          fields = null;
        }
        if (fields) {
          ops.push({ updateOne: { filter: { _id: car._id }, update: { $set: fields }, timestamps: false } });
          updated++;
        } else {
          // Hesaplanamadı: eski değer kalmasın, bir sonraki turda tekrar denenmesin diye tarih yazılır.
          ops.push({
            updateOne: {
              filter: { _id: car._id },
              update: {
                $set: { "market.fairAt": new Date(), "market.fp": car.price, "market.deal": false },
                $unset: { "market.fair": 1, "market.fairN": 1, "market.disc": 1 },
              },
              timestamps: false,
            },
          });
          cleared++;
        }
        if (ops.length >= 500) await flush();
      }
    });
  }
  await flush();
  return { scanned: candidates.length, updated, cleared, ms: Date.now() - started };
}

/** "Haftanın fırsatları": adil değerin en çok altında olan fırsat ilanlar ve toplam fırsat sayısı. */
export async function findDealListings(limit: number, skip = 0) {
  const filter = { ...PUBLIC_LISTING_FILTER, "market.deal": true };
  const [docs, total] = await Promise.all([
    Car.find(filter).sort({ "market.disc": -1 }).skip(skip).limit(limit).slice("images", 8).lean(),
    Car.countDocuments(filter),
  ]);
  return { docs, total };
}

interface LiveFairInput extends DealInput {
  _id: unknown;
  brand: string;
  model: string;
  status?: string;
  market?: { fair?: number; fp?: number } | null;
}

/**
 * İlan sayfası (web ve mobil API) için anlık adil değer: fiyat analizi kartıyla aynı predictPrice sonucu. Kayıtlı
 * değerden farklıysa ilanın üstüne yazılır; listelerdeki kart da aynı sayıyı göstersin (beklemeden, hata yutulur).
 */
export async function liveFairValue(car: LiveFairInput) {
  const { cached, CACHE_TTL } = await import("@/lib/cache");
  const condition = conditionOf(car);
  const prediction = await cached(
    `predict:${car.brand}|${car.model}|${car.year}|${Math.round(car.mileage / 20000)}|${condition}|${(car.title ?? "").slice(0, 30)}`,
    CACHE_TTL.medium,
    () => predictPrice(car.brand, car.model, car.year, car.mileage, condition, car.title)
  );
  const fields = prediction.sampleSize >= MIN_MARKET_COMPARABLES
    ? fairFields(car, prediction.predictedPrice, prediction.sampleSize)
    : null;
  if (fields && car.status === "active" && (car.market?.fair !== fields["market.fair"] || car.market?.fp !== car.price)) {
    void Car.updateOne({ _id: car._id }, { $set: fields }, { timestamps: false }).catch(() => {});
  }
  return { prediction, fields };
}

/**
 * Fırsat bayrağını kayıtlı adil değerden yeniden değerlendirir (tahmin yeniden hesaplanmaz, hızlı). Fırsat ölçütü
 * değişince eski bayraklar kalmasın diye daemon her saat çalıştırır.
 */
export async function recomputeDealFlags(): Promise<{ scanned: number; changed: number }> {
  const cursor = Car.find({ ...PUBLIC_LISTING_FILTER, "market.fair": { $gt: 0 } })
    .select("year mileage price damageFlag title description paintChange market.disc market.fairN market.deal")
    .lean<Array<DealInput & { _id: unknown; market?: { disc?: number; fairN?: number; deal?: boolean } }>>()
    .cursor({ batchSize: 1000 });
  let scanned = 0;
  let changed = 0;
  let ops: Parameters<typeof Car.bulkWrite>[0] = [];
  for await (const car of cursor) {
    scanned++;
    const deal = isDealCandidate(car, car.market?.disc ?? 0, car.market?.fairN ?? 0);
    if (deal === (car.market?.deal ?? false)) continue;
    ops.push({ updateOne: { filter: { _id: car._id }, update: { $set: { "market.deal": deal } }, timestamps: false } });
    changed++;
    if (ops.length >= 500) {
      await Car.bulkWrite(ops, { ordered: false });
      ops = [];
    }
  }
  if (ops.length) await Car.bulkWrite(ops, { ordered: false });
  return { scanned, changed };
}
