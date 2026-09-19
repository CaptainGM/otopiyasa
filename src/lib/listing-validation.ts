

export interface ListingInput {
  brand?: string;
  model?: string;
  year?: number;
  price?: number;
  mileage?: number;
  city?: string;
  description?: string;
  contactPhone?: string;
}


export const ABSOLUTE_PRICE_FLOOR = 20_000;

export const RELATIVE_PRICE_FLOOR_RATIO = 0.4;
const CURRENT_YEAR = new Date().getFullYear();

export interface FieldCheck {
  valid: boolean;
  errors: string[];
}


export function validateListingFields(input: ListingInput): FieldCheck {
  const errors: string[] = [];
  const add = (m: string) => errors.push(m);

  if (!input.brand?.trim()) add("Marka zorunludur.");
  if (!input.model?.trim()) add("Model zorunludur.");

  if (!Number.isFinite(input.year)) add("Yıl zorunludur.");
  else if (input.year! < 1950 || input.year! > CURRENT_YEAR + 1)
    add(`Yıl 1950 ile ${CURRENT_YEAR + 1} arasında olmalıdır.`);

  if (!Number.isFinite(input.price)) add("Fiyat zorunludur.");
  else if (input.price! <= 0) add("Fiyat geçerli bir sayı olmalıdır.");

  if (!Number.isFinite(input.mileage)) add("Kilometre zorunludur.");
  else if (input.mileage! < 0 || input.mileage! > 2_000_000)
    add("Kilometre geçerli bir aralıkta olmalıdır.");

  if (!input.city?.trim()) add("Şehir zorunludur.");

  if (!input.contactPhone?.trim()) add("İletişim telefonu zorunludur.");
  else if (!/^[\d\s()+-]{7,20}$/.test(input.contactPhone.trim()))
    add("Telefon numarası geçerli değil.");

  if ((input.description?.length ?? 0) > 5000)
    add("Açıklama çok uzun (en fazla 5000 karakter).");

  return { valid: errors.length === 0, errors };
}

export interface PriceFloorResult {
  ok: boolean;
  reason?: string;
  
  comparableMedian?: number;
}

/**
 * Fiyatın makul olup olmadığını değerlendirir.
 * @param comparableMedian Aynı marka+model ilanlarının medyan fiyatı (yoksa null).
 */
export function checkPriceFloor(
  price: number,
  comparableMedian: number | null
): PriceFloorResult {
  if (!Number.isFinite(price) || price <= 0) {
    return { ok: false, reason: "Fiyat geçerli değil." };
  }
  if (price < ABSOLUTE_PRICE_FLOOR) {
    return {
      ok: false,
      reason: `Fiyat en az ${ABSOLUTE_PRICE_FLOOR.toLocaleString("tr-TR")} ₺ olmalıdır. Çok düşük fiyatlı ilanlar yayınlanamaz.`,
    };
  }
  if (comparableMedian && comparableMedian > 0) {
    const floor = comparableMedian * RELATIVE_PRICE_FLOOR_RATIO;
    if (price < floor) {
      return {
        ok: false,
        comparableMedian,
        reason: `Girdiğin fiyat, benzer ilanların ortalamasının (${Math.round(
          comparableMedian
        ).toLocaleString("tr-TR")} ₺) çok altında. Yazım hatası olmadığından emin ol; gerçekten bu fiyatsa açıklamada sebebini belirt.`,
      };
    }
  }
  return { ok: true, comparableMedian: comparableMedian ?? undefined };
}


export function median(values: number[]): number | null {
  const nums = values.filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  if (nums.length === 0) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}
