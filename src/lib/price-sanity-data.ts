import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";
import { familyQuery } from "@/lib/comparables";
import { judgePrice, type PriceSanity } from "@/lib/price-sanity";

/** Emsal sorgusunda en fazla bu kadar ilan okunur (model ailesi ve yıl penceresi zaten dar tutar). */
const CANDIDATE_LIMIT = 300;

/**
 * Bir fiyatın piyasa denetimi: aynı model ailesinin yayındaki ilanları (yıl ±2, kendi kimliği hariç). Fiyat sorgu anahtarında
 * yok; karşılaştırma yalnızca model ailesi ve yıla bağlıdır.
 */
export async function loadPriceSanity(input: {
  brand: string;
  model: string;
  year: number;
  price: number;
  excludeId?: unknown;
}): Promise<PriceSanity> {
  await connectDB();
  const docs = await Car.find({
    ...PUBLIC_LISTING_FILTER,
    ...familyQuery({ brand: input.brand, model: input.model }),
    year: { $gte: input.year - 2, $lte: input.year + 2 },
    ...(input.excludeId ? { _id: { $ne: input.excludeId } } : {}),
  })
    .select("price")
    .limit(CANDIDATE_LIMIT)
    .lean<Array<{ price: number }>>();
  return judgePrice(input.price, docs.map((doc) => doc.price));
}
