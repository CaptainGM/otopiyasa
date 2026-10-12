import { Car } from "@/models/Car";
import { User } from "@/models/User";
import { getMarketMap } from "@/lib/market-price";
import { attachMarketToCars, isLeanCarDoc, LeanCarDoc } from "@/lib/serialize-car";
import { similarQuery, rankSimilar } from "@/lib/comparables";
import { Car as CarType } from "@/types";
import { PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";


async function toSerializedCars(docs: unknown[]): Promise<CarType[]> {
  const leanDocs = docs.filter(isLeanCarDoc);
  const marketMap = await getMarketMap(
    leanDocs.map((car) => ({ brand: car.brand, model: car.model, year: car.year, vehicleClass: car.vehicleClass }))
  );
  return attachMarketToCars(leanDocs, marketMap);
}

async function fallbackPopularCars(excludeIds: string[], limit: number): Promise<CarType[]> {
  // İndeksli en güncel aktif ilanlar (status: 1, createdAt: -1) ile anında döner
  const newestDocs = await Car.find({
    ...PUBLIC_LISTING_FILTER,
    _id: { $nin: excludeIds },
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return toSerializedCars(newestDocs);
}

export async function getRecommendationsForUser(
  userId: string,
  limit = 50,
  preloadedFavorites?: LeanCarDoc[]
): Promise<CarType[]> {
  let favorites = preloadedFavorites;
  if (!favorites) {
    const user = await User.findById(userId).populate("favorites").lean<{
      favorites: LeanCarDoc[];
    }>();
    favorites = (user?.favorites || []).filter(isLeanCarDoc);
  }

  const favoriteIds = favorites.map((f) => f._id.toString());

  if (favorites.length === 0) {
    return fallbackPopularCars(favoriteIds, limit);
  }

  const favoriteBrands = Array.from(new Set(favorites.map((f) => f.brand)));

  // İndeks dostu ({ status: 1, brand: 1, model: 1, year: 1 }) ultra hızlı sorgu
  const rawCandidates = await Car.find({
    ...PUBLIC_LISTING_FILTER,
    brand: { $in: favoriteBrands },
  })
    .sort({ createdAt: -1 })
    .limit(30)
    .lean();

  let unvisited = rawCandidates
    .filter(isLeanCarDoc)
    .filter((c) => !favoriteIds.includes(String(c._id)));

  if (unvisited.length < limit) {
    const extra = await Car.find(PUBLIC_LISTING_FILTER)
      .sort({ createdAt: -1 })
      .limit(limit + 5)
      .lean();
    for (const doc of extra) {
      if (
        isLeanCarDoc(doc) &&
        !favoriteIds.includes(String(doc._id)) &&
        !unvisited.some((u) => String(u._id) === String(doc._id))
      ) {
        unvisited.push(doc);
        if (unvisited.length >= limit) break;
      }
    }
  }

  const scored = unvisited
    .map((candidate) => {
      let score = 0;
      for (const fav of favorites) {
        if (candidate.brand === fav.brand) score += 3;
        if (candidate.model === fav.model) score += 4;
        const priceDiff = Math.abs(candidate.price - fav.price);
        score += 2 / (1 + priceDiff / Math.max(fav.price, 1));
      }
      return { candidate, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.candidate);

  if (scored.length === 0) {
    return fallbackPopularCars(favoriteIds, limit);
  }

  return toSerializedCars(scored);
}

/**
 * Benzer ilanlar: aynı marka ve model ailesi, yakın yıl (en fazla ±3, tercihen ±2) ve yakın kilometre. Fiyat burada emsal seçmez; eskiden
 * başlık eşleşmesi ve düşük ağırlıklı yıl farkı yüzünden 2025 modelin yanına 2001 modeller girebiliyordu. Kurallar lib/comparables.ts'te.
 */
export async function getSimilarCars(
  carId: string,
  brand: string,
  model: string,
  _price: number,
  limit = 12,
  _title?: string,
  year?: number,
  mileage?: number,
  _targetPrice?: number,
  vehicleClass?: string
): Promise<CarType[]> {
  const subject = { brand, model, year, mileage, vehicleClass };
  const candidates = await Car.find({
    ...PUBLIC_LISTING_FILTER,
    ...similarQuery(subject),
    _id: { $ne: carId },
  })
    .sort({ createdAt: -1 })
    .limit(300)
    .slice("images", 4)
    .lean();

  const pool = (candidates as unknown[]).filter(isLeanCarDoc) as LeanCarDoc[];
  const picked = rankSimilar(pool, { year, mileage }, limit);

  // Benzer ilan kartları piyasa ortalamalarını render etmez; gereksiz DB agregasyonunu atla
  return attachMarketToCars(picked, new Map());
}
