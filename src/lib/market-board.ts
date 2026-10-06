import { Car } from "@/models/Car";
import { PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";
import { cached, CACHE_TTL } from "@/lib/cache";
import { FAIR_BAND_PCT } from "@/lib/market-position";
import type { VehicleClass } from "@/lib/vehicle-scope";

/**
 * Ana sayfadaki "piyasa panosu": aktif ilan, son 24 saatte eklenen, piyasanın altındaki ilan sayısı, kaynak sayısı ve
 * araç tipi dağılımı. Herkes için aynı; sunucu belleğinde önbellekli (her ziyaret veritabanını saymasın).
 * "Piyasanın altında" kartlardaki göstergeyle aynı kural (bkz. market-position.ts): ortalamanın %6+ altı.
 */
export interface MarketBoard {
  total: number;
  addedLastDay: number;
  belowMarket: number;
  sources: number;
  classCounts: Partial<Record<VehicleClass, number>>;
}

export function getMarketBoard(): Promise<MarketBoard> {
  return cached("home:market-board", CACHE_TTL.medium, async () => {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const ratio = 1 - FAIR_BAND_PCT / 100;
    const [total, addedLastDay, belowMarket, sources, classRows] = await Promise.all([
      Car.countDocuments(PUBLIC_LISTING_FILTER),
      Car.countDocuments({ ...PUBLIC_LISTING_FILTER, createdAt: { $gte: dayAgo } }),
      Car.countDocuments({
        ...PUBLIC_LISTING_FILTER,
        "market.count": { $gte: 3 },
        $expr: { $lte: ["$price", { $multiply: ["$market.avg", ratio] }] },
      }),
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
    return { total, addedLastDay, belowMarket, sources, classCounts };
  });
}
