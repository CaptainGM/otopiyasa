/**
 * Piyasa göstergesinin eşikleri: kart rozeti, ilan sayfası termometresi, "haftanın fırsatları" ve
 * mobil rozet aynı kuralları kullanmalı.
 *
 * Bu dosya TEK KAYNAKTIR. Mobil uygulama bu değerleri görebilmek için kendi tarafında aynı
 * sayıları taşır: `mobile/lib/utils/market_position.dart`. Oradaki sabitler buradan farklı
 * olmamalıdır; bir eşiği değiştirirken iki dosyayı birlikte güncelle.
 */
import { SUSPICIOUS_DISCOUNT } from "@/lib/deals";

/** Ortalamaya göre bu yüzdenin içindeki fark "piyasa değerinde" sayılır. */
export const FAIR_BAND_PCT = 6;

/** Karşılaştırma için gereken en az emsal ilan sayısı. */
export const MIN_MARKET_COMPARABLES = 3;

/** Bu orandan fazla ucuz ilan "şüpheli ucuz" sayılır (hatalı fiyat ya da kapora dolandırıcılığı). */
export const SUSPICIOUS_PCT = Math.round(SUSPICIOUS_DISCOUNT * 100);

export { SUSPICIOUS_DISCOUNT };
