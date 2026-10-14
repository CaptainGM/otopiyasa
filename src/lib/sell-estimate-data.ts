import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";
import { familyQuery } from "@/lib/comparables";
import { buildPriceScale, dedupeCandidates, type ScaleCar } from "@/lib/price-scale";
import { toScaleCar } from "@/lib/price-scale-data";
import { chooseSellEstimate, yearMileageWarnings, type SellDamage, type SellEstimate } from "@/lib/sell-estimate";

/** Aday sayısı üst sınırı; model ailesi ve yıl penceresi zaten dar tutar (price-scale-data ile aynı). */
const CANDIDATE_LIMIT = 1500;

export interface SellEstimateInput {
  brand: string;
  model: string;
  year: number;
  mileage: number;
  fuelType: string;
  transmission: string;
  engineSize: number | null;
  /** null: hasar bilinmiyor (eski istemci). Havuz karışık kalır ve düşük uç engeli uygulanmaz. */
  damage: SellDamage | null;
  /** Düzenlenen ilanın kimliği: kendi eski fiyatı emsal sayılmasın. */
  excludeId: string | null;
}

export interface SellEstimateResult {
  estimate: SellEstimate;
  /** Hasar bilgisi girildi mi (düşük uç engeli bu bilgiye bağlı). */
  damageKnown: boolean;
  warnings: string[];
}

/**
 * Satış formu için fiyat aralığı. Havuz, hasar durumuna göre ayrılır: hasarlı araç yalnızca hasarlı emsallerle, diğerleri yalnızca
 * hasarsız emsallerle kıyaslanır. Böylece tek bir hasarlı ilan hasarsız aralığı aşağı çekmez (tam tersi de geçerli).
 * Fiyat bu fonksiyona girmez: aralık yalnızca araç özelliklerine bağlıdır, fiyat kuralı çağıran tarafta uygulanır (priceGuard).
 */
export async function loadSellEstimate(input: SellEstimateInput): Promise<SellEstimateResult> {
  await connectDB();

  const damageFilter =
    input.damage === "hasarli" ? { damageFlag: true } : input.damage ? { damageFlag: { $ne: true } } : {};
  const excludeFilter =
    input.excludeId && Types.ObjectId.isValid(input.excludeId) ? { _id: { $ne: input.excludeId } } : {};

  const docs = (await Car.find({
    ...PUBLIC_LISTING_FILTER,
    ...familyQuery({ brand: input.brand, model: input.model }),
    year: { $gte: input.year - 3, $lte: input.year + 3 },
    ...damageFilter,
    ...excludeFilter,
  })
    .select("price year mileage damageFlag city model title features.engineSize features.fuelType features.transmission features.horsepower")
    .limit(CANDIDATE_LIMIT)
    .lean()) as unknown as Array<Parameters<typeof toScaleCar>[0]>;

  const subject: ScaleCar = {
    price: 0,
    year: input.year,
    mileage: input.mileage,
    damaged: input.damage === "hasarli",
    city: null,
    model: input.model,
    title: null,
    engineSize: input.engineSize,
    fuelType: input.fuelType,
    transmission: input.transmission,
    horsepower: null,
  };

  const candidates = dedupeCandidates(subject, docs.map(toScaleCar));
  const scale = buildPriceScale(subject, candidates);

  return {
    estimate: chooseSellEstimate(scale),
    damageKnown: input.damage !== null,
    warnings: yearMileageWarnings(input.year, input.mileage),
  };
}
