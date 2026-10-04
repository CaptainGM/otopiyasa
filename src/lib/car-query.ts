import { FilterQuery, SortOrder } from "mongoose";
import { CarFilters } from "@/types";
import { turkishSearchRegex } from "@/lib/utils";
import { Car } from "@/models/Car";
import { normalizeFuelType } from "@/lib/normalize-fuel";
import { isMixedSort, resolveFeedSeed, seedToStart } from "@/lib/car-mix";
import { PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";
import { LIST_IMAGE_LIMIT } from "@/lib/serialize-car";
import { cached, CACHE_TTL } from "@/lib/cache";
import { brandStorageAliases } from "@/lib/normalize-brand";
import { cityStorageAliases } from "@/lib/normalize-city";
import { modelFamilyRegex } from "@/lib/model-family";
import { normalizeColor } from "@/lib/normalize-color";

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

  if (filters.brand) {
    query.brand = {
      $in: brandStorageAliases(filters.brand).map((brand) =>
        new RegExp(`^${turkishSearchRegex(brand)}$`, "i")
      ),
    };
  }
  // Model ailesi: "Juke" seçilince "JUKE" ve "Juke 1.0 DIG-T Platinum" de gelir (bkz. model-family.ts).
  if (filters.model) query.model = modelFamilyRegex(filters.model, filters.brand);
  if (filters.city) query.city = { $in: cityStorageAliases(filters.city) };

  
  if (filters.color) {
    query["features.color"] = {
      $regex: `^${turkishSearchRegex(normalizeColor(filters.color))}$`,
      $options: "i",
    };
  }
  // Mobil "LPG" gönderiyor, kayıtlar "LPG & Benzin"; ikisi de aynı yazıma çevrilir.
  if (filters.fuelType) query["features.fuelType"] = normalizeFuelType(filters.fuelType);
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
  // Varsayılan ana akışta tüm sayfalar aynı güncel sıralamayı kullanmalı;
  // ilk sayfa ile devam sayfalarını farklı sıralamak ilan tekrarına yol açar.
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
    (!filters.sort || filters.sort === "mixed");

  // Rastgele akış her tohumda farklıdır; önbelleğe alınırsa kayıtlar boşuna birikir ve herkes
  // aynı sırayı görürdü. Sorgu zaten indeksli ve milisaniyeler sürüyor.
  if (isDefaultHome || (isMixedSort(filters.sort) && !filters.q?.trim())) {
    return findCarsPageUncached(filters);
  }

  const key = `cars:${JSON.stringify(filters)}`;
  return cached(key, CACHE_TTL.short, () => findCarsPageUncached(filters));
}

async function findCarsPageUncached(
  filters: CarFilters
): Promise<{ docs: unknown[]; total: number; page: number; limit: number }> {
  const query = buildCarQuery(filters);
  const page = filters.page || 1;
  const limit = filters.limit || 12;
  const skip = (page - 1) * limit;

  // 0. KEŞFET akışı (varsayılan): herkese ve her yenilemeye farklı, sayfalar arası tutarlı.
  // Her ilanda kalıcı bir rastgele sayı (rand) var; tohumdan bir başlangıç noktası seçilir ve
  // {status, rand} indeksi üzerinden o noktadan itibaren sıralanır. Eski çözümler: sabit "en yeni"
  // (hep aynı kaynağın ilanları peş peşe geliyordu) ve tüm koleksiyonu pencere fonksiyonuyla
  // sıralayan karma (~1 sn; ayrıca 30 dakikada bir değişen ortak tohum).
  // Arama metni varsa alaka sırası korunur (aşağıdaki arama yolu).
  if (isMixedSort(filters.sort) && !filters.q?.trim()) {
    const start = seedToStart(resolveFeedSeed(filters.seed));
    const [docs, total] = await Promise.all([
      Car.find({ ...query, rand: { $gte: start } })
        .sort({ rand: 1 as const })
        .skip(skip)
        .limit(limit)
        .slice("images", LIST_IMAGE_LIMIT)
        .lean(),
      Car.countDocuments({ ...query, rand: { $gte: start } }),
    ]);
    return { docs: docs as unknown[], total, page, limit };
  }

  // 1. MongoDB Atlas Search (Lucene Engine):
  // Typo-tolerance (volksvagen -> Volkswagen), kelime kökü analizi ve alaka düzeyi (relevance)
  if (filters.q?.trim()) {
    try {
      const searchTerm = filters.q.trim();
      const filtersWithoutQ = { ...filters, q: undefined };
      const matchFilter = buildCarQuery(filtersWithoutQ);

      const pipeline: any[] = [
        {
          $search: {
            index: "default",
            text: {
              query: searchTerm,
              path: ["title", "brand", "model", "city"],
              fuzzy: { maxEdits: 1, prefixLength: 1 },
            },
          },
        },
        { $match: matchFilter },
      ];

      // Kullanıcı belirli bir sıralama seçtiyse uygula (seçmediyse Lucene alaka puanına göre sıralanır)
      if (filters.sort && filters.sort !== "mixed") {
        pipeline.push({ $sort: buildCarSort(filters.sort) });
      }

      pipeline.push({
        $facet: {
          docs: [
            { $skip: skip },
            { $limit: limit },
            { $addFields: { images: { $slice: ["$images", LIST_IMAGE_LIMIT] } } },
          ],
          totalCount: [{ $count: "count" }],
        },
      });

      const [facetResult] = await Car.aggregate(pipeline);
      const docs = facetResult?.docs || [];
      const total = facetResult?.totalCount?.[0]?.count || 0;
      return { docs, total, page, limit };
    } catch {
      // Atlas Search desteklenmiyorsa (örn. yerel mock testler) standart $regex aramasına devam eder
    }
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
    seed: clampInt(num("seed"), 2_147_483_647, 0) || undefined,
    page: clampInt(num("page"), 100_000, 1),
    limit: clampInt(num("limit"), MAX_PAGE_SIZE, MAX_PAGE_SIZE),
  };
}
