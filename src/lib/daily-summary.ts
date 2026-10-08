/**
 * Yönetim ekranının en üstündeki GÜNLÜK ÖZET: bugün (Türkiye günü) her kaynakta ne değişti ve bunu kim yaptı.
 *
 *  - Bekçi : evdeki bilgisayarda çalışan Arabam bekçisi (HomeWatcherHour; yalnızca Arabam).
 *  - Otonom: sunucudaki 7/24 motor (HourlyScrapeStat.bySource; kaynak bazında kesin).
 *  - Manuel: scrape.bat ve yönetici panelinden elle başlatılan taramalar (ManualScrapeLog).
 *  - Toplam: veritabanındaki gerçek değişim. Yeni = bugün oluşturulan kayıt, kaldırılan = bugün arşive alınan kayıt.
 *    Üç sütunun toplamından fazlaysa fark kayıt tutmayan betiklerden (turbo, keşif betiği…) gelir.
 *
 * "Güncellenen" (fiyat/bilgi değişen) yalnızca sütunlarca bildirilir; veritabanında günlük karşılığı tutulmadığı için Toplam'da
 * sütunların toplamıdır.
 */

export const SUMMARY_SOURCES = ["arabam", "otokoc", "dod", "otoplus", "otomerkezi", "carvak", "vavacars", "ikinciyeni"] as const;

export interface Delta {
  /** + yeni ilan */
  added: number;
  /** − arşive alınan / kaynaktan kalkan ilan */
  removed: number;
  /** ~ fiyatı ya da bilgisi güncellenen ilan */
  updated: number;
}

export const emptyDelta = (): Delta => ({ added: 0, removed: 0, updated: 0 });

export function addDelta(a: Delta, b: Delta): Delta {
  return { added: a.added + b.added, removed: a.removed + b.removed, updated: a.updated + b.updated };
}

export const isEmptyDelta = (d: Delta) => d.added === 0 && d.removed === 0 && d.updated === 0;

const TR_OFFSET_MS = 3 * 60 * 60 * 1000;

/** Türkiye gününün (UTC+3, yaz saati yok) başlangıç anı. */
export function turkeyDayStart(now: Date = new Date()): Date {
  const shifted = new Date(now.getTime() + TR_OFFSET_MS);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - TR_OFFSET_MS);
}

interface HourlySourceStat {
  inserted?: number;
  updated?: number;
  deleted?: number;
}

/** Sunucudaki 7/24 motorun saatlik kayıtlarından kaynak bazında bugünkü iş. */
export function daemonBySource(hours: Array<{ bySource?: Record<string, HourlySourceStat | undefined> }>): Record<string, Delta> {
  const out: Record<string, Delta> = {};
  for (const hour of hours) {
    for (const [source, v] of Object.entries(hour.bySource || {})) {
      if (!v) continue;
      out[source] = addDelta(out[source] || emptyDelta(), { added: v.inserted || 0, removed: v.deleted || 0, updated: v.updated || 0 });
    }
  }
  return out;
}

export interface WatcherHourLike {
  inserted?: number;
  archived?: number;
  updated?: number;
  listCorrected?: number;
}

/** Bekçinin bugünkü işi: keşifle eklenen, arşive alınan ve fiyatı/bilgisi (liste taramasıyla vites dahil) düzeltilen ilanlar. */
export function watcherDelta(hours: WatcherHourLike[]): Delta {
  return hours.reduce<Delta>(
    (sum, h) => addDelta(sum, { added: h.inserted || 0, removed: h.archived || 0, updated: (h.updated || 0) + (h.listCorrected || 0) }),
    emptyDelta()
  );
}

export interface ManualLogLike {
  source: string;
  inserted?: number;
  updated?: number;
  deleted?: number;
  bySource?: Record<string, { inserted?: number; updated?: number; deleted?: number } | undefined>;
}

/** Yalnızca Arabam'a dokunan manuel tarama türleri; kayıtta kaynak adı yerine tür adı yazar. */
const ARABAM_ONLY_MODES = new Set(["rare-model", "rare-brand", "price-refresh", "address-backfill", "sparse-market-segments", "recent", "enrich-arabam"]);

/**
 * Manuel taramaları kaynaklara dağıtır. Kayıtta kaynak başına sayı varsa o kullanılır; yoksa tek kaynaklı taramanın toplamı o
 * kaynağa, Arabam'a özel türlerin toplamı Arabam'a yazılır. Kaynağı anlaşılamayan eski "tümü" kayıtları ayrı tutulur.
 */
export function manualBySource(logs: ManualLogLike[], knownSources: readonly string[] = SUMMARY_SOURCES): { bySource: Record<string, Delta>; unattributed: Delta } {
  const known = new Set(knownSources);
  const bySource: Record<string, Delta> = {};
  let unattributed = emptyDelta();
  const put = (source: string, d: Delta) => {
    bySource[source] = addDelta(bySource[source] || emptyDelta(), d);
  };

  for (const log of logs) {
    const total: Delta = { added: log.inserted || 0, removed: log.deleted || 0, updated: log.updated || 0 };
    const detailed = Object.entries(log.bySource || {}).filter(
      ([, v]) => v && (v.inserted !== undefined || v.updated !== undefined || v.deleted !== undefined)
    );
    if (detailed.length > 0) {
      for (const [source, v] of detailed) put(source, { added: v!.inserted || 0, removed: v!.deleted || 0, updated: v!.updated || 0 });
    } else if (known.has(log.source)) {
      put(log.source, total);
    } else if (ARABAM_ONLY_MODES.has(log.source)) {
      put("arabam", total);
    } else {
      unattributed = addDelta(unattributed, total);
    }
  }
  return { bySource, unattributed };
}

export interface SummaryRow {
  source: string;
  active: number;
  watcher: Delta;
  daemon: Delta;
  manual: Delta;
  total: Delta;
}

export interface DailySummary {
  /** GG.AA.YYYY (Türkiye günü) */
  date: string;
  rows: SummaryRow[];
  totals: { watcher: Delta; daemon: Delta; manual: Delta; total: Delta };
  /** Kaynağı anlaşılamayan eski manuel tarama kayıtlarının toplamı (varsa). */
  unattributedManual: Delta;
}

export interface SummaryInput {
  date: string;
  sources?: readonly string[];
  active: Record<string, number>;
  /** Veritabanı gerçeği: bugün oluşan / arşive alınan kayıt sayıları (kaynak başına). */
  truthAdded: Record<string, number>;
  truthRemoved: Record<string, number>;
  watcher: Delta;
  daemon: Record<string, Delta>;
  manual: { bySource: Record<string, Delta>; unattributed: Delta };
}

export function buildDailySummary(input: SummaryInput): DailySummary {
  const sources = input.sources || SUMMARY_SOURCES;
  const rows: SummaryRow[] = sources.map((source) => {
    const watcher = source === "arabam" ? input.watcher : emptyDelta();
    const daemon = input.daemon[source] || emptyDelta();
    const manual = input.manual.bySource[source] || emptyDelta();
    const reportedUpdates = watcher.updated + daemon.updated + manual.updated;
    return {
      source,
      active: input.active[source] || 0,
      watcher,
      daemon,
      manual,
      total: { added: input.truthAdded[source] || 0, removed: input.truthRemoved[source] || 0, updated: reportedUpdates },
    };
  });

  const sum = (pick: (r: SummaryRow) => Delta) => rows.reduce((acc, r) => addDelta(acc, pick(r)), emptyDelta());
  return {
    date: input.date,
    rows,
    totals: {
      watcher: sum((r) => r.watcher),
      daemon: sum((r) => r.daemon),
      manual: sum((r) => r.manual),
      total: sum((r) => r.total),
    },
    unattributedManual: input.manual.unattributed,
  };
}
