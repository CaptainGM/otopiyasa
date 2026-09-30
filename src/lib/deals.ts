import { Car } from "@/types";



export interface Deal {
  car: Car;
  label: string;
  
  score: number;
}

export const DEAL_MIN_YEAR = 2010;
export const DEAL_MAX_MILEAGE = 150_000;

export const DEAL_MAX_DISCOUNT = 0.45;

export const DEAL_MIN_DISCOUNT = 0.12;
const DEAL_MIN_COMPARABLES = 3;

function lastDropPercent(car: Car): number {
  const history = car.priceHistory;
  if (!history || history.length < 2) return 0;
  const previous = history[history.length - 2].price;
  const current = history[history.length - 1].price;
  if (current >= previous || previous <= 0) return 0;
  return Math.round(((previous - current) / previous) * 100);
}


export function isSellableQuality(car: Car): boolean {
  return (
    car.year >= DEAL_MIN_YEAR &&
    car.mileage <= DEAL_MAX_MILEAGE &&
    !car.damageFlag &&
    car.price > 0
  );
}

export function pickDeals(cars: Car[], limit = 30): Deal[] {
  const deals: Deal[] = [];

  for (const car of cars) {
    if (!isSellableQuality(car)) continue;

    
    if (car.marketAvgPrice && (car.marketListingCount || 0) >= DEAL_MIN_COMPARABLES) {
      const discount = 1 - car.price / car.marketAvgPrice;
      if (discount >= DEAL_MIN_DISCOUNT && discount <= DEAL_MAX_DISCOUNT) {
        deals.push({
          car,
          label: `Piyasanın %${Math.round(discount * 100)} altı`,
          score: discount,
        });
        continue;
      }
    }

    
    const drop = lastDropPercent(car);
    if (drop >= 5) {
      deals.push({ car, label: `Fiyat düştü %${drop}`, score: drop / 100 });
    }
  }

 
  return deals.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * 30.000+ aktif ilanın TAMAMINI emsallerine göre analiz eder.
 * Tüm veritabanı taranarak gerçek piyasa ortalamalarına göre en avantajlı
 * ilk 30 gerçek fırsat aracını seçer.
 */
export async function findGlobalDeals(limit = 30): Promise<Deal[]> {
  const { Car } = await import("@/models/Car");
  const { PUBLIC_LISTING_FILTER } = await import("@/lib/listing-visibility");
  const { robustTrimmedAverage } = await import("@/lib/market-price");
  const { isLeanCarDoc, serializeCarPublicForList, LIST_IMAGE_LIMIT } = await import("@/lib/serialize-car");

  // 1. Tüm veri tabanındaki marka+model+yıl segmentlerini tek seferde hesapla
  const segmentRows = await Car.aggregate([
    {
      $match: {
        ...PUBLIC_LISTING_FILTER,
        price: { $gt: 30000, $lt: 150000000 },
      },
    },
    {
      $group: {
        _id: { brand: "$brand", model: "$model", year: "$year" },
        prices: { $push: "$price" },
        listingCount: { $sum: 1 },
      },
    },
    {
      $match: { listingCount: { $gte: DEAL_MIN_COMPARABLES } },
    },
  ]);

  const marketMap = new Map<string, { avgPrice: number; listingCount: number }>();
  for (const row of segmentRows) {
    const avgPrice = robustTrimmedAverage(row.prices || []);
    if (avgPrice > 0) {
      marketMap.set(`${row._id.brand}::${row._id.model}::${row._id.year}`, {
        avgPrice,
        listingCount: row.listingCount,
      });
    }
  }

  // 2. Tüm veritabanındaki (31.000+ araç) satılabilir kriterindeki adayları hafif projeksiyonla çek
  type RawCandidate = {
    _id: { toString(): string } | string;
    brand: string;
    model: string;
    year: number;
    price: number;
    title?: string;
    description?: string;
    paintChange?: string;
  };

  const rawListings = (await Car.find({
    ...PUBLIC_LISTING_FILTER,
    year: { $gte: DEAL_MIN_YEAR },
    mileage: { $lte: DEAL_MAX_MILEAGE },
    damageFlag: { $ne: true },
    price: { $gt: 30000, $lt: 150000000 },
  })
    .select("_id brand model year price title description paintChange")
    .lean()) as unknown as RawCandidate[];

  const isHeavyDamageOrPert = (car: RawCandidate) => {
    const text = `${car.title || ""} ${car.description || ""} ${car.paintChange || ""}`.toLowerCase();
    return /ağır hasar|pert kayıt|pertli|tam ziyan|çekme belge|hurda belge|ihale|airbag aç|şase hasar|taksi çıkma/i.test(text);
  };

  // 3. 31.000+ aracın tamamını piyasa emsallerine göre puanla
  const scoredDeals: Array<{
    id: string;
    discount: number;
    avgPrice: number;
    count: number;
    brand: string;
    model: string;
    year: number;
  }> = [];

  for (const car of rawListings) {
    if (isHeavyDamageOrPert(car)) continue;
    const key = `${car.brand}::${car.model}::${car.year}`;
    const stat = marketMap.get(key);
    if (!stat || stat.listingCount < DEAL_MIN_COMPARABLES) continue;

    const discount = 1 - car.price / stat.avgPrice;
    if (discount >= DEAL_MIN_DISCOUNT && discount <= DEAL_MAX_DISCOUNT) {
      scoredDeals.push({
        id: String(car._id),
        discount,
        avgPrice: stat.avgPrice,
        count: stat.listingCount,
        brand: car.brand,
        model: car.model,
        year: car.year,
      });
    }
  }

  scoredDeals.sort((a, b) => b.discount - a.discount);
  const topSlice = scoredDeals.slice(0, limit);
  if (topSlice.length === 0) return [];

  // 4. Yalnızca en iyi 30 aracın tam detaylarını ve görsellerini çek
  const topIds = topSlice.map((d) => d.id);
  const topDocs = ((await Car.find({
    _id: { $in: topIds },
  })
    .slice("images", LIST_IMAGE_LIMIT)
    .lean()) as unknown[]).filter(isLeanCarDoc);

  const docMap = new Map(topDocs.map((d) => [String(d._id), d]));

  return topSlice
    .map((item) => {
      const doc = docMap.get(item.id);
      if (!doc) return null;
      return {
        car: serializeCarPublicForList(doc, {
          brand: item.brand,
          model: item.model,
          year: item.year,
          avgPrice: item.avgPrice,
          listingCount: item.count,
        }),
        label: `Piyasanın %${Math.round(item.discount * 100)} altı`,
        score: item.discount,
      };
    })
    .filter((d): d is Deal => d !== null);
}
