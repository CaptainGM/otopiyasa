import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";
import { familyQuery } from "@/lib/comparables";
import { buildPriceScale, type PriceScale, type ScaleCar } from "@/lib/price-scale";

/** Bir kademe için en fazla bu kadar aday okunur; model ailesi ve yıl penceresi zaten dar tutar. */
const CANDIDATE_LIMIT = 1500;

/** Veritabanı belgesini fiyat skalasının girdisine çevirir (hasar bayrağı, donanım alanları). */
export function toScaleCar(doc: {
  price: number;
  year: number;
  mileage?: number;
  damageFlag?: boolean;
  features?: { engineSize?: number | null; fuelType?: string | null; transmission?: string | null; horsepower?: number | null };
}): ScaleCar {
  return {
    price: doc.price,
    year: doc.year,
    mileage: doc.mileage ?? 0,
    damaged: doc.damageFlag === true,
    engineSize: doc.features?.engineSize ?? null,
    fuelType: doc.features?.fuelType ?? null,
    transmission: doc.features?.transmission ?? null,
    horsepower: doc.features?.horsepower ?? null,
  };
}

/**
 * İlanın fiyat skalası. Emsaller yalnızca yayındaki ilanlardan (PUBLIC_LISTING_FILTER: bayraklı fiyatlar dâhil değil) ve aynı
 * model ailesinden (familyQuery, emsal kuralının tek yeri) ±3 yıl içinde seçilir. İlan yoksa ya da yayında değilse null.
 */
export async function loadPriceScale(carId: string): Promise<PriceScale | null> {
  await connectDB();
  const subject = (await Car.findOne({ _id: carId, ...PUBLIC_LISTING_FILTER })
    .select("brand model year mileage price vehicleClass damageFlag features")
    .lean()) as Parameters<typeof toScaleCar>[0] & { _id: unknown; brand: string; model: string; vehicleClass?: string };
  if (!subject) return null;

  const candidates = (await Car.find({
    ...PUBLIC_LISTING_FILTER,
    ...familyQuery({ brand: subject.brand, model: subject.model, vehicleClass: subject.vehicleClass }),
    _id: { $ne: subject._id },
    year: { $gte: subject.year - 3, $lte: subject.year + 3 },
  })
    .select("price year mileage damageFlag features.engineSize features.fuelType features.transmission features.horsepower")
    .limit(CANDIDATE_LIMIT)
    .lean()) as Array<Parameters<typeof toScaleCar>[0]>;

  return buildPriceScale(toScaleCar(subject), candidates.map(toScaleCar));
}
