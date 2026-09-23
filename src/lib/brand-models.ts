import { Car } from "@/models/Car";
import { isNonCarBrand, normalizeBrand } from "@/lib/normalize-brand";
import { cached, CACHE_TTL } from "@/lib/cache";
import { connectDB } from "@/lib/mongodb";
import { PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";

export interface BrandModelOptions {
  brands: string[];
  brandModels: Record<string, string[]>;
}

/** Web'deki marka+model filtresi ve mobil `/api/filters/brand-models` uç noktası ortak kaynağı kullansın diye çıkarıldı. */
export async function getBrandModelOptions(): Promise<BrandModelOptions> {
  return cached("filters:brandModels", CACHE_TTL.long, async () => {
    await connectDB();
    const rows = await Car.aggregate<{ _id: string; models: string[] }>([
      { $match: { ...PUBLIC_LISTING_FILTER, model: { $exists: true, $ne: "" } } },
      { $group: { _id: "$brand", models: { $addToSet: "$model" } } },
    ]);
    const brandModels: Record<string, string[]> = {};
    for (const row of rows) {
      if (!row._id || isNonCarBrand(row._id)) continue;
      const brand = normalizeBrand(row._id);
      if (!brandModels[brand]) {
        brandModels[brand] = [];
      }
      for (const m of row.models) {
        if (m && !brandModels[brand].includes(m)) {
          brandModels[brand].push(m);
        }
      }
    }
    for (const b of Object.keys(brandModels)) {
      brandModels[b].sort((a, b) => a.localeCompare(b, "tr"));
    }
    const brands = Object.keys(brandModels).sort((a, b) => a.localeCompare(b, "tr"));
    return { brands, brandModels };
  });
}
