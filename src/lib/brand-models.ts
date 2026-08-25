import { Car } from "@/models/Car";
import { isNonCarBrand } from "@/lib/normalize-brand";
import { cached, CACHE_TTL } from "@/lib/cache";

export interface BrandModelOptions {
  brands: string[];
  brandModels: Record<string, string[]>;
}

/** Web'deki marka+model filtresi ve mobil `/api/filters/brand-models` uç noktası ortak kaynağı kullansın diye çıkarıldı. */
export async function getBrandModelOptions(): Promise<BrandModelOptions> {
  return cached("filters:brandModels", CACHE_TTL.medium, async () => {
    const rows = await Car.aggregate<{ _id: string; models: string[] }>([
      { $match: { model: { $exists: true, $ne: "" } } },
      { $group: { _id: "$brand", models: { $addToSet: "$model" } } },
    ]);
    const brandModels: Record<string, string[]> = {};
    for (const row of rows) {
      if (!row._id || isNonCarBrand(row._id)) continue;
      brandModels[row._id] = row.models.filter(Boolean).sort((a, b) => a.localeCompare(b, "tr"));
    }
    const brands = Object.keys(brandModels).sort((a, b) => a.localeCompare(b, "tr"));
    return { brands, brandModels };
  });
}
