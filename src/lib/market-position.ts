import { SUSPICIOUS_DISCOUNT } from "@/lib/deals";

/**
 * Fiyatın kendi segmentindeki yeri (kart göstergesi, ilan termometresi, mobil rozet aynı kuralı kullanır):
 *  - ±%6 içinde: piyasa değerinde
 *  - %6+ altında: ucuz; %30+ altında: şüpheli ucuz (hatalı fiyat ya da kapora dolandırıcılığı olabilir)
 *  - %6+ üstünde: pahalı
 * Gösterge ibresi 0 farkta ortada, her %1 fark için %2,5 kayar (uçlarda %6–%94 arasında kalır).
 */
export const FAIR_BAND_PCT = 6;
export const MIN_MARKET_COMPARABLES = 3;

export type MarketBand = "suspicious" | "cheap" | "fair" | "pricey";

export interface MarketPosition {
  /** Ortalamaya göre fark yüzdesi (eksi = ucuz). */
  pct: number;
  band: MarketBand;
  /** Gösterge üzerindeki yer, 6–94. */
  marker: number;
  /** Kısa etiket: "%12 ucuz", "Piyasa değerinde", "%8 pahalı", "Şüpheli ucuz". */
  label: string;
}

export function marketPosition(
  price: number,
  avg?: number | null,
  count?: number | null
): MarketPosition | null {
  if (!price || !avg || avg <= 0 || !count || count < MIN_MARKET_COMPARABLES) return null;
  const pct = Math.round(((price - avg) / avg) * 100);
  const marker = Math.max(6, Math.min(94, 50 + pct * 2.5));
  if (pct <= -Math.round(SUSPICIOUS_DISCOUNT * 100)) {
    return { pct, band: "suspicious", marker, label: "Şüpheli ucuz" };
  }
  if (pct <= -FAIR_BAND_PCT) return { pct, band: "cheap", marker, label: `%${Math.abs(pct)} ucuz` };
  if (pct >= FAIR_BAND_PCT) return { pct, band: "pricey", marker, label: `%${pct} pahalı` };
  return { pct, band: "fair", marker, label: "Piyasa değerinde" };
}
