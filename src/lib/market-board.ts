import { Car } from "@/models/Car";
import { PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";
import { cached, CACHE_TTL } from "@/lib/cache";
import { SEGMENT_TARGET_SAMPLE, segmentFamilies } from "@/lib/market-price";
import type { VehicleClass } from "@/lib/vehicle-scope";

/**
 * Ana sayfadaki "piyasa panosu": aktif ilan, son 24 saatte eklenen, öne çıkan ilan sayısı, kaynak sayısı ve araç tipi
 * dağılımı. Herkes için aynı; sunucu belleğinde önbellekli (her ziyaret veritabanını saymasın).
 * Öne çıkan ilanlar tekrarsız birleşimdir: haftanın fırsatları (market.deal, bkz. market-fair.ts) ile her marka, model
 * ailesi ve yılın en düşük fiyatlı ilanı (en az SEGMENT_TARGET_SAMPLE emsalli segmentlerde).
 */
export interface MarketBoard {
  total: number;
  addedLastDay: number;
  featured: number;
  sources: number;
  classCounts: Partial<Record<VehicleClass, number>>;
}

/** Öne çıkan ilan sayısı. Segment gruplaması ve aykırı değer temizliği tarama hedefiyle aynıdır (bkz. segmentFamilies). */
async function countFeaturedListings(): Promise<number> {
  const groups = await Car.aggregate<{
    _id: { brand: string; model: string; year: number; vehicleClass: string };
    listings: Array<{ id: unknown; price: number }>;
  }>([
    {
      $match: {
        ...PUBLIC_LISTING_FILTER,
        brand: { $type: "string", $ne: "" },
        model: { $type: "string", $nin: ["", "Model", "Bilinmiyor"] },
        year: { $type: "number", $gte: 1900 },
      },
    },
    {
      $group: {
        _id: { brand: "$brand", model: "$model", year: "$year", vehicleClass: { $ifNull: ["$vehicleClass", "otomobil"] } },
        listings: { $push: { id: "$_id", price: "$price" } },
      },
    },
  ]).option({ allowDiskUse: true });

  const picks = new Set<string>();
  const families = segmentFamilies(
    groups.map((group) => ({ ...group._id, prices: (group.listings || []).map((listing) => listing.price), listings: group.listings || [] }))
  );
  for (const family of families) {
    if (family.listingCount >= SEGMENT_TARGET_SAMPLE && family.cheapestId !== undefined) picks.add(String(family.cheapestId));
  }
  const deals = await Car.find({ ...PUBLIC_LISTING_FILTER, "market.deal": true }, { _id: 1 }).lean<Array<{ _id: unknown }>>();
  for (const deal of deals) picks.add(String(deal._id));
  return picks.size;
}

export function getMarketBoard(): Promise<MarketBoard> {
  // Öne çıkan sayımı yaklaşık 2 sn sürer; ana sayfada her önbellek kaçırmada tekrarlanmasın diye 15 dk tutulur.
  return cached("home:market-board", CACHE_TTL.long, async () => {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [total, addedLastDay, featured, sources, classRows] = await Promise.all([
      Car.countDocuments(PUBLIC_LISTING_FILTER),
      Car.countDocuments({ ...PUBLIC_LISTING_FILTER, createdAt: { $gte: dayAgo } }),
      countFeaturedListings(),
      Car.distinct("sourceSite", PUBLIC_LISTING_FILTER).then((list) => list.filter((s) => s && s !== "demo").length),
      Car.aggregate<{ _id: string | null; n: number }>([
        { $match: PUBLIC_LISTING_FILTER },
        { $group: { _id: "$vehicleClass", n: { $sum: 1 } } },
      ]),
    ]);
    const classCounts: Partial<Record<VehicleClass, number>> = {};
    for (const row of classRows) {
      // Sınıfı yazılmamış eski kayıtlar otomobil sayılır (bkz. car-query.ts vehicleClass filtresi).
      const key = (row._id || "otomobil") as VehicleClass;
      classCounts[key] = (classCounts[key] ?? 0) + row.n;
    }
    return { total, addedLastDay, featured, sources, classCounts };
  });
}
