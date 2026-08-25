import { Car } from "@/models/Car";
import { cached, CACHE_TTL } from "@/lib/cache";

export interface MarketSegmentStats {
  brand: string;
  model: string;
  year: number;
  avgPrice: number;
  listingCount: number;
}

export async function getMarketMap(
  segments: Array<{ brand: string; model: string; year: number }>
) {
  if (segments.length === 0) return new Map<string, MarketSegmentStats>();

  const uniqueKeys = new Set(
    segments.map((s) => `${s.brand}::${s.model}::${s.year}`)
  );

  
  const cacheKey = "market:" + [...uniqueKeys].sort().join("|");
  return cached(cacheKey, CACHE_TTL.medium, () => computeMarketMap(uniqueKeys));
}

async function computeMarketMap(uniqueKeys: Set<string>) {

  const orConditions = [...uniqueKeys].map((key) => {
    const [brand, model, year] = key.split("::");
    return { brand, model, year: Number(year) };
  });

  const rows = await Car.aggregate([
    { $match: { $or: orConditions } },
    {
      $group: {
        _id: { brand: "$brand", model: "$model", year: "$year" },
        avgPrice: { $avg: "$price" },
        listingCount: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        brand: "$_id.brand",
        model: "$_id.model",
        year: "$_id.year",
        avgPrice: { $round: ["$avgPrice", 0] },
        listingCount: 1,
      },
    },
  ]);

  const map = new Map<string, MarketSegmentStats>();
  for (const row of rows) {
    map.set(`${row.brand}::${row.model}::${row.year}`, row);
  }
  return map;
}

export function segmentKey(brand: string, model: string, year: number) {
  return `${brand}::${model}::${year}`;
}
