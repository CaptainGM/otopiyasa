import { Car } from "@/models/Car";
import { HourlyScrapeStat } from "@/models/ScrapeMetric";
import { HOME_WATCHER_ID, HomeWatcherHour } from "@/models/HomeWatcher";
import { ManualScrapeLog } from "@/models/ManualScrapeLog";
import { getTurkeyDateStr } from "@/lib/utils";
import {
  SUMMARY_SOURCES,
  buildDailySummary,
  daemonBySource,
  manualBySource,
  turkeyDayStart,
  turkeyDayStartFromStr,
  watcherDelta,
  type DailySummary,
} from "@/lib/daily-summary";

type CarCounts = { active: Record<string, number>; added: Record<string, number>; removed: Record<string, number> };

type HourlyRow = { dateStr?: string; bySource?: Record<string, { inserted?: number; updated?: number; deleted?: number }> };
type WatcherRow = { dateStr?: string; checked?: number; activeSeconds?: number; inserted?: number; archived?: number; updated?: number; listCorrected?: number };
type ManualRow = {
  dateStr?: string;
  source: string;
  inserted?: number;
  updated?: number;
  deleted?: number;
  bySource?: Record<string, { inserted?: number; updated?: number; deleted?: number }>;
};

/**
 * Sayımlar yönetim ekranı her tazelendiğinde (25 sn) tekrar yapılmasın diye kısa süre saklanır.
 *
 * Önbellek GÜN KÜMESİNE göre anahtarlanır: "Bugün" görünümü ile "son 14 gün" tablosu aynı gün için
 * farklı aralıklar istediğinden tek bir güne kilitlemek yanlış sonuç verirdi.
 */
let cachedCounts: { key: string; at: number; value: CarCounts; activeByDay: Map<number, Record<string, number>> } | null = null;
const COUNTS_TTL_MS = 20_000;

/** Seçilen Türkiye günlerinin [başlangıç, bitiş) aralığı; her gün kendi başına sorgulanır. */
async function loadCarCounts(dayStarts: Date[]): Promise<CarCounts> {
  const key = dayStarts.map((d) => d.getTime()).join(",");
  const now = Date.now();
  if (cachedCounts && cachedCounts.key === key && now - cachedCounts.at < COUNTS_TTL_MS) return cachedCounts.value;

  // Gün başına ayrı sorgu: "bugün oluşan" ile "dün oluşan" karışmasın. Sorgu sayısı gün sayısıyla
  // sınırlıdır (en fazla SUMMARY_RANGE_DAYS) ve önbellek sayesinde 25 sn'de bir tekrarlanmaz.
  const perDay = await Promise.all(
    dayStarts.map(async (dayStart) => {
      // Gün sonu: ertesi günün başlangıcı. Son gün (bugün) için üst sınır yok, yani "şu ana kadar".
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      const createdRange = { $gte: dayStart, $lt: dayEnd };
      const removedRange = { $gte: dayStart, $lt: dayEnd };
      const rows = await Promise.all(
        SUMMARY_SOURCES.map(async (source) => {
          const [added, removed, activeThen] = await Promise.all([
            Car.countDocuments({ sourceSite: source, createdAt: createdRange }),
            Car.countDocuments({ sourceSite: source, status: "removed", removedAt: removedRange }),
            // O günün SONUNDA yayında olan ilan sayısı: o güne kadar eklenmiş ve o gün henüz
            // arşivlenmemiş kayıtlar. Geçmiş günlerde bugünkü sayıyı göstermek yanıltıcı olurdu.
            Car.countDocuments({
              sourceSite: source,
              createdAt: { $lt: dayEnd },
              $or: [{ removedAt: { $exists: false } }, { removedAt: null }, { removedAt: { $gte: dayEnd } }],
            }),
          ]);
          return { source, active: activeThen, added, removed };
        })
      );
      return { dayStart, rows };
    })
  );

  const value: CarCounts = { active: {}, added: {}, removed: {} };
  for (const { rows } of perDay) {
    for (const row of rows) {
      value.added[row.source] = (value.added[row.source] || 0) + row.added;
      value.removed[row.source] = (value.removed[row.source] || 0) + row.removed;
    }
  }
  cachedCounts = { key, at: now, value, activeByDay: new Map(perDay.map(({ dayStart, rows }) => {
    const perSource: Record<string, number> = {};
    for (const row of rows) perSource[row.source] = row.active;
    return [dayStart.getTime(), perSource] as const;
  })) };
  return value;
}

/** Önbellekteki gün sonu aktif sayıları; tek gün görünümü de buradan okur. */
function activeOn(dayStart: Date): Record<string, number> {
  return cachedCounts?.activeByDay?.get(dayStart.getTime()) || {};
}

/** Tek bir kaynağın gün filtresine göre özeti. `dateStr` verilmezse bugün. */
export async function loadDailySummary(now = new Date(), dateStr?: string): Promise<DailySummary> {
  const dayStart = dateStr ? turkeyDayStartFromStr(dateStr) : turkeyDayStart(now);
  if (!dayStart) throw new Error(`Geçersiz tarih: ${dateStr}`);
  const date = dateStr || getTurkeyDateStr(now);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const [counts, daemonHours, watcherHours, manualLogs] = await Promise.all([
    loadCarCounts([dayStart]),
    HourlyScrapeStat.find({ dateStr: date }).select("bySource").lean<HourlyRow[]>(),
    HomeWatcherHour.find({ watcherId: HOME_WATCHER_ID, dateStr: date }).select("inserted archived updated listCorrected").lean<WatcherRow[]>(),
    // Manuel tarama kayıtlarında gün alanı yok: seçilen günün [başlangıç, bitiş) aralığı kullanılır.
    ManualScrapeLog.find({ createdAt: { $gte: dayStart, $lt: dayEnd } })
      .select("source inserted updated deleted bySource")
      .lean<ManualRow[]>(),
  ]);

  return buildDailySummary({
    date,
    active: activeOn(dayStart),
    truthAdded: counts.added,
    truthRemoved: counts.removed,
    watcher: watcherDelta(watcherHours),
    daemon: daemonBySource(daemonHours),
    manual: manualBySource(manualLogs),
  });
}

export interface DailySummaryDay extends DailySummary {
  /** Bekçinin o gün kaç ilan kontrol ettiği ve ne kadar çalıştığı (yalnız Arabam). */
  watcherChecked: number;
  watcherArchived: number;
  watcherActiveSeconds: number;
}

export interface DailySummaryRange {
  days: DailySummaryDay[];
  /** Seçilen aralıkta hiç kayıt yoksa arayüz "veri yok" der. */
  hasData: boolean;
}

/**
 * Gün gün tablo: verilen günlerin her biri için ayrı özet.
 *
 * Tek bir toplam yerine gün gün dönülür, çünkü amaç "hangi gün ne oldu"yu görmek; toplam, hareketli
 * bir günü saklar. Aktif ilan sayısı geçmiş günler için geriye dönük hesaplanamaz, o yüzden satırlarda
 * aktif sütunu boş bırakılır (arayüz tire gösterir).
 */
export async function loadDailyRange(dayStrs: string[], now = new Date()): Promise<DailySummaryRange> {
  const days = [...new Set(dayStrs)].filter((d) => turkeyDayStartFromStr(d) !== null).sort().reverse();
  if (days.length === 0) return { days: [], hasData: false };

  const [counts, daemonHours, watcherHours, manualLogs] = await Promise.all([
    loadCarCounts(days.map((d) => turkeyDayStartFromStr(d) as Date)),
    HourlyScrapeStat.find({ dateStr: { $in: days } }).select("dateStr bySource").lean<HourlyRow[]>(),
    HomeWatcherHour.find({ watcherId: HOME_WATCHER_ID, dateStr: { $in: days } })
      .select("dateStr checked activeSeconds inserted archived updated listCorrected")
      .lean<WatcherRow[]>(),
    ManualScrapeLog.find({ createdAt: { $gte: turkeyDayStartFromStr(days[days.length - 1]) as Date } })
      .select("source inserted updated deleted bySource createdAt")
      .lean<ManualRow[]>(),
  ]);

  // Gün bazında gruplama: kayıtlar zaten tek sorguda çekildi, bellekte ayrılır.
  const groupBy = <T extends { dateStr?: string }>(rows: T[]) => {
    const map = new Map<string, T[]>();
    for (const row of rows) {
      const key = row.dateStr || "";
      if (!key) continue;
      const list = map.get(key);
      if (list) list.push(row);
      else map.set(key, [row]);
    }
    return map;
  };

  const daemonByDay = groupBy(daemonHours);
  const watcherByDay = groupBy(watcherHours);

  const results = days.map((date) => {
    const dayStart = turkeyDayStartFromStr(date) as Date;
    const manualForDay = manualLogs.filter((log) => {
      const at = (log as { createdAt?: Date }).createdAt;
      if (!at) return false;
      const time = new Date(at).getTime();
      return time >= dayStart.getTime() && time < dayStart.getTime() + 24 * 60 * 60 * 1000;
    });
    const watcherRows = watcherByDay.get(date) || [];
    const summary: DailySummaryDay = {
      ...buildDailySummary({
        date,
        active: activeOn(dayStart),
        truthAdded: counts.added,
        truthRemoved: counts.removed,
        watcher: watcherDelta(watcherRows),
        daemon: daemonBySource(daemonByDay.get(date) || []),
        manual: manualBySource(manualForDay),
      }),
      watcherChecked: watcherRows.reduce((n, r) => n + (r.checked || 0), 0),
      watcherArchived: watcherRows.reduce((n, r) => n + (r.archived || 0), 0),
      watcherActiveSeconds: watcherRows.reduce((n, r) => n + (r.activeSeconds || 0), 0),
    };
    return summary;
  });

  const hasData = results.some(
    (day) =>
      day.watcherChecked > 0 ||
      day.totals.total.added > 0 ||
      day.totals.total.removed > 0 ||
      day.totals.total.updated > 0
  );

  return { days: results, hasData };
}
