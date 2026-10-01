/**
 * Yakıt tipini tek yazıma indirger. Kaynaklar aynı yakıtı farklı yazıyordu ("LPG & Benzin",
 * "Benzin & LPG", "Lpg", "Hybrid"); filtre birebir eşleştiği için mobildeki "LPG" seçimi hiçbir
 * ilan bulmuyor, istatistikler de ikiye bölünüyordu.
 */
export const FUEL_TYPES = ["Benzin", "Dizel", "LPG & Benzin", "Hibrit", "Elektrik"] as const;
export type FuelType = (typeof FUEL_TYPES)[number];

/** Başlık/modeldeki şarjlı hibrit ifadeleri ("PLUG-İN", "E-TENSE", "PHEV"). */
export const PLUG_IN_TEXT = /plug[\s-]*in|phev|e-?tense|şarjlı\s+hibrit|sarjli\s+hibrit/i;

/**
 * Kaynak alanı "Benzin"/"Dizel" yazsa da başlığında şarjlı hibrit ifadesi olan araç hibrittir.
 * Yalnızca bu açık ifadeye bakılır: "hybrid" kelimesi hafif hibritlerde de geçtiği için yetmez.
 */
export function fuelWithTitleHint(fuel: string | null | undefined, ...texts: Array<string | null | undefined>): string {
  const normalized = normalizeFuelType(fuel);
  if (!["Benzin", "Dizel", "Bilinmiyor"].includes(normalized)) return normalized;
  return PLUG_IN_TEXT.test(texts.filter(Boolean).join(" ")) ? "Hibrit" : normalized;
}

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
