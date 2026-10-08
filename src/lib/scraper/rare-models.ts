import { modelFamily, modelFamilyKey } from "@/lib/model-family";

/**
 * "Nadir model" taramasının hedef seçimi. Amaç: her marka-modelden en az [threshold] ilan olsun (fiyat tahmini ve piyasa
 * emsali için); kaynakta o kadar yoksa olan çekilir ve model bırakılır.
 *
 * - Sayım AİLE düzeyindedir ("Fiat Linea" = tüm donanımlar). Donanım adıyla sayınca her yeni ilan yeni bir "1 ilanlı model"
 *   doğuruyor, liste hiç bitmiyordu.
 * - Sıra: ÖNCE POPÜLER MARKALARIN az ilanlı modelleri (Hyundai'nin bir modelinden 10 ilan vardır; Lamborghini'nin belki
 *   yoktur), sonra nadir markalar. Böylece bütçe kaynakta ilan bulunması muhtemel yerlere gider.
 * - Bir aile BİR KEZ denenince (kaynakta ne kadar varsa o kadar çekilir) bir daha aranmaz; sıra hep başka az ilanlı aileye geçer.
 */
export interface SegmentCount {
  brand: string;
  model: string;
  count: number;
}

export interface RareFamilyTarget {
  brand: string;
  /** Kaynakta aranacak aile adı ("Linea"). */
  model: string;
  familyKey: string;
  /** Veritabanında bu ailenin tüm donanımlarındaki toplam ilan sayısı. */
  count: number;
}

export const familyId = (brand: string, familyKey: string) => `${brand}::${familyKey}`;

const IGNORED_MODELS = new Set(["", "model", "bilinmiyor"]);

/**
 * Toplam ilanı [threshold]'dan az olan aileleri seçer. [attempted]: daha önce denenmiş aileler (bir daha aranmaz).
 * Sıralama: marka toplam ilanı çok olan önce, aynı markada en az ilanlı aile önce.
 */
export function selectRareFamilies(
  segments: SegmentCount[],
  threshold: number,
  maxFamilies: number,
  attempted: Set<string>
): RareFamilyTarget[] {
  const families = new Map<string, RareFamilyTarget & { bestTrimCount: number }>();
  const brandTotals = new Map<string, number>();
  for (const segment of segments) {
    const brand = (segment.brand || "").trim();
    const rawModel = (segment.model || "").trim();
    if (!brand) continue;
    brandTotals.set(brand, (brandTotals.get(brand) || 0) + segment.count);
    if (IGNORED_MODELS.has(rawModel.toLocaleLowerCase("tr-TR"))) continue;
    const familyKey = modelFamilyKey(rawModel, brand);
    const display = modelFamily(rawModel, brand);
    if (!familyKey || !display) continue;

    const id = familyId(brand, familyKey);
    const existing = families.get(id);
    if (!existing) {
      families.set(id, { brand, model: display, familyKey, count: segment.count, bestTrimCount: segment.count });
    } else {
      existing.count += segment.count;
      // Aranacak ad: en çok ilanı olan yazımın aile adı (kaynağın tanıdığı yazıma en yakını).
      if (segment.count > existing.bestTrimCount) {
        existing.model = display;
        existing.bestTrimCount = segment.count;
      }
    }
  }

  return [...families.entries()]
    .filter(([id, family]) => {
      return family.count < threshold && !attempted.has(id);
    })
    .sort(([, a], [, b]) => {
      const popularity = (brandTotals.get(b.brand) || 0) - (brandTotals.get(a.brand) || 0);
      if (popularity !== 0) return popularity;
      if (a.brand !== b.brand) return a.brand.localeCompare(b.brand, "tr");
      return a.count - b.count;
    })
    .slice(0, maxFamilies)
    .map(([, family]) => ({ brand: family.brand, model: family.model, familyKey: family.familyKey, count: family.count }));
}
