import { modelFamily, modelFamilyKey, modelNameKey } from "@/lib/model-family";
import { reasonLabel, type AttemptReason } from "@/lib/scraper/model-page";

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

/** Kaynakta bizdekinden çok ilanı olduğu bilinen (yani gerçekten eksik) satırlar; kaynaktakinin tamamı bizde olanlar ve kaynağı bilinmeyenler dışarıda kalır. */
export function onlyMissing<Row extends BoardRow>(rows: Row[]): Row[] {
  return rows.filter((row) => row.sourceCount !== null && row.sourceCount > row.count);
}

/** Nadir model taramasının aile bazlı deneme kaydından listeye gereken alanlar. */
export interface BoardAttempt {
  brand: string;
  familyKey: string;
  attemptedAt: Date | string;
  retryAfterDays?: number;
  reason?: string;
  added?: number;
  before?: number;
  after?: number;
}

export interface NotedBoardRow extends BoardRow {
  /** Bu ailenin neden artmadığını/artacağını anlatan kısa not (deneme kaydından). */
  note: string;
}

const DAY = 24 * 60 * 60 * 1000;

/** Eski kayıtlarda gerekçe yazılı değil: sayılardan çıkarılır. */
function legacyReason(a: BoardAttempt): string {
  const added = a.added ?? 0;
  if (added > 0 && a.before !== undefined && a.after !== undefined && a.after - a.before < added * 0.5) return "mismatch";
  const days = a.retryAfterDays ?? 3;
  return days <= 0 ? "satisfied" : days >= 14 ? "exhausted" : "more";
}

/** Satırın yanına: son deneme sonucu ve ne zaman yeniden aranacağı (hiç denenmediyse sırasını bekliyor). */
export function attemptNote(attempt: BoardAttempt | undefined, now = Date.now()): string {
  if (!attempt) return "henüz sırası gelmedi";
  const reason = (attempt.reason || legacyReason(attempt)) as AttemptReason;
  const label = reasonLabel(reason);
  const retryDays = attempt.retryAfterDays ?? 3;
  const left = Math.ceil((new Date(attempt.attemptedAt).getTime() + retryDays * DAY - now) / DAY);
  if (retryDays <= 0 || left <= 0) return label ? `${label} · sırada` : "sırada";
  const when = left === 1 ? "yarın yeniden" : `${left} gün sonra yeniden`;
  return label ? `${label} · ${when}` : when;
}

export function withAttemptNotes(rows: BoardRow[], attempts: BoardAttempt[], now = Date.now()): NotedBoardRow[] {
  const byFamily = new Map(attempts.map((a) => [`${a.brand}::${a.familyKey}`, a]));
  return rows.map((row) => ({ ...row, note: attemptNote(byFamily.get(`${row.brand}::${modelFamilyKey(row.model, row.brand)}`), now) }));
}

export interface BoardPage<Row = BoardRow> {
  page: number;
  pages: number;
  pageSize: number;
  total: number;
  rows: Row[];
}

export const BOARD_PAGE_SIZE = 15;

/** Sayfa numarasını geçerli aralığa sıkıştırır (1'den başlar) ve o sayfanın satırlarını verir. */
export function pageOfBoard<Row extends BoardRow>(rows: Row[], requested: number, pageSize = BOARD_PAGE_SIZE): BoardPage<Row> {
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(pages, Math.max(1, Math.trunc(Number.isFinite(requested) ? requested : 1)));
  return { page, pages, pageSize, total: rows.length, rows: rows.slice((page - 1) * pageSize, page * pageSize) };
}
