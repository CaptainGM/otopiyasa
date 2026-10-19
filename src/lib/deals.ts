/**
 * Fırsat kuralının eşikleri. TEK fırsat sistemi: bayrak (market.deal) market-fair.ts içindeki isDealCandidate ile hesaplanır.
 * Ana sayfa şeridi, "Tümünü gör" (/?firsat=1), arama ve mobil aynı bayrağı okur. Bu dosyada ikinci bir fırsat listesi yoktur.
 */

/** Fırsat yalnızca bu model yılı ve sonrası (eski nesil araçlar fırsat sayılmaz). */
export const DEAL_MIN_YEAR = 2015;

/** Fırsat yalnızca bu kilometre ve altı. */
export const DEAL_MAX_MILEAGE = 150_000;

/**
 * Piyasanın bu oranın üstünde altında olan ilan "fırsat" sayılmaz: bu kadar ucuz fiyat çoğu zaman hatalı girilmiş ya da
 * kapora/dolandırıcılık amaçlı ilandır (ör. 2023 C5 Aircross %41 ucuz "haftanın fırsatı" olarak öne çıkıyordu).
 * İlan sayfasında "Dikkat" uyarısı gösterilir (bkz. PricePredictionBadge, mobil market_badge).
 */
export const SUSPICIOUS_DISCOUNT = 0.4;
