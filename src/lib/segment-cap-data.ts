import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";
import { modelFamilyRegex } from "@/lib/model-family";
import { turkishSearchRegex } from "@/lib/utils";
import { SEGMENT_MIN_FAMILY, segmentCapFrom, type SegmentCap } from "@/lib/segment-cap";

const TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { at: number; value: SegmentCap | null }>();

/**
 * İlanın segment tavanı (önbellekli, saatte bir yenilenir). Yeni ilan verme ve tarama kayıtları bu tavanı kullanır.
 * Yayındaki (bayraksız) ilanlardan hesaplanır; yeterli veri yoksa null.
 */
export async function loadSegmentCap(brand: string, model: string): Promise<SegmentCap | null> {
  const key = `${brand.toLocaleLowerCase("tr-TR")}|${model.toLocaleLowerCase("tr-TR")}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  await connectDB();
  const brandMatch = { $regex: `^${turkishSearchRegex(brand)}$`, $options: "i" };
  const familyPrices = (
    await Car.find({ ...PUBLIC_LISTING_FILTER, brand: brandMatch, model: modelFamilyRegex(model, brand) })
      .select("price")
      .limit(5000)
      .lean<{ price: number }[]>()
  ).map((d) => d.price);
  const brandPrices =
    familyPrices.length >= SEGMENT_MIN_FAMILY
      ? []
      : (await Car.find({ ...PUBLIC_LISTING_FILTER, brand: brandMatch }).select("price").limit(20000).lean<{ price: number }[]>()).map(
          (d) => d.price
        );

  const value = segmentCapFrom(familyPrices, brandPrices);
  cache.set(key, { at: Date.now(), value });
  return value;
}
