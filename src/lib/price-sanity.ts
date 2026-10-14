/**
 * Piyasa fiyat denetimi (saf kurallar): bir fiyat, aynı model ailesinin yıl ±2 içindeki yayındaki ilanlarının orta değerine göre
 * makul mü? Kullanıldığı yerler: kullanıcının ilan verme ve düzenleme isteği (sunucu reddeder) ve tarayıcının YENİ ilan kaydı
 * (bu kayıt atlanır). Mevcut ilanların fiyat güncellemeleri ayrıca fiyat çapasıyla (bkz. scraper/price-guard.ts) denetlenir.
 *
 * Eşikler gerçek yayındaki ilanlarda ölçüldü: rastgele 574 ilanın hiçbiri eşiklere takılmadı; açıkça yanlış kaydedilmiş ilanlar
 * (ör. 10.000 TL kamyon, 310.000 TL kamyon, 15,75 milyon TL 6 emsalli SUV) yakalanır.
 */

/** Oran hesabı için en az bu kadar emsal; daha azında karşılaştırma güvenilir değildir ve denetim yapılmaz. */
export const SANITY_MIN_COMPARABLES = 5;
/** Orta değerin bu oranından düşük fiyat reddedilir (yazım hatası, yanlış tutar). */
export const SANITY_LOW_RATIO = 0.25;
/** Orta değerin bu katından yüksek fiyat reddedilir. */
export const SANITY_HIGH_RATIO = 3;

export type PriceSanityStatus = "ok" | "low" | "high" | "insufficient";

export interface PriceSanity {
  status: PriceSanityStatus;
  /** Emsallerin orta değeri (yeterli emsal yoksa null). */
  median: number | null;
  n: number;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Fiyatı emsal fiyatlarına göre sınıflandırır. Emsal fiyatları yalnız pozitif değerler olabilir. */
export function judgePrice(price: number, comparablePrices: number[]): PriceSanity {
  const prices = comparablePrices.filter((p) => Number.isFinite(p) && p > 0);
  if (!(price > 0) || prices.length < SANITY_MIN_COMPARABLES) {
    return { status: "insufficient", median: null, n: prices.length };
  }
  const mid = median(prices);
  if (price < mid * SANITY_LOW_RATIO) return { status: "low", median: mid, n: prices.length };
  if (price > mid * SANITY_HIGH_RATIO) return { status: "high", median: mid, n: prices.length };
  return { status: "ok", median: mid, n: prices.length };
}

const tl = (value: number) => `${Math.round(value).toLocaleString("tr-TR")} TL`;

/** Kullanıcıya gösterilecek red metni; fiyat makulse null. */
export function sanityMessage(price: number, verdict: PriceSanity): string | null {
  if (verdict.median === null) return null;
  if (verdict.status === "low") {
    return `Girdiğin fiyat (${tl(price)}), benzer ilanların orta değeri olan ${tl(verdict.median)} değerinin %${Math.round(SANITY_LOW_RATIO * 100)}'inden düşük. Satış fiyatını girdiğinden emin ol.`;
  }
  if (verdict.status === "high") {
    return `Girdiğin fiyat (${tl(price)}), benzer ilanların orta değeri olan ${tl(verdict.median)} değerinin ${SANITY_HIGH_RATIO} katından yüksek. Fiyatı kontrol et.`;
  }
  return null;
}
