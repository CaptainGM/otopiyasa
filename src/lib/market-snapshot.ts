import { Car } from "@/models/Car";
import { MARKET_LISTING_FILTER, PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";
import { findMarketOutlierPrices, marketStatsFromRows, segmentKey } from "@/lib/market-price";
import { modelFamilyKey } from "@/lib/model-family";

/**
 * PİYASA ANLIK GÖRÜNTÜSÜ: her ilanın kendi segmentindeki piyasa ortalaması ilanın üstüne yazılır (`market`).
 * İlan kartlarındaki "ucuz / adil / pahalı" göstergesi bunu okur; böylece liste sayfaları her istekte piyasa
 * hesabı yapmaz (Vercel işlemci süresi ve veritabanı yükü). Oracle sunucusundaki daemon saatte bir yeniler.
 * İlan sayfası ve karşılaştırma yine anlık hesaplar (bkz. market-price.ts getMarketMap).
 */

/** Ortalama bu oranın altında değiştiyse yazılmaz (her saat binlerce gereksiz yazma olmasın). */
const MIN_RELATIVE_CHANGE = 0.005;

type StoredMarket = { avg?: number; count?: number; scope?: string; outlier?: boolean } | null | undefined;

export function marketSnapshotChanged(stored: StoredMarket, next: { avg: number; count: number; scope?: string; outlier?: boolean } | null): boolean {
  if (!next) return (!!stored && (stored.avg ?? 0) > 0) || stored?.outlier === true;
  if (!stored) return next.avg > 0 || next.outlier === true;
  if (((stored.avg ?? 0) > 0) !== (next.avg > 0)) return true;
  if (stored.count !== next.count || stored.scope !== next.scope || (stored.outlier === true) !== (next.outlier === true)) return true;
  return next.avg > 0 && Math.abs(next.avg - (stored.avg ?? 0)) / (stored.avg ?? 1) >= MIN_RELATIVE_CHANGE;
}

export async function refreshMarketSnapshot(): Promise<{ segments: number; scanned: number; updated: number; cleared: number; outliers: number }> {
  const rows = await Car.aggregate<{ _id: { brand: string; model: string; year: number; vehicleClass: string }; prices: number[] }>([
    { $match: { ...MARKET_LISTING_FILTER, price: { $gt: 0 } } },
    {
      $group: {
        _id: { brand: "$brand", model: "$model", year: "$year", vehicleClass: { $ifNull: ["$vehicleClass", "otomobil"] } },
        prices: { $push: "$price" },
      },
    },
  ]).allowDiskUse(true);

  const requested = rows
    .filter((r) => r._id.brand && r._id.model && r._id.year)
    .map((r) => ({ key: segmentKey(r._id.brand, r._id.model, r._id.year, r._id.vehicleClass), ...r._id }));
  const stats = marketStatsFromRows(rows, requested);

  // Aykırı fiyat kıyasını donanım adına değil, aynı marka/model ailesi/yıl/araç tipine göre yap.
  const familyPrices = new Map<string, number[]>();
  for (const row of rows) {
    const family = modelFamilyKey(row._id.model, row._id.brand) || row._id.model;
    const key = `${row._id.brand}::${row._id.vehicleClass}::${family}::${row._id.year}`;
    const prices = familyPrices.get(key);
    if (prices) prices.push(...(row.prices || []));
    else familyPrices.set(key, [...(row.prices || [])]);
  }
  const outliersByFamily = new Map([...familyPrices].map(([key, prices]) => [key, findMarketOutlierPrices(prices)]));

  const at = new Date();
  let scanned = 0;
  let updated = 0;
  let cleared = 0;
  let outliers = 0;
  let ops: Parameters<typeof Car.bulkWrite>[0] = [];
  const flush = async () => {
    if (ops.length === 0) return;
    await Car.bulkWrite(ops, { ordered: false });
    ops = [];
  };

  const cursor = Car.find(PUBLIC_LISTING_FILTER)
    .select("brand model year price vehicleClass market")
    .lean<{ _id: unknown; brand: string; model: string; year: number; price: number; vehicleClass?: string; market?: StoredMarket }>()
    .cursor({ batchSize: 2000 });
  for await (const car of cursor) {
    scanned++;
    const vehicleClass = car.vehicleClass || "otomobil";
    const stat = stats.get(segmentKey(car.brand, car.model, car.year, vehicleClass));
    const family = modelFamilyKey(car.model, car.brand) || car.model;
    const familyKey = `${car.brand}::${vehicleClass}::${family}::${car.year}`;
    const isOutlier = outliersByFamily.get(familyKey)?.has(car.price) ?? false;
    if (isOutlier) outliers++;
    const next = stat && stat.avgPrice > 0
      ? { avg: Math.round(stat.avgPrice), count: stat.listingCount, scope: stat.scope ?? "model", outlier: isOutlier }
      : { avg: 0, count: 0, scope: "model", outlier: isOutlier };
    if (!marketSnapshotChanged(car.market, next)) continue;
    if (next.avg > 0) {
      ops.push({ updateOne: { filter: { _id: car._id }, update: { $set: { "market.avg": next.avg, "market.count": next.count, "market.scope": next.scope, "market.at": at, "market.outlier": next.outlier, "market.outlierAt": at } }, timestamps: false } });
      updated++;
    } else {
      ops.push({ updateOne: { filter: { _id: car._id }, update: { $set: { "market.outlier": next.outlier, "market.outlierAt": at }, $unset: { "market.avg": 1, "market.count": 1, "market.scope": 1, "market.at": 1 } }, timestamps: false } });
      cleared++;
    }
    if (ops.length >= 1000) await flush();
  }
  await flush();
  return { segments: requested.length, scanned, updated, cleared, outliers };
}
