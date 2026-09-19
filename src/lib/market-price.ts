import { Car } from "@/models/Car";
import { cached, CACHE_TTL } from "@/lib/cache";
import { PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";

export interface MarketSegmentStats {
  brand: string;
  model: string;
  year: number;
  avgPrice: number;
  listingCount: number;
}

const segmentCache = new Map<string, { stat: MarketSegmentStats; expires: number }>();
const SEGMENT_CACHE_TTL = 30 * 60 * 1000; // 30 dakika

export async function getMarketMap(
  segments: Array<{ brand: string; model: string; year: number }>
): Promise<Map<string, MarketSegmentStats>> {
  if (segments.length === 0) return new Map<string, MarketSegmentStats>();

  const result = new Map<string, MarketSegmentStats>();
  const missingKeys = new Set<string>();
  const now = Date.now();

  for (const s of segments) {
    if (!s.brand || !s.model || !s.year) continue;
    const key = `${s.brand}::${s.model}::${s.year}`;
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
        const [brand, model, yearStr] = key.split("::");
        const emptyStat: MarketSegmentStats = {
          brand,
          model,
          year: Number(yearStr) || 0,
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
  // Aşırı anomalileri (150M TL üzeri veya 30K TL altı) baştan filtrele
  const validPrices = prices.filter((p) => p >= 30_000 && p <= 150_000_000);
  if (validPrices.length === 0) return 0;
  if (validPrices.length <= 2) {
    return Math.round(validPrices.reduce((a, b) => a + b, 0) / validPrices.length);
  }

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

  if (inliers.length === 0) inliers = sorted;
  const sum = inliers.reduce((a, b) => a + b, 0);
  return Math.round(sum / inliers.length);
}

async function computeMarketMap(uniqueKeys: Set<string>) {
  const orConditions = [...uniqueKeys].map((key) => {
    const [brand, model, year] = key.split("::");
    return { brand, model, year: Number(year) };
  });

  // GÜVENLİK: Piyasa ortalamasında yalnızca aktif/onaylı ilanları say.
  const rows = await Car.aggregate([
    { $match: { $or: orConditions, ...PUBLIC_LISTING_FILTER } },
    {
      $group: {
        _id: { brand: "$brand", model: "$model", year: "$year" },
        prices: { $push: "$price" },
        listingCount: { $sum: 1 },
      },
    },
  ]);

  const map = new Map<string, MarketSegmentStats>();
  for (const row of rows) {
    const avgPrice = robustTrimmedAverage(row.prices || []);
    map.set(`${row._id.brand}::${row._id.model}::${row._id.year}`, {
      brand: row._id.brand,
      model: row._id.model,
      year: row._id.year,
      avgPrice,
      listingCount: row.listingCount,
    });
  }
  return map;
}

export function segmentKey(brand: string, model: string, year: number) {
  return `${brand}::${model}::${year}`;
}
