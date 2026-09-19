import { Car } from "@/models/Car";
import { User } from "@/models/User";
import { Comment } from "@/models/Comment";
import { getMarketMap } from "@/lib/market-price";
import { attachMarketToCars, isLeanCarDoc, LeanCarDoc } from "@/lib/serialize-car";
import { extractVehicleTokens, calculateTitleMatchScore } from "@/lib/utils";
import { Car as CarType } from "@/types";
import { PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";

const CANDIDATE_POOL_LIMIT = 300;

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
  limit = 8,
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
  const favoriteModels = Array.from(new Set(favorites.map((f) => f.model)));

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
  limit = 4,
  title?: string
): Promise<CarType[]> {
  const sameModel = await Car.find({ brand, model, _id: { $ne: carId } })
    .limit(50)
    .lean();

  let pool = sameModel.filter(isLeanCarDoc);

  if (pool.length < limit) {
    const sameBrand = await Car.find({
      brand,
      model: { $ne: model },
      _id: { $ne: carId },
    })
      .limit(50)
      .lean();
    pool = [...pool, ...sameBrand.filter(isLeanCarDoc)];
  }

  // %100 Jenerik alt-model, gövde tipi ve paket eşleşmesi (tüm marka ve modeller için evrensel)
  const targetTokens = extractVehicleTokens(title || "", brand, model);

  const sorted = pool
    .sort((a, b) => {
      if (targetTokens.length > 0) {
        const aMatch = calculateTitleMatchScore(targetTokens, a.title || "");
        const bMatch = calculateTitleMatchScore(targetTokens, b.title || "");
        if (aMatch !== bMatch) return bMatch - aMatch;
      }
      return Math.abs(a.price - price) - Math.abs(b.price - price);
    })
    .slice(0, limit);

  return toSerializedCars(sorted);
}
