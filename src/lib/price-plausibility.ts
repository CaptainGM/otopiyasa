import { PASSENGER_CLASSES } from "@/lib/vehicle-scope";

/**
 * Bir ilanın fiyatı piyasa analizine ve listeye girmeye yetecek kadar makul mü?
 *
 * Kaynaklarda satıcı yazım hatası çıkıyor: 890.000.000 TL'lik bir 208, 4.800.042.000 TL'lik bir Lada, 5.000 TL'lik
 * bir scooter... Bu fiyatlar ortalamaları, "piyasanın %X altında" göstergelerini ve emsalleri bozar. Kural tek yerde
 * tutulur: Car modelindeki kanca bayrağı her yazımda günceller, PUBLIC_LISTING_FILTER bayraklı ilanları dışarıda bırakır.
 * Bayraklı ilan arşive alınmaz; kaynakta fiyat düzelince aynı kayıt kendiliğinden yeniden görünür.
 */

/** Hiçbir binek/hafif ticari araç bu tutarın üstünde ilan edilmez; üstü yazım hatasıdır. */
export const MAX_PLAUSIBLE_PRICE = 100_000_000;

/**
 * Binek araç için alt sınır. 20 bin TL altı (≈ 450 $) ilan yazım hatasıdır; 1990'ların hurda ama gerçek fiyatlı
 * araçları (35–50 bin TL) bu sınırda kalır ve gösterilmeye devam eder.
 */
const PASSENGER_MIN_PRICE = 20_000;

/** Motosiklet, karavan, ticari gibi tiplerde (scooter ve küçük motosiklet dahil) alt sınır daha düşüktür. */
const OTHER_MIN_PRICE = 5_000;

const isPassenger = (vehicleClass?: string | null) => !vehicleClass || (PASSENGER_CLASSES as readonly string[]).includes(vehicleClass);

export function minPlausiblePrice(vehicleClass?: string | null): number {
  return isPassenger(vehicleClass) ? PASSENGER_MIN_PRICE : OTHER_MIN_PRICE;
}

export function isPlausibleListingPrice(price: number, vehicleClass?: string | null): boolean {
  return Number.isFinite(price) && price >= minPlausiblePrice(vehicleClass) && price <= MAX_PLAUSIBLE_PRICE;
}

/** Veritabanı sorgusu karşılığı: bayraklanması gereken fiyat aralığı (araç tipine göre alt sınır). */
export const IMPLAUSIBLE_PRICE_QUERY = {
  $or: [
    { price: { $gt: MAX_PLAUSIBLE_PRICE } },
    { price: { $lt: PASSENGER_MIN_PRICE }, $or: [{ vehicleClass: { $exists: false } }, { vehicleClass: null }, { vehicleClass: { $in: PASSENGER_CLASSES } }] },
    { price: { $lt: OTHER_MIN_PRICE }, vehicleClass: { $exists: true, $nin: [null, ...PASSENGER_CLASSES] } },
  ],
};
