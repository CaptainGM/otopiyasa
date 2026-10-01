import { Car } from "@/models/Car";
import { cached, CACHE_TTL } from "@/lib/cache";
import { PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";
import { getFuelPrices } from "@/lib/fuel-prices";
import { buildConsumptionStats, computeFuelCost, parseConsumption, type ConsumptionStats, type FuelCost, type FuelCostInput } from "@/lib/fuel-cost";

/** Resmi tüketim değeri olan ilanlardan model ve sınıf medyanları (15 dk önbellekte). */
export function getConsumptionStats(): Promise<ConsumptionStats> {
  return cached("fuel:consumption-stats:v6", CACHE_TTL.long, async () => {
    const docs = await Car.find({ ...PUBLIC_LISTING_FILTER, "features.avgFuelConsumption": { $nin: [null, ""] } })
      .select("brand model title features.fuelType features.bodyType features.engineSize features.avgFuelConsumption")
      .lean<Array<{ brand?: string; model?: string; title?: string; features?: { fuelType?: string; bodyType?: string; engineSize?: number; avgFuelConsumption?: string } }>>();
    return buildConsumptionStats(
      docs
        .map((d) => ({
          brand: d.brand,
          model: d.model,
          title: d.title,
          fuelType: d.features?.fuelType,
          bodyType: d.features?.bodyType,
          engineSize: d.features?.engineSize,
          consumption: parseConsumption(d.features?.avgFuelConsumption) ?? NaN,
        }))
        .filter((s) => Number.isFinite(s.consumption))
    );
  });
}

/** Bir ilan için yakıt maliyeti; fiyat ya da tüketim bilinmiyorsa null. */
export async function getFuelCostForCar(car: FuelCostInput): Promise<FuelCost | null> {
  const [prices, stats] = await Promise.all([getFuelPrices(), getConsumptionStats()]);
  if (!prices) return null;
  return computeFuelCost(car, prices, stats);
}
