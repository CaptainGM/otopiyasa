import { modelFamily, modelFamilyKey } from "@/lib/model-family";

/**
 * "Nadir model" taramasının hedef seçimi. Amaç: en az ilanlı model ailelerinden başlayarak ilan sayısını yukarı çekmek (fiyat tahmini
 * ve piyasa emsali için); sabit bir sayı yoktur. Bir tur en az ilanlıları doldurur, sonraki turlar bir üst kademeye geçer.
 *
 * - Sayım AİLE düzeyindedir ("Fiat Linea" = tüm donanımlar). Donanım adıyla sayınca her yeni ilan yeni bir "1 ilanlı model"
 *   doğuruyor, liste hiç bitmiyordu.
 * - Sıra: ilan sayısı AZDAN ÇOĞA; eşitlikte popüler marka önce (Hyundai'nin bir modelinden ilan bulunması Lamborghini'ninkinden
 *   daha olasıdır).
 * - Bir aile denenince NOT ALINIR ve bir süre sonra yeniden denenir: kaynakta aranan sayfa doluysa (daha fazlası var) 3 gün, sayfa
 *   dolmadıysa (kaynakta olan hepsi zaten çekildi) 14 gün. Bekleme sürecinde tur başka az ilanlı ailelere geçer; aynı aile tekrar
 *   tekrar aranmaz, ama kaynağa haftaya yeni ilan eklenirse bir sonraki denemede çekilir.
 */
export interface SegmentCount {
  brand: string;
  model: string;
  count: number;
  /** Kaynağın kendi model listesinden ("arazi-suv-pick-up/hyundai-ioniq-5"): model sayfasının kesin adresi. */
  path?: string;
}

export interface RareFamilyTarget {
  brand: string;
  /** Kaynakta aranacak aile adı ("Linea"). */
  model: string;
  familyKey: string;
  /** Veritabanında bu ailenin tüm donanımlarındaki toplam ilan sayısı. */
  count: number;
  /** Kaynağın model sayfası adresi (katalogdan); yoksa ad adrese çevrilir. */
  path?: string;
}

/** Kademeler: önce tüm modeller 5 ilana, sonra 10'a, 15'e… çıkarılır; hiçbiri bir turda yüzlerce ilana şişirilmez. */
export const RARE_LEVELS = [5, 10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200];

export interface QuotaFamilyTarget extends RareFamilyTarget {
  /** Bu turda en çok kaç yeni ilan çekilir (kademe − mevcut sayı). */
  quota: number;
}

/**
 * Sıradaki kademeyi seçer: altında modeli kalan en küçük kademe. O kademenin altındaki modeller en azdan başlayarak [maxFamilies]
 * kadar alınır ve her biri yalnızca kademeye kadar doldurulur. Bekleme listesindeki modeller zaten [eligible] dışındadır.
 */
export function planRareLevel(
  eligible: RareFamilyTarget[],
  ceiling: number,
  maxFamilies: number
): { level: number; targets: QuotaFamilyTarget[]; below: number } | null {
  const levels = [...RARE_LEVELS.filter((l) => l <= ceiling)];
  if (levels.length === 0 || levels[levels.length - 1] < ceiling) levels.push(ceiling);
  for (const level of levels) {
    const below = eligible.filter((t) => t.count < level).sort((x, y) => x.count - y.count); // sıralı gelir; sağlamlık için yine de en azdan başlar
    if (below.length > 0) {
      return {
        level,
        below: below.length,
        targets: below.slice(0, maxFamilies).map((t) => ({ ...t, quota: level - t.count })),
      };
    }
  }
  return null;
}

export const familyId = (brand: string, familyKey: string) => `${brand}::${familyKey}`;

/** Kaynağın bir liste sayfasındaki ilan sayısı. */
export const SOURCE_PAGE_SIZE = 20;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const RETRY_DAYS_MORE_EXISTS = 3;
export const RETRY_DAYS_EXHAUSTED = 14;

/** Denemeden sonra aile kaç gün beklesin: arama sayfaları dolduysa kaynakta daha fazlası vardır. */
export function retryDaysFor(found: number, pagesSearched: number): number {
  return found >= pagesSearched * SOURCE_PAGE_SIZE ? RETRY_DAYS_MORE_EXISTS : RETRY_DAYS_EXHAUSTED;
}

const IGNORED_MODELS = new Set(["", "model", "bilinmiyor"]);

/**
 * İlan sayısı [ceiling]'in altındaki aileleri en azdan başlayarak seçer. [blockedUntil]: aile → bu zamana (ms) kadar yeniden aranmaz.
 */
export function selectRareFamilies(
  segments: SegmentCount[],
  ceiling: number,
  maxFamilies: number,
  blockedUntil: Map<string, number>,
  now: number
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
      families.set(id, { brand, model: display, familyKey, count: segment.count, bestTrimCount: segment.count, path: segment.path });
    } else {
      existing.count += segment.count;
      if (segment.path && !existing.path) existing.path = segment.path;
      // Aranacak ad: en çok ilanı olan yazımın aile adı (kaynağın tanıdığı yazıma en yakını).
      if (segment.count > existing.bestTrimCount) {
        existing.model = display;
        existing.bestTrimCount = segment.count;
      }
    }
  }

  return [...families.entries()]
    .filter(([id, family]) => {
      if (family.count >= ceiling) return false;
      const until = blockedUntil.get(id);
      return until === undefined || now >= until;
    })
    .sort(([, a], [, b]) => {
      if (a.count !== b.count) return a.count - b.count;
      const popularity = (brandTotals.get(b.brand) || 0) - (brandTotals.get(a.brand) || 0);
      if (popularity !== 0) return popularity;
      return `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`, "tr");
    })
    .slice(0, maxFamilies)
    .map(([, family]) => ({ brand: family.brand, model: family.model, familyKey: family.familyKey, count: family.count, path: family.path }));
}
