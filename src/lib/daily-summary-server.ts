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
  watcherDelta,
  type DailySummary,
} from "@/lib/daily-summary";

type CarCounts = { active: Record<string, number>; added: Record<string, number>; removed: Record<string, number> };

// Sayımlar yönetim ekranı her tazelendiğinde (25 sn) tekrar yapılmasın diye kısa süre saklanır; gün değişince atılır.
let cachedCounts: { day: number; at: number; value: CarCounts } | null = null;
const COUNTS_TTL_MS = 20_000;

async function loadCarCounts(dayStart: Date): Promise<CarCounts> {
  const now = Date.now();
  if (cachedCounts && cachedCounts.day === dayStart.getTime() && now - cachedCounts.at < COUNTS_TTL_MS) return cachedCounts.value;

  const perSource = await Promise.all(
    SUMMARY_SOURCES.map(async (source) => {
      const [active, added, removed] = await Promise.all([
        Car.countDocuments({ sourceSite: source, status: { $ne: "removed" } }),
        Car.countDocuments({ sourceSite: source, createdAt: { $gte: dayStart } }),
        Car.countDocuments({ sourceSite: source, status: "removed", removedAt: { $gte: dayStart } }),
      ]);
      return { source, active, added, removed };
    })
  );
  const value: CarCounts = { active: {}, added: {}, removed: {} };
  for (const row of perSource) {
    value.active[row.source] = row.active;
    value.added[row.source] = row.added;
    value.removed[row.source] = row.removed;
  }
  cachedCounts = { day: dayStart.getTime(), at: now, value };
  return value;
}

export async function loadDailySummary(now = new Date()): Promise<DailySummary> {
  const dayStart = turkeyDayStart(now);
  const date = getTurkeyDateStr(now);

  const [counts, daemonHours, watcherHours, manualLogs] = await Promise.all([
    loadCarCounts(dayStart),
    HourlyScrapeStat.find({ dateStr: date }).select("bySource").lean<Array<{ bySource?: Record<string, { inserted?: number; updated?: number; deleted?: number }> }>>(),
    HomeWatcherHour.find({ watcherId: HOME_WATCHER_ID, dateStr: date })
      .select("inserted archived updated listCorrected")
      .lean<Array<{ inserted?: number; archived?: number; updated?: number; listCorrected?: number }>>(),
    ManualScrapeLog.find({ createdAt: { $gte: dayStart } })
      .select("source inserted updated deleted bySource")
      .lean<Array<{ source: string; inserted?: number; updated?: number; deleted?: number; bySource?: Record<string, { inserted?: number; updated?: number; deleted?: number }> }>>(),
  ]);

  return buildDailySummary({
    date,
    active: counts.active,
    truthAdded: counts.added,
    truthRemoved: counts.removed,
    watcher: watcherDelta(watcherHours),
    daemon: daemonBySource(daemonHours),
    manual: manualBySource(manualLogs),
  });
}
