/** Reject parser glitches that turn a valid listing price into a tiny or enormous value. */
export function isPlausibleScrapedPrice(current: number | undefined, next: number): boolean {
  if (!Number.isFinite(next) || next <= 0) return false;
  if (!current || !Number.isFinite(current) || current <= 0) return true;
  return next >= current * 0.2 && next <= current * 5;
}

/**
 * Yeni fiyat kabul edilir mi? Güncel fiyata yakın olmalı ya da ilanın İLK fiyatına yakın olmalı.
 * İlk fiyat çapa olarak gerekli: yanlış düşük bir değer (ör. 152.026 TL) kaydedilirse güncel
 * fiyata göre yapılan kontrol doğru fiyatı (2,25 milyon) sonsuza dek reddederdi; ilk fiyat bu kilidi açar.
 */
export function isAcceptableScrapedPrice(current: number | undefined, firstPrice: number | undefined, next: number): boolean {
  if (isPlausibleScrapedPrice(current, next)) return true;
  return typeof firstPrice === "number" && firstPrice > 0 && isPlausibleScrapedPrice(firstPrice, next);
}
