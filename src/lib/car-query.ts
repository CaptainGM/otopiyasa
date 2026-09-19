import { FilterQuery, SortOrder } from "mongoose";
import { CarFilters } from "@/types";
import { turkishSearchRegex } from "@/lib/utils";
import { Car } from "@/models/Car";
import { isMixedSort, mixedSortStages, dailyMixSeed } from "@/lib/car-mix";
import { PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";
import { LIST_IMAGE_LIMIT } from "@/lib/serialize-car";
import { cached, CACHE_TTL } from "@/lib/cache";

export function buildCarQuery(filters: CarFilters): FilterQuery<unknown> {
  
  const query: FilterQuery<unknown> = { ...PUBLIC_LISTING_FILTER };

  if (filters.q?.trim()) {
    
    const search = turkishSearchRegex(filters.q.trim());
    query.$or = [
      { title: { $regex: search, $options: "i" } },
      { brand: { $regex: search, $options: "i" } },
      { model: { $regex: search, $options: "i" } },
      { city: { $regex: search, $options: "i" } },
    ];
  }

  if (filters.brand) query.brand = filters.brand;
  if (filters.model) query.model = filters.model;
  if (filters.city) query.city = filters.city;

  
  if (filters.color) {
    const c = turkishSearchRegex(filters.color);
    (query.$and ||= []).push({
      $or: [
        { title: { $regex: c, $options: "i" } },
        { description: { $regex: c, $options: "i" } },
      ],
    });
  }
  if (filters.fuelType) query["features.fuelType"] = filters.fuelType;
  if (filters.transmission) query["features.transmission"] = filters.transmission;

  if (filters.yearMin || filters.yearMax) {
    query.year = {};
    if (filters.yearMin) query.year.$gte = filters.yearMin;
    if (filters.yearMax) query.year.$lte = filters.yearMax;
  }

  if (filters.priceMin || filters.priceMax) {
    query.price = {};
    if (filters.priceMin) query.price.$gte = filters.priceMin;
    if (filters.priceMax) query.price.$lte = filters.priceMax;
  }

  if (filters.discountOnly) {
    (query.$and ||= []).push({
      $expr: {
        $and: [
          { $gt: [{ $size: { $ifNull: ["$priceHistory", []] } }, 1] },
          { $gt: [{ $arrayElemAt: ["$priceHistory.price", 0] }, "$price"] },
        ],
      },
    });
  }

  return query;
}

export function buildCarSort(sort?: CarFilters["sort"]): Record<string, SortOrder> {
  switch (sort) {
    case "price_asc":
      return { price: 1 as SortOrder };
    case "price_desc":
      return { price: -1 as SortOrder };
    case "year_desc":
      return { year: -1 as SortOrder };
    case "views":
     
      return { viewCount: -1 as SortOrder };
    case "newest":
    default:
      return { createdAt: -1 as SortOrder };
  }
}


export async function findCarsPage(
  filters: CarFilters
): Promise<{ docs: unknown[]; total: number; page: number; limit: number }> {
  // Varsayılan ana sayfa (filtre/arama yok, 1. sayfa): her yenilemede dinamik/farklı ilanlar göstersin
  const isDefaultHome =
    !filters.q &&
    !filters.brand &&
    !filters.model &&
    !filters.city &&
    !filters.color &&
    !filters.yearMin &&
    !filters.yearMax &&
    !filters.priceMin &&
    !filters.priceMax &&
    !filters.fuelType &&
    !filters.transmission &&
    !filters.discountOnly &&
    (!filters.sort || filters.sort === "mixed") &&
    (filters.page || 1) === 1;

  if (isDefaultHome) {
    return findCarsPageUncached(filters, true);
  }

  const seed = isMixedSort(filters.sort) ? dailyMixSeed() : "";
  const key = `cars:${JSON.stringify(filters)}:${seed}`;
  return cached(key, CACHE_TTL.short, () => findCarsPageUncached(filters));
}

async function findCarsPageUncached(
  filters: CarFilters,
  randomize = false
): Promise<{ docs: unknown[]; total: number; page: number; limit: number }> {
  const query = buildCarQuery(filters);
  const page = filters.page || 1;
  const limit = filters.limit || 12;

  if (randomize) {
    // $sample ile her sayfa yenilemede gerçekten farklı ilanlar gelir.
    // Eski yöntem (random skip + createdAt sort) hep aynı kümeye düşüyordu.
    const [docs, total] = await Promise.all([
      Car.aggregate([
        { $match: query },
        { $sample: { size: limit } },
        { $addFields: { images: { $slice: ["$images", LIST_IMAGE_LIMIT] } } },
      ]),
      Car.countDocuments(query),
    ]);
    return { docs: docs as unknown[], total, page, limit };
  }

  const skip = (page - 1) * limit;

  if (isMixedSort(filters.sort)) {
    const [docs, total] = await Promise.all([
      Car.aggregate([
        { $match: query },

        
        { $project: { brand: 1, model: 1, price: 1, mileage: 1 } },

        ...mixedSortStages(dailyMixSeed()),
        { $skip: skip },
        { $limit: limit },

       
        {
          $lookup: {
            from: "cars",
            localField: "_id",
            foreignField: "_id",
            as: "_full",
            pipeline: [{ $addFields: { images: { $slice: ["$images", LIST_IMAGE_LIMIT] } } }],
          },
        },
        { $replaceRoot: { newRoot: { $first: "$_full" } } },
      ]).option({ allowDiskUse: true }),
      Car.countDocuments(query),
    ]);
    return { docs, total, page, limit };
  }

  const [docs, total] = await Promise.all([
    Car.find(query)
      .sort(buildCarSort(filters.sort))
      .skip(skip)
      .limit(limit)
      .slice("images", LIST_IMAGE_LIMIT)
      .lean(),
    Car.countDocuments(query),
  ]);
  return { docs: docs as unknown[], total, page, limit };
}


const MAX_PAGE_SIZE = 48;

const MAX_QUERY_LEN = 100;

export function parseCarFilters(searchParams: URLSearchParams): CarFilters {
  const num = (key: string) => {
    const value = searchParams.get(key);
    return value ? Number(value) : undefined;
  };

  
  const clampInt = (value: number | undefined, max: number, fallback: number) => {
    
    if (value === undefined || !Number.isFinite(value) || value < 1) return fallback;
    return Math.min(max, Math.trunc(value));
  };

  return {
    q: searchParams.get("q")?.slice(0, MAX_QUERY_LEN) || undefined,
    brand: searchParams.get("brand") || undefined,
    model: searchParams.get("model") || undefined,
    city: searchParams.get("city") || undefined,
    color: searchParams.get("color") || undefined,
    yearMin: num("yearMin"),
    yearMax: num("yearMax"),
    priceMin: num("priceMin"),
    priceMax: num("priceMax"),
    fuelType: searchParams.get("fuelType") || undefined,
    transmission: searchParams.get("transmission") || undefined,
    discountOnly: searchParams.get("discountOnly") === "true",
    
    sort: (searchParams.get("sort") as CarFilters["sort"]) || "mixed",
    page: clampInt(num("page"), 100_000, 1),
    limit: clampInt(num("limit"), MAX_PAGE_SIZE, 12),
  };
}
