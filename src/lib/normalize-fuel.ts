/**
 * Yakıt tipini tek yazıma indirger. Kaynaklar aynı yakıtı farklı yazıyordu ("LPG & Benzin",
 * "Benzin & LPG", "Lpg", "Hybrid"); filtre birebir eşleştiği için mobildeki "LPG" seçimi hiçbir
 * ilan bulmuyor, istatistikler de ikiye bölünüyordu.
 */
export const FUEL_TYPES = ["Benzin", "Dizel", "LPG & Benzin", "Hibrit", "Elektrik"] as const;
export type FuelType = (typeof FUEL_TYPES)[number];

export function normalizeFuelType(raw?: string | null): string {
  const value = (raw || "").trim();
  if (!value) return "Bilinmiyor";
  const v = value.toLocaleLowerCase("tr-TR");
  if (/lpg|otogaz|cng/.test(v)) return "LPG & Benzin";
  if (/hibrit|hybrid|hev|phev/.test(v)) return "Hibrit";
  if (/elektrik|electric|elektirik|\bev\b/.test(v)) return "Elektrik";
  if (/dizel|diesel|mazot|tdi|dci|crdi|cdi|multijet|bluehdi/.test(v)) return "Dizel";
  if (/benzin|kurşunsuz|kursunsuz|unleaded|gasoline|petrol|tsi|tfsi|tce/.test(v)) return "Benzin";
  if (/bilinmiyor|belirtilmemi/.test(v)) return "Bilinmiyor";
  return value;
}
