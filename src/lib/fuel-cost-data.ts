import { Car } from "@/models/Car";
import { cached, CACHE_TTL } from "@/lib/cache";
import { PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";
import { getFuelPrices } from "@/lib/fuel-prices";
import { buildConsumptionStats, computeFuelCost, parseConsumption, type ConsumptionStats, type FuelCost, type FuelCostInput } from "@/lib/fuel-cost";

/** Önceden hesaplanmış medyanların kayıt adı; hesaplama değişince sürüm artırılır (eski kayıt okunmaz). */
const SNAPSHOT_NAME = "fuel:consumption-stats:v7";
/** Kayıt bundan eskiyse (motor günlerdir çalışmıyor) istek sırasında yeniden hesaplanır. */
const SNAPSHOT_MAX_STALE_MS = 48 * 60 * 60 * 1000;

/** Resmi tüketim değeri olan tüm ilanlardan model ve sınıf medyanları. Soğuk durumda ~5 sn: sayfa açılışında değil, motorda çalışır. */
async function computeConsumptionStats(): Promise<ConsumptionStats> {
  const docs = await Car.find({
    ...PUBLIC_LISTING_FILTER,
    "features.avgFuelConsumption": { $nin: [null, ""] },
    "features.avgFuelConsumptionSource": { $ne: "model-median" },
  })
    .select("brand model title features.fuelType features.bodyType features.engineSize features.horsepower features.avgFuelConsumption")
    .lean<Array<{ brand?: string; model?: string; title?: string; features?: { fuelType?: string; bodyType?: string; engineSize?: number; horsepower?: number; avgFuelConsumption?: string } }>>();
  return buildConsumptionStats(
    docs
      .map((d) => ({
        brand: d.brand,
        model: d.model,
        title: d.title,
        fuelType: d.features?.fuelType,
        bodyType: d.features?.bodyType,
        engineSize: d.features?.engineSize,
        horsepower: d.features?.horsepower,
        consumption: parseConsumption(d.features?.avgFuelConsumption) ?? NaN,
      }))
      .filter((s) => Number.isFinite(s.consumption))
  );
}

/** Medyanları hesaplayıp kaydeder. Motor saatte bir çağırır; kayıt hiç yoksa ilk istek de çağırır. */
export async function refreshConsumptionStats(): Promise<{ stats: ConsumptionStats; ms: number; bytes: number }> {
  const startedAt = Date.now();
  const stats = await computeConsumptionStats();
  const json = JSON.stringify(stats);
  const { StatSnapshot } = await import("@/models/StatSnapshot");
  await StatSnapshot.updateOne({ name: SNAPSHOT_NAME }, { $set: { json, computedAt: new Date() } }, { upsert: true });
  return { stats, ms: Date.now() - startedAt, bytes: json.length };
}

/** Kayıt tazeyse dokunmaz (ucuz bir okuma); eskiyse ya da yoksa yeniden hesaplar. Yenilenmediyse null döner. */
export async function refreshConsumptionStatsIfStale(maxAgeMs: number): Promise<{ models: number; ms: number; bytes: number } | null> {
  const { StatSnapshot } = await import("@/models/StatSnapshot");
  const existing = await StatSnapshot.findOne({ name: SNAPSHOT_NAME }).select("computedAt").lean<{ computedAt: Date } | null>();
  if (existing && Date.now() - new Date(existing.computedAt).getTime() < maxAgeMs) return null;
  const { stats, ms, bytes } = await refreshConsumptionStats();
  return { models: Object.keys(stats.model).length, ms, bytes };
}

/** Model ve sınıf medyanları: kayıttan okunur (15 dk bellekte); yeni sunucu örneği tüm ilanları baştan taramaz. */
export function getConsumptionStats(): Promise<ConsumptionStats> {
  return cached(SNAPSHOT_NAME, CACHE_TTL.long, async () => {
    const { StatSnapshot } = await import("@/models/StatSnapshot");
    const doc = await StatSnapshot.findOne({ name: SNAPSHOT_NAME }).lean<{ json: string; computedAt: Date } | null>();
    if (doc && Date.now() - new Date(doc.computedAt).getTime() < SNAPSHOT_MAX_STALE_MS) {
      try {
        return JSON.parse(doc.json) as ConsumptionStats;
      } catch {
        // bozuk kayıt: aşağıda yeniden hesaplanır
      }
    }
    return (await refreshConsumptionStats()).stats;
  });
}

/** Bir ilan için yakıt maliyeti; fiyat ya da tüketim bilinmiyorsa null. */
export async function getFuelCostForCar(car: FuelCostInput): Promise<FuelCost | null> {
  const [prices, stats] = await Promise.all([getFuelPrices(), getConsumptionStats()]);
  if (!prices) return null;
  return computeFuelCost(car, prices, stats);
}
