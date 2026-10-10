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

/**
 * Bu orandan fazla PAHALI ilan "olası veri hatası" sayılır.
 *
 * Neden gerekli: kaynak sitelerde fiyat yanlış girilebiliyor. Ölçümde 1990 Renault R 9 için
 * 105.000.000 TL (segment ortalamasının ~740 katı) ve 2016 Peugeot 208 için 890.000.000 TL
 * görüldü. Ortalama hesabı bu uçları zaten ayıklıyor (bkz. robustTrimmedPrices), ama ilanın
 * KENDİSİ kart üzerinde "%74453 pahalı" diye etiketleniyordu: matematik doğru, gösterim anlamsız.
 * Bu eşiğin üstündeki ilanlar "Piyasa dışı fiyat" olarak işaretlenir ve yüzde gösterilmez.
 */
export const ABSURD_PRICE_MULTIPLIER = 5;

/** Ortalamanın bu katından pahalı ilan veri hatası kabul edilir. */
export const ABSURD_PRICE_PCT = (ABSURD_PRICE_MULTIPLIER - 1) * 100;

export { SUSPICIOUS_DISCOUNT };
