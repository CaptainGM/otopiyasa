import { modelFamily, modelFamilyKey } from "@/lib/model-family";

/**
 * "Nadir model" taramasının hedef seçimi. Eskiden donanım adıyla ("Linea 1.3 M.Jet AC") sayılıyordu: her yeni ilanın kendine
 * has donanım yazımı yeni bir "1 ilanlı model" doğurduğundan liste hiç bitmiyor (5000 küme, 1700'ü tek ilanlı), aynı aile
 * defalarca hedefleniyordu. Burada sayım AİLE düzeyinde yapılır ("Fiat Linea" = tüm donanımlar), kaynakta zaten tükenmiş
 * (denendi ama hâlâ az) aileler bir süre atlanır.
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
 * Toplam ilanı [threshold]'dan az olan aileleri, en azdan başlayarak seçer. [attempted]: aile → son deneme zamanı (ms);
 * [cooldownMs] içinde denenmiş aileler atlanır (kaynakta daha fazla ilan yoksa boşuna tekrar aranmasın). Hiç denenmemişler
 * önce gelir, eşit sayıda olanlarda en eski denenen önce.
 */
export function selectRareFamilies(
  segments: SegmentCount[],
  threshold: number,
  maxFamilies: number,
  attempted: Map<string, number>,
  now: number,
  cooldownMs: number
): RareFamilyTarget[] {
  const families = new Map<string, RareFamilyTarget & { bestTrimCount: number }>();
  for (const segment of segments) {
    const brand = (segment.brand || "").trim();
    const rawModel = (segment.model || "").trim();
    if (!brand || IGNORED_MODELS.has(rawModel.toLocaleLowerCase("tr-TR"))) continue;
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
      if (family.count >= threshold) return false;
      const last = attempted.get(id);
      return last === undefined || now - last >= cooldownMs;
    })
    .sort(([idA, a], [idB, b]) => {
      if (a.count !== b.count) return a.count - b.count;
      return (attempted.get(idA) ?? 0) - (attempted.get(idB) ?? 0);
    })
    .slice(0, maxFamilies)
    .map(([, family]) => ({ brand: family.brand, model: family.model, familyKey: family.familyKey, count: family.count }));
}
