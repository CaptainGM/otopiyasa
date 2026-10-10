import { Car } from "@/models/Car";
import { PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";
import { Types } from "mongoose";
import { modelFamily, modelFamilyKey } from "@/lib/model-family";

export interface MarketSegmentStats {
  brand: string;
  model: string;
  year: number;
  vehicleClass?: string;
  avgPrice: number;
  listingCount: number;
  /**
   * "model": aynı donanım adıyla en az 3 emsal var. "family": donanımda yetmediği için aynı yılın
   * tüm donanımları ("Corolla 1.6 Vision" + "Corolla 1.5 Dream" ...) birlikte sayıldı.
   */
  scope?: "model" | "family";
  /** scope "family" ise gösterilecek aile adı ("Corolla", "3 Serisi"). */
  familyLabel?: string;
}

const segmentCache = new Map<string, { stat: MarketSegmentStats; expires: number }>();
const SEGMENT_CACHE_TTL = 30 * 60 * 1000; // 30 dakika
export const MIN_MARKET_SAMPLE = 3;

/**
 * Piyasa ortalaması gösterilemeyen segmentler: aynı yılın tüm donanımları birlikte sayıldığında bile
 * (bkz. computeMarketMap) üçten az emsal kalan marka + model ailesi + yıl grupları.
 * Önce 2 emsalli olanlar gelir (tek yeni ilan ortalamayı açar), sonra yeni yıllar (piyasada daha çok ilanı var).
 */
export function selectSparseMarketSegments(
  groups: Array<{ brand: string; model: string; year: number; vehicleClass?: string; prices: number[] }>,
  limit = 100
) {
  const families = new Map<
    string,
    { brand: string; model: string; familyKey: string; year: number; vehicleClass: string; prices: number[]; hiddenListings: number }
  >();
  for (const group of groups) {
    if (!group.brand || !group.model || !group.year) continue;
    const familyKey = modelFamilyKey(group.model, group.brand);
    if (!familyKey) continue;
    const vehicleClass = group.vehicleClass || "otomobil";
    const key = `${group.brand}::${vehicleClass}::${familyKey}::${group.year}`;
    const label = modelFamily(group.model, group.brand);
    const current = families.get(key);
    if (current) {
      current.prices.push(...(group.prices || []));
      current.hiddenListings += (group.prices || []).length;
      // Aramada kullanılacak ad: karışık harfli ve kısa olan ("Juke" > "JUKE").
      if (current.model === current.model.toLocaleUpperCase("tr-TR") && label !== label.toLocaleUpperCase("tr-TR")) {
        current.model = label;
      }
    } else {
      families.set(key, {
        brand: group.brand,
        model: label,
        familyKey,
        year: group.year,
        vehicleClass,
        prices: [...(group.prices || [])],
        hiddenListings: (group.prices || []).length,
      });
    }
  }
  return [...families.values()]
    .map(({ prices, ...family }) => ({ ...family, listingCount: robustTrimmedPrices(prices).length }))
    .filter((family) => family.listingCount < MIN_MARKET_SAMPLE)
    .sort((a, b) => b.listingCount - a.listingCount || b.year - a.year)
    .slice(0, Math.max(0, Math.trunc(limit)));
}

/** Aile ortalaması aynı marka + yılın diğer donanımlarını da etkilediği için marka + yıl düzeyinde silinir. */
export function invalidateMarketSegments(segments: Array<{ brand: string; model: string; year: number }>) {
  const brandYears = new Set(segments.map((segment) => `${segment.brand}::${segment.year}`));
  for (const key of segmentCache.keys()) {
    const [brand, , year] = key.split("::");
    if (brandYears.has(`${brand}::${year}`)) segmentCache.delete(key);
  }
}

export async function getMarketMap(
  segments: Array<{ brand: string; model: string; year: number; vehicleClass?: string }>,
  excludedListingIds: Types.ObjectId[] = []
): Promise<Map<string, MarketSegmentStats>> {
  if (segments.length === 0) return new Map<string, MarketSegmentStats>();

  const result = new Map<string, MarketSegmentStats>();
  const missingKeys = new Set<string>();
  const now = Date.now();
  const uniqueKeys = new Set(
    segments
      .filter((segment) => segment.brand && segment.model && segment.year)
      .map((segment) => segmentKey(segment.brand, segment.model, segment.year, segment.vehicleClass))
  );

  if (excludedListingIds.length > 0) {
    const freshMap = await computeMarketMap(uniqueKeys, excludedListingIds);
    for (const key of uniqueKeys) {
      const stat = freshMap.get(key);
      if (stat) {
        result.set(key, stat);
      } else {
        const [brand, model, year, vehicleClass] = key.split("::");
        result.set(key, {
          brand,
          model,
          year: Number(year) || 0,
          vehicleClass: vehicleClass || "otomobil",
          avgPrice: 0,
          listingCount: 0,
        });
      }
    }
    return result;
  }

  for (const key of uniqueKeys) {
    const cachedEntry = segmentCache.get(key);
    if (cachedEntry && cachedEntry.expires > now) {
      result.set(key, cachedEntry.stat);
    } else {
      missingKeys.add(key);
    }
  }

  if (missingKeys.size > 0) {
    const freshMap = await computeMarketMap(missingKeys);
    for (const [key, stat] of freshMap.entries()) {
      segmentCache.set(key, { stat, expires: now + SEGMENT_CACHE_TTL });
      result.set(key, stat);
    }
    // Bulunamayan segmentleri de boş olarak önbellekle ki tekrar tekrar DB'ye sormasın
    for (const key of missingKeys) {
      if (!result.has(key)) {
        const [brand, model, yearStr, vehicleClass] = key.split("::");
        const emptyStat: MarketSegmentStats = {
          brand,
          model,
          year: Number(yearStr) || 0,
          vehicleClass: vehicleClass || "otomobil",
          avgPrice: 0,
          listingCount: 0,
        };
        segmentCache.set(key, { stat: emptyStat, expires: now + SEGMENT_CACHE_TTL });
        result.set(key, emptyStat);
      }
    }
  }

  return result;
}

/**
 * Uç değerleri (outlier) IQR ve medyan oran kontrolüyle ayıklayarak
 * piyasa ortalamasını bozan anormal/hatalı ilanları (örn: 36.5M Defender gibi) temizler.
 */
export function robustTrimmedAverage(prices: number[]): number {
  const inliers = robustTrimmedPrices(prices);
  if (inliers.length === 0) return 0;
  return Math.round(inliers.reduce((sum, price) => sum + price, 0) / inliers.length);
}

export function summarizeMarketPrices(prices: number[]) {
  const comparablePrices = robustTrimmedPrices(prices);
  const listingCount = comparablePrices.length;
  return {
    avgPrice:
      listingCount >= MIN_MARKET_SAMPLE
        ? Math.round(comparablePrices.reduce((sum, price) => sum + price, 0) / listingCount)
        : 0,
    listingCount,
  };
}

export function robustTrimmedPrices(prices: number[]): number[] {
  // Aşırı anomalileri (150M TL üzeri veya 30K TL altı) baştan filtrele
  const validPrices = prices.filter((p) => p >= 30_000 && p <= 150_000_000);
  if (validPrices.length <= 2) return validPrices;

  const sorted = [...validPrices].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const med = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

  // Aşırı orantısız uçları (medyanın 2.5 katından büyük veya 0.35 katından küçük) temizle
  let inliers = sorted.filter((p) => p >= med * 0.35 && p <= med * 2.5);

  // Yeterli eleman varsa (>= 4), klasik IQR (Interquartile Range) filtresi de uygula
  if (inliers.length >= 4) {
    const q1Idx = Math.floor(inliers.length * 0.25);
    const q3Idx = Math.floor(inliers.length * 0.75);
    const q1 = inliers[q1Idx];
    const q3 = inliers[q3Idx];
    const iqr = q3 - q1;
    if (iqr > 0) {
      const lower = Math.max(0, q1 - 1.5 * iqr);
      const upper = q3 + 1.5 * iqr;
      const iqrFiltered = inliers.filter((p) => p >= lower && p <= upper);
      if (iqrFiltered.length >= 2) {
        inliers = iqrFiltered;
      }
    }
  }

  return inliers.length === 0 ? sorted : inliers;
}

/** Segment fiyat dağılımında ortalamaya alınmayan fiyatlar; aynı liste aykırı ilan rozetini de besler. */
export function findMarketOutlierPrices(prices: number[]): Set<number> {
  const included = new Set(robustTrimmedPrices(prices));
  return new Set(prices.filter((price) => !included.has(price)));
}

async function computeMarketMap(
  uniqueKeys: Set<string>,
  excludedListingIds: Types.ObjectId[] = []
) {
  if (uniqueKeys.size === 0) return new Map<string, MarketSegmentStats>();
  const requested = [...uniqueKeys].map((key) => {
    const [brand, model, year, vehicleClass] = key.split("::");
    return { key, brand, model, year: Number(year), vehicleClass: vehicleClass || "otomobil" };
  });
  // Aynı marka + yıl içindeki tüm modeller çekilir; aile eşleşmesi aşağıda yapılır. Kaynaklar aynı aracı
  // "Corolla 1.6 Vision", "COROLLA", "Corolla" diye yazdığı için tam model eşleşmesinde ilanların ~%37'si
  // emsalsiz kalıyor ve ortalama hiç gösterilmiyordu.
  const brandYears = new Map<string, { brand: string; year: number; vehicleClass: string }>();
  for (const r of requested) brandYears.set(`${r.brand}::${r.year}::${r.vehicleClass}`, r);

  // GÜVENLİK: Piyasa ortalamasında yalnızca aktif/onaylı ilanları say.
  const rows = await Car.aggregate([
    {
      $match: {
        $or: [...brandYears.values()].map(({ brand, year, vehicleClass }) => ({
          brand,
          year,
          ...(vehicleClass === "otomobil"
            ? { $or: [{ vehicleClass: "otomobil" }, { vehicleClass: { $exists: false } }] }
            : { vehicleClass }),
        })),
        ...PUBLIC_LISTING_FILTER,
        ...(excludedListingIds.length > 0 ? { _id: { $nin: excludedListingIds } } : {}),
      },
    },
    {
      $group: {
        _id: { brand: "$brand", model: "$model", year: "$year", vehicleClass: { $ifNull: ["$vehicleClass", "otomobil"] } },
        prices: { $push: "$price" },
        listingCount: { $sum: 1 },
      },
    },
  ]);

  return marketStatsFromRows(rows, requested);
}

/** Marka + model + yıl gruplarından (fiyat listeleriyle) istenen segmentlerin piyasa ortalaması; DB'siz. */
export function marketStatsFromRows(
  rows: Array<{ _id: { brand: string; model: string; year: number; vehicleClass?: string }; prices?: number[] }>,
  requested: Array<{ key: string; brand: string; model: string; year: number; vehicleClass?: string }>
): Map<string, MarketSegmentStats> {
  const exactPrices = new Map<string, number[]>();
  const familyPrices = new Map<string, number[]>();
  for (const row of rows) {
    const { brand, model, year } = row._id;
    const prices: number[] = row.prices || [];
    const vehicleClass = row._id.vehicleClass || "otomobil";
    exactPrices.set(segmentKey(brand, model, year, vehicleClass), prices);
    const familyKey = `${brand}::${vehicleClass}::${modelFamilyKey(model, brand)}::${year}`;
    const bucket = familyPrices.get(familyKey);
    if (bucket) bucket.push(...prices);
    else familyPrices.set(familyKey, [...prices]);
  }

  const map = new Map<string, MarketSegmentStats>();
  for (const r of requested) {
    const vehicleClass = r.vehicleClass || "otomobil";
    const exact = summarizeMarketPrices(exactPrices.get(r.key) || []);
    const base = { brand: r.brand, model: r.model, year: r.year, vehicleClass };
    if (exact.listingCount >= MIN_MARKET_SAMPLE) {
      map.set(r.key, { ...base, ...exact, scope: "model" });
      continue;
    }
    const familyKey = modelFamilyKey(r.model, r.brand);
    const family = familyKey
      ? summarizeMarketPrices(familyPrices.get(`${r.brand}::${vehicleClass}::${familyKey}::${r.year}`) || [])
      : exact;
    if (family.listingCount >= MIN_MARKET_SAMPLE) {
      map.set(r.key, { ...base, ...family, scope: "family", familyLabel: modelFamily(r.model, r.brand) });
    } else if (exact.listingCount > 0 || family.listingCount > 0) {
      map.set(r.key, { ...base, avgPrice: 0, listingCount: Math.max(exact.listingCount, family.listingCount) });
    }
  }
  return map;
}

export function segmentKey(brand: string, model: string, year: number, vehicleClass = "otomobil") {
  return `${brand}::${model}::${year}::${vehicleClass}`;
}
