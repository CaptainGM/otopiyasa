import { Car } from "@/models/Car";
import { User } from "@/models/User";
import { Comment } from "@/models/Comment";
import { getMarketMap } from "@/lib/market-price";
import { attachMarketToCars, isLeanCarDoc, LeanCarDoc } from "@/lib/serialize-car";
import { Car as CarType } from "@/types";

const CANDIDATE_POOL_LIMIT = 300;

async function toSerializedCars(docs: unknown[]): Promise<CarType[]> {
  const leanDocs = docs.filter(isLeanCarDoc);
  const marketMap = await getMarketMap(
    leanDocs.map((car) => ({ brand: car.brand, model: car.model, year: car.year }))
  );
  return attachMarketToCars(leanDocs, marketMap);
}

async function fallbackPopularCars(excludeIds: string[], limit: number): Promise<CarType[]> {
  
  const rated = await Comment.aggregate([
    { $group: { _id: "$car", avgRating: { $avg: "$rating" }, count: { $sum: 1 } } },
    { $sort: { avgRating: -1, count: -1 } },
    { $limit: limit * 2 },
  ]);

  const ratedIds = rated
    .map((r) => String(r._id))
    .filter((id) => !excludeIds.includes(id));

  const ratedDocs = ratedIds.length
    ? await Car.find({ _id: { $in: ratedIds } }).lean()
    : [];

  const ordered = ratedIds
    .map((id) => ratedDocs.find((d) => String((d as { _id: unknown })._id) === id))
    .filter(Boolean)
    .slice(0, limit);

  if (ordered.length >= limit) {
    return toSerializedCars(ordered);
  }

  const remaining = limit - ordered.length;
  const newestDocs = await Car.find({
    _id: { $nin: [...excludeIds, ...ratedIds] },
  })
    .sort({ createdAt: -1 })
    .limit(remaining)
    .lean();

  return toSerializedCars([...ordered, ...newestDocs]);
}

export async function getRecommendationsForUser(
  userId: string,
  limit = 8
): Promise<CarType[]> {
  const user = await User.findById(userId).populate("favorites").lean<{
    favorites: LeanCarDoc[];
  }>();

  const favorites = (user?.favorites || []).filter(isLeanCarDoc);
  const favoriteIds = favorites.map((f) => f._id.toString());

  if (favorites.length === 0) {
    return fallbackPopularCars(favoriteIds, limit);
  }

  const favoriteBrands = Array.from(new Set(favorites.map((f) => f.brand)));
  const favoriteModels = Array.from(new Set(favorites.map((f) => f.model)));

  let candidates = await Car.find({
    _id: { $nin: favoriteIds },
    $or: [{ brand: { $in: favoriteBrands } }, { model: { $in: favoriteModels } }],
  })
    .limit(CANDIDATE_POOL_LIMIT)
    .lean();

  if (candidates.length < limit) {
    const extra = await Car.find({ _id: { $nin: favoriteIds } })
      .limit(CANDIDATE_POOL_LIMIT)
      .lean();
    candidates = extra;
  }

  const scored = candidates
    .filter(isLeanCarDoc)
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
  limit = 4
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

  const sorted = pool
    .sort((a, b) => Math.abs(a.price - price) - Math.abs(b.price - price))
    .slice(0, limit);

  return toSerializedCars(sorted);
}
