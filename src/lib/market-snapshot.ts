import { Car } from "@/models/Car";
import { PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";
import { marketStatsFromRows, segmentKey } from "@/lib/market-price";

/**
 * PİYASA ANLIK GÖRÜNTÜSÜ: her ilanın kendi segmentindeki piyasa ortalaması ilanın üstüne yazılır (`market`).
 * İlan kartlarındaki "ucuz / adil / pahalı" göstergesi bunu okur; böylece liste sayfaları her istekte piyasa
 * hesabı yapmaz (Vercel işlemci süresi ve veritabanı yükü). Oracle sunucusundaki daemon saatte bir yeniler.
 * İlan sayfası ve karşılaştırma yine anlık hesaplar (bkz. market-price.ts getMarketMap).
 */

/** Ortalama bu oranın altında değiştiyse yazılmaz (her saat binlerce gereksiz yazma olmasın). */
const MIN_RELATIVE_CHANGE = 0.005;

type StoredMarket = { avg?: number; count?: number; scope?: string } | null | undefined;

export function marketSnapshotChanged(stored: StoredMarket, next: { avg: number; count: number; scope?: string } | null): boolean {
  if (!next) return !!stored && (stored.avg ?? 0) > 0;
  if (!stored || !stored.avg) return true;
  if (stored.count !== next.count || stored.scope !== next.scope) return true;
  return Math.abs(next.avg - stored.avg) / stored.avg >= MIN_RELATIVE_CHANGE;
}

export async function refreshMarketSnapshot(): Promise<{ segments: number; scanned: number; updated: number; cleared: number }> {
  const rows = await Car.aggregate<{ _id: { brand: string; model: string; year: number }; prices: number[] }>([
    { $match: { ...PUBLIC_LISTING_FILTER, price: { $gt: 0 } } },
    { $group: { _id: { brand: "$brand", model: "$model", year: "$year" }, prices: { $push: "$price" } } },
  ]).allowDiskUse(true);

  const requested = rows
    .filter((r) => r._id.brand && r._id.model && r._id.year)
    .map((r) => ({ key: segmentKey(r._id.brand, r._id.model, r._id.year), ...r._id }));
  const stats = marketStatsFromRows(rows, requested);

  const at = new Date();
  let scanned = 0;
  let updated = 0;
  let cleared = 0;
  let ops: Parameters<typeof Car.bulkWrite>[0] = [];
  const flush = async () => {
    if (ops.length === 0) return;
    await Car.bulkWrite(ops, { ordered: false });
    ops = [];
  };

  const cursor = Car.find(PUBLIC_LISTING_FILTER)
    .select("brand model year market")
    .lean<{ _id: unknown; brand: string; model: string; year: number; market?: StoredMarket }>()
    .cursor({ batchSize: 2000 });
  for await (const car of cursor) {
    scanned++;
    const stat = stats.get(segmentKey(car.brand, car.model, car.year));
    const next =
      stat && stat.avgPrice > 0 ? { avg: Math.round(stat.avgPrice), count: stat.listingCount, scope: stat.scope ?? "model" } : null;
    if (!marketSnapshotChanged(car.market, next)) continue;
    if (next) {
      ops.push({ updateOne: { filter: { _id: car._id }, update: { $set: { "market.avg": next.avg, "market.count": next.count, "market.scope": next.scope, "market.at": at } }, timestamps: false } });
      updated++;
    } else {
      ops.push({ updateOne: { filter: { _id: car._id }, update: { $unset: { "market.avg": 1, "market.count": 1, "market.scope": 1, "market.at": 1 } }, timestamps: false } });
      cleared++;
    }
    if (ops.length >= 1000) await flush();
  }
  await flush();
  return { segments: requested.length, scanned, updated, cleared };
}
