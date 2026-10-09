import { modelFamily, modelFamilyKey, modelNameKey } from "@/lib/model-family";

/**
 * YÖNETİM PANELİ "EN AZ İLANLI MODELLER" LİSTESİ: sitede şu an görünen (aktif) ilan sayısı en az olan marka/model aileleri, en azdan
 * çoğa. Kaynağın kendi model listesinden (ArabamCatalog) bizde hiç ilanı olmayan modeller de 0 adetle girer; "kaynakta" sütunu o modelin
 * kaynaktaki yaklaşık ilan sayısıdır (katalog okunduğu andaki), yani ne kadar eksik olduğunu gösterir. Nadir model taramasıyla aynı
 * sayım birimi (aile) kullanılır.
 */
export interface BoardSegment {
  brand: string;
  model: string;
  count: number;
}

export interface BoardCatalogEntry {
  brand: string;
  model: string;
  /** Kaynaktaki yaklaşık ilan sayısı. */
  sourceCount: number;
}

export interface BoardRow {
  brand: string;
  model: string;
  count: number;
  /** Kaynaktaki yaklaşık ilan sayısı; katalogda yoksa null. */
  sourceCount: number | null;
}

const IGNORED_MODELS = new Set(["", "model", "bilinmiyor"]);

export function buildRareBoard(segments: BoardSegment[], catalog: BoardCatalogEntry[], ceiling = 100): BoardRow[] {
  const families = new Map<string, BoardRow & { bestTrimCount: number }>();

  for (const segment of segments) {
    const brand = (segment.brand || "").trim();
    const rawModel = (segment.model || "").trim();
    if (!brand || IGNORED_MODELS.has(rawModel.toLocaleLowerCase("tr-TR"))) continue;
    const key = modelFamilyKey(rawModel, brand);
    const display = modelFamily(rawModel, brand);
    if (!key || !display) continue;
    const id = `${brand}::${key}`;
    const existing = families.get(id);
    if (!existing) {
      families.set(id, { brand, model: display, count: segment.count, sourceCount: null, bestTrimCount: segment.count });
    } else {
      existing.count += segment.count;
      // Gösterilecek ad: en çok ilanı olan yazımın aile adı.
      if (segment.count > existing.bestTrimCount) {
        existing.model = display;
        existing.bestTrimCount = segment.count;
      }
    }
  }

  for (const entry of catalog) {
    const brand = (entry.brand || "").trim();
    if (!brand) continue;
    const key = modelFamilyKey(entry.model, brand);
    if (!key) continue;
    const id = `${brand}::${key}`;
    const existing = families.get(id);
    if (existing) {
      existing.sourceCount = (existing.sourceCount ?? 0) + entry.sourceCount;
    } else if (modelNameKey(modelFamily(entry.model, brand)) === modelNameKey(entry.model)) {
      // Bizde hiç ilanı olmayan, kaynağın ayrı model saydığı ad.
      families.set(id, { brand, model: entry.model, count: 0, sourceCount: entry.sourceCount, bestTrimCount: 0 });
    }
  }

  return [...families.values()]
    .filter((row) => row.count < ceiling)
    .map(({ brand, model, count, sourceCount }) => ({ brand, model, count, sourceCount }))
    .sort(
      (a, b) =>
        a.count - b.count ||
        (b.sourceCount ?? 0) - (a.sourceCount ?? 0) ||
        a.brand.localeCompare(b.brand, "tr") ||
        a.model.localeCompare(b.model, "tr")
    );
}

export interface BoardPage {
  page: number;
  pages: number;
  pageSize: number;
  total: number;
  rows: BoardRow[];
}

export const BOARD_PAGE_SIZE = 15;

/** Sayfa numarasını geçerli aralığa sıkıştırır (1'den başlar) ve o sayfanın satırlarını verir. */
export function pageOfBoard(rows: BoardRow[], requested: number, pageSize = BOARD_PAGE_SIZE): BoardPage {
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(pages, Math.max(1, Math.trunc(Number.isFinite(requested) ? requested : 1)));
  return { page, pages, pageSize, total: rows.length, rows: rows.slice((page - 1) * pageSize, page * pageSize) };
}
