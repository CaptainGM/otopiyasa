import { quantile } from "@/lib/price-scale";

/**
 * SEGMENT FİYAT TAVANI: bir modelin (model ailesi, yoksa marka) normal fiyat düzeyinin belli bir katından pahalı ilan
 * kabul edilmez. Referans, segmentteki fiyatların %95'i (tek bir uç değer tavanı kaydıramaz); tavan referansın 5 katı.
 * Örnek: segmentin %95'i 1,4 milyon TL ise 7 milyon TL üstü ilan (yanlışlıkla eklenen 90 milyon gibi) kabul edilmez.
 * Bugünkü aktif ilanlarda (aile ≥ 20 ilan) bu kural hiçbir ilanı işaretlemiyor; yalnızca gerçek uçları yakalar.
 */
export const SEGMENT_CAP_RATIO = 5;
/**
 * Model ailesinde bu kadar ilan yoksa marka geneli referans alınır. Marka geneli, premium modelleri (Corvette, Maybach gibi)
 * kitle modelinin fiyatıyla tavanlar; bu yüzden aile eşiği düşük tutuldu.
 */
export const SEGMENT_MIN_FAMILY = 8;
/** Marka geneli için de yeterli ilan yoksa tavan uygulanmaz (yalnızca mutlak sınırlar geçerli). */
export const SEGMENT_MIN_BRAND = 50;

export interface SegmentCap {
  /** En yüksek kabul edilen fiyat (TL). */
  cap: number;
  /** Referans: segmentin %95'lik fiyatı (TL). */
  reference: number;
  /** Referansı oluşturan ilan sayısı. */
  n: number;
  scope: "aile" | "marka";
}

/** Aile ve marka fiyat listelerinden tavanı hesaplar. Yeterli veri yoksa null. */
export function segmentCapFrom(familyPrices: number[], brandPrices: number[]): SegmentCap | null {
  const family = familyPrices.filter((p) => p > 0).sort((a, b) => a - b);
  if (family.length >= SEGMENT_MIN_FAMILY) {
    const reference = quantile(family, 0.95);
    return { cap: reference * SEGMENT_CAP_RATIO, reference, n: family.length, scope: "aile" };
  }
  const brand = brandPrices.filter((p) => p > 0).sort((a, b) => a - b);
  if (brand.length >= SEGMENT_MIN_BRAND) {
    const reference = quantile(brand, 0.95);
    return { cap: reference * SEGMENT_CAP_RATIO, reference, n: brand.length, scope: "marka" };
  }
  return null;
}

export function isAboveSegmentCap(price: number, cap: SegmentCap | null): boolean {
  return cap !== null && price > cap.cap;
}

/** Tavanın üstündeki fiyat için kullanıcıya gösterilecek mesaj; tavanın altındaysa null. Kayıt ve düzenleme aynı mesajı kullanır. */
export function segmentCapMessage(price: number, cap: SegmentCap | null): string | null {
  if (!isAboveSegmentCap(price, cap)) return null;
  const limit = Math.round(cap?.cap ?? 0).toLocaleString("tr-TR");
  return `Bu marka ve model için girilen fiyat benzer ilanların normal fiyat düzeyinin çok üstünde (en fazla ${limit} TL). Fiyatı kontrol edin.`;
}
