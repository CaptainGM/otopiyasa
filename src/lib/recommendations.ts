import { Car } from "@/models/Car";
import { User } from "@/models/User";
import { getMarketMap } from "@/lib/market-price";
import { attachMarketToCars, isLeanCarDoc, LeanCarDoc } from "@/lib/serialize-car";
import { extractVehicleTokens, calculateTitleMatchScore } from "@/lib/utils";
import { Car as CarType } from "@/types";
import { PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";


async function toSerializedCars(docs: unknown[]): Promise<CarType[]> {
  const leanDocs = docs.filter(isLeanCarDoc);
  const marketMap = await getMarketMap(
    leanDocs.map((car) => ({ brand: car.brand, model: car.model, year: car.year }))
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

export async function getSimilarCars(
  carId: string,
  brand: string,
  model: string,
  price: number,
  limit = 12,
  title?: string,
  year?: number,
  mileage?: number,
  targetPrice?: number
): Promise<CarType[]> {
  const sameModel = await Car.find({
    ...PUBLIC_LISTING_FILTER,
    brand,
    model,
    _id: { $ne: carId },
  })
    .sort({ createdAt: -1 })
    .limit(40)
    .slice("images", 4)
    .lean();

  let pool: LeanCarDoc[] = (sameModel as unknown[]).filter(isLeanCarDoc);

  if (pool.length < limit) {
    const sameBrand = await Car.find({
      ...PUBLIC_LISTING_FILTER,
      brand,
      model: { $ne: model },
      _id: { $ne: carId },
    })
      .sort({ createdAt: -1 })
      .limit(30)
      .slice("images", 4)
      .lean();
    pool = [...pool, ...(sameBrand as unknown[]).filter(isLeanCarDoc)];
  }

  // %100 Jenerik alt-model, gövde tipi ve paket eşleşmesi
  const targetTokens = extractVehicleTokens(title || "", brand, model);
  const refPrice = targetPrice && targetPrice > 0 ? targetPrice : price;

  const sorted = pool
    .sort((a, b) => {
      if (targetTokens.length > 0) {
        const aMatch = calculateTitleMatchScore(targetTokens, a.title || "");
        const bMatch = calculateTitleMatchScore(targetTokens, b.title || "");
        if (aMatch !== bMatch) return bMatch - aMatch;
      }
      // Fiyat yakınlığı: Belirlenen hedef fiyata (örn. adil piyasa değeri 265 bin) yakın olan emsaller öne çıksın
      const priceDiffA = Math.abs(a.price - refPrice) / (refPrice || 1);
      const priceDiffB = Math.abs(b.price - refPrice) / (refPrice || 1);
      const yearDiffA = year && a.year ? Math.abs(a.year - year) / 5 : 0;
      const yearDiffB = year && b.year ? Math.abs(b.year - year) / 5 : 0;
      const kmDiffA = mileage && a.mileage ? Math.abs(a.mileage - mileage) / 100000 : 0;
      const kmDiffB = mileage && b.mileage ? Math.abs(b.mileage - mileage) / 100000 : 0;

      const scoreA = priceDiffA * 0.45 + yearDiffA * 0.35 + kmDiffA * 0.2;
      const scoreB = priceDiffB * 0.45 + yearDiffB * 0.35 + kmDiffB * 0.2;
      return scoreA - scoreB;
    })
    .slice(0, limit);

  // Benzer ilan kartları piyasa ortalamalarını render etmez; gereksiz DB agregasyonunu atla
  return attachMarketToCars(sorted, new Map());
}
