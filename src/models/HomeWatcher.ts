import mongoose, { Schema } from "mongoose";
import { groupWatcherEventsByHour, splitSecondsByHour, type WatcherEventHour } from "@/lib/home-watcher-status";

/**
 * Evdeki bilgisayarda arka planda çalışan Arabam bekçisinin (scripts/arabam-bekci.ts) yönetim ekranı için
 * kayıtları. Sunucudaki 7/24 motorun kalp atışından (DaemonHeartbeat) ayrı tutulur: o motorun durumunu
 * ve saatlik tablosunu karıştırmasın.
 *
 *  - HomeWatcherState: tek belge, bekçinin son sinyali ve ne yaptığı (kalp atışı).
 *  - HomeWatcherHour: saat başına bir belge, o saatte kaç ilan kontrol edildiği ($inc ile).
 */
export const HOME_WATCHER_ID = "arabam-home";

export interface HomeWatcherStateDoc {
  watcherId: string;
  host: string;
  status: "running" | "paused" | "stopped";
  phase: string;
  gapSeconds: number;
  pausedUntil: Date | null;
  startedAt: Date;
  lastHeartbeat: Date;
  lastBatchAt: Date | null;
  memoryMb: number;
  recentLogs: string[];
}

const HomeWatcherStateSchema = new Schema<HomeWatcherStateDoc>(
  {
    watcherId: { type: String, required: true, unique: true, default: HOME_WATCHER_ID },
    host: { type: String, default: "" },
    status: { type: String, enum: ["running", "paused", "stopped"], default: "running" },
    phase: { type: String, default: "" },
    gapSeconds: { type: Number, default: 10 },
    pausedUntil: { type: Date, default: null },
    startedAt: { type: Date, default: Date.now },
    lastHeartbeat: { type: Date, default: Date.now },
    lastBatchAt: { type: Date, default: null },
    memoryMb: { type: Number, default: 0 },
    recentLogs: { type: [String], default: [] },
  },
  { timestamps: true }
);

export const HomeWatcherState =
  mongoose.models.HomeWatcherState || mongoose.model<HomeWatcherStateDoc>("HomeWatcherState", HomeWatcherStateSchema);

export interface HomeWatcherHourDoc {
  watcherId: string;
  /** Saatin başlangıcı (Türkiye saatine denk gelen UTC anı). */
  timestamp: Date;
  /** GG.AA.YYYY (Türkiye günü). */
  dateStr: string;
  hour: number;
  checked: number;
  alive: number;
  archived: number;
  /** Kontrol sırasında fiyatı ya da bilgisi değişip güncellenen ilan sayısı. */
  updated: number;
  blocked: number;
  uncertain: number;
  batches: number;
  pauses: number;
  pausedMinutes: number;
  /** Bekçinin bu saatte çalıştığı süre; bilgisayar uykusu hariç, hız/yanıt beklemeleri dahil. */
  activeSeconds: number;
  /** Zamanın %10'unda yapılan keşifle bu saatte eklenen yeni ilan sayısı. */
  inserted: number;
  /** Model liste sayfası taraması: çekilen sayfa, sayfalarda bulunan ilanımız ve vitesi düzeltilen ilan. */
  listPages: number;
  listMatched: number;
  listCorrected: number;
}

const HomeWatcherHourSchema = new Schema<HomeWatcherHourDoc>(
  {
    watcherId: { type: String, required: true, default: HOME_WATCHER_ID },
    timestamp: { type: Date, required: true },
    dateStr: { type: String, required: true, index: true },
    hour: { type: Number, required: true },
    checked: { type: Number, default: 0 },
    alive: { type: Number, default: 0 },
    archived: { type: Number, default: 0 },
    updated: { type: Number, default: 0 },
    blocked: { type: Number, default: 0 },
    uncertain: { type: Number, default: 0 },
    batches: { type: Number, default: 0 },
    pauses: { type: Number, default: 0 },
    pausedMinutes: { type: Number, default: 0 },
    activeSeconds: { type: Number, default: 0 },
    inserted: { type: Number, default: 0 },
    listPages: { type: Number, default: 0 },
    listMatched: { type: Number, default: 0 },
    listCorrected: { type: Number, default: 0 },
  },
  { timestamps: true }
);
HomeWatcherHourSchema.index({ watcherId: 1, timestamp: 1 }, { unique: true });

export const HomeWatcherHour =
  mongoose.models.HomeWatcherHour || mongoose.model<HomeWatcherHourDoc>("HomeWatcherHour", HomeWatcherHourSchema);

/** Türkiye (UTC+3, yaz saati yok) saatine göre verilen anın saat başı, günü ve saati. */
export function turkeyHourOf(date: Date): { timestamp: Date; dateStr: string; hour: number } {
  const shifted = new Date(date.getTime() + 3 * 60 * 60 * 1000);
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const hour = shifted.getUTCHours();
  const timestamp = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate(), hour - 3, 0, 0, 0));
  return { timestamp, dateStr: `${day}.${month}.${shifted.getUTCFullYear()}`, hour };
}

export interface WatcherBatchResult {
  checked: number;
  alive: number;
  archived: number;
  /** Fiyatı ya da bilgisi değişip güncellenen ilan sayısı. */
  updated?: number;
  blocked: number;
  uncertain: number;
  /** Bu partinin sonunda verilen engel molası (dk); yoksa 0. */
  pauseMinutes?: number;
  /** Partinin sürdüğü süre (sn). */
  activeSeconds?: number;
  /** Saatlik sonuçları doğru kovaya yazmak için her ilan yanıtının gerçekleştiği an. */
  events?: Array<{
    checkedAt: Date | string;
    status: "active" | "archived" | "gone" | "redirected" | "blocked" | "error";
    archivedAt?: Date | string;
    updatedAt?: Date | string;
    updated?: boolean;
  }>;
  /** Uyku düşülmüş süreyi gerçek parti aralığına saatlik dağıtmak için. */
  startedAt?: Date;
}

/**
 * İlan sonuçlarını yanıt anındaki saate yazar; parti/engel bilgisi bitiş saatine gider.
 * Aktif süre gerçek parti aralığına bölünür; uyku aralığı ayrı yakalanamadığı için saatler arasında eşit hız varsayılır.
 */
export async function recordWatcherBatch(result: WatcherBatchResult, end = new Date()): Promise<void> {
  try {
    type MetricHour = WatcherEventHour & { batches?: number; pauses?: number; pausedMinutes?: number };
    const activeMs = Math.max(0, (result.activeSeconds || 0) * 1000);
    const start = result.startedAt || new Date(end.getTime() - activeMs);
    const hasEvents = Boolean(result.events?.length);
    const eventsByHour = new Map<number, MetricHour>(
      groupWatcherEventsByHour(result.events || []).map((bucket) => [bucket.timestamp.getTime(), bucket])
    );

    const endSlot = turkeyHourOf(end);
    const completionBucket = eventsByHour.get(endSlot.timestamp.getTime()) || {
      timestamp: endSlot.timestamp,
      dateStr: endSlot.dateStr,
      hour: endSlot.hour,
      checked: 0,
      alive: 0,
      archived: 0,
      updated: 0,
      blocked: 0,
      uncertain: 0,
    };
    completionBucket.checked += hasEvents ? 0 : result.checked;
    completionBucket.alive += hasEvents ? 0 : result.alive;
    completionBucket.archived += hasEvents ? 0 : result.archived;
    completionBucket.updated += hasEvents ? 0 : result.updated || 0;
    completionBucket.blocked += hasEvents ? 0 : result.blocked;
    completionBucket.uncertain += hasEvents ? 0 : result.uncertain;
    completionBucket.batches = (completionBucket.batches || 0) + 1;
    completionBucket.pauses = (completionBucket.pauses || 0) + (result.pauseMinutes ? 1 : 0);
    completionBucket.pausedMinutes = (completionBucket.pausedMinutes || 0) + (result.pauseMinutes || 0);
    eventsByHour.set(endSlot.timestamp.getTime(), completionBucket);

    for (const bucket of eventsByHour.values()) {
      await HomeWatcherHour.findOneAndUpdate(
        { watcherId: HOME_WATCHER_ID, timestamp: bucket.timestamp },
        {
          $setOnInsert: { dateStr: bucket.dateStr, hour: bucket.hour },
          $inc: {
            checked: bucket.checked,
            alive: bucket.alive,
            archived: bucket.archived,
            updated: bucket.updated,
            blocked: bucket.blocked,
            uncertain: bucket.uncertain,
            batches: bucket.batches || 0,
            pauses: bucket.pauses || 0,
            pausedMinutes: bucket.pausedMinutes || 0,
          },
        },
        { upsert: true }
      );
    }

    const elapsedMs = Math.max(0, end.getTime() - start.getTime());
    const scale = elapsedMs > 0 ? activeMs / elapsedMs : 0;
    for (const part of splitSecondsByHour(start, end)) {
      const slot = turkeyHourOf(part.at);
      await HomeWatcherHour.findOneAndUpdate(
        { watcherId: HOME_WATCHER_ID, timestamp: slot.timestamp },
        { $setOnInsert: { dateStr: slot.dateStr, hour: slot.hour }, $inc: { activeSeconds: part.seconds * scale } },
        { upsert: true }
      );
    }
  } catch (err) {
    console.error("[HomeWatcher] saatlik kayıt hatası:", err);
  }
}

/** Keşifte eklenen yeni ilanları içinde bulunulan saate ekler (kontrol partilerinden ayrı sayılır). */
export async function recordWatcherDiscovery(inserted: number, now = new Date()): Promise<void> {
  if (!(inserted > 0)) return;
  try {
    const { timestamp, dateStr, hour } = turkeyHourOf(now);
    await HomeWatcherHour.findOneAndUpdate(
      { watcherId: HOME_WATCHER_ID, timestamp },
      { $setOnInsert: { dateStr, hour }, $inc: { inserted } },
      { upsert: true }
    );
  } catch (err) {
    console.error("[HomeWatcher] keşif kaydı hatası:", err);
  }
}

/** Liste sayfası taramasının sonucunu içinde bulunulan saate ekler. */
export async function recordWatcherListSweep(pages: number, matched: number, corrected: number, now = new Date()): Promise<void> {
  if (!(pages > 0)) return;
  try {
    const { timestamp, dateStr, hour } = turkeyHourOf(now);
    await HomeWatcherHour.findOneAndUpdate(
      { watcherId: HOME_WATCHER_ID, timestamp },
      { $setOnInsert: { dateStr, hour }, $inc: { listPages: pages, listMatched: matched, listCorrected: corrected } },
      { upsert: true }
    );
  } catch (err) {
    console.error("[HomeWatcher] liste taraması kaydı hatası:", err);
  }
}

export interface WatcherStateUpdate {
  host?: string;
  status: "running" | "paused" | "stopped";
  phase: string;
  gapSeconds?: number;
  pausedUntil?: Date | null;
  startedAt?: Date;
  lastBatchAt?: Date;
  recentLogs?: string[];
}

/** Kalp atışı: bekçinin son sinyali ve ne yaptığı. */
export async function updateWatcherState(update: WatcherStateUpdate): Promise<void> {
  try {
    const set: Record<string, unknown> = {
      status: update.status,
      phase: update.phase,
      lastHeartbeat: new Date(),
      memoryMb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
    };
    if (update.host !== undefined) set.host = update.host;
    if (update.gapSeconds !== undefined) set.gapSeconds = update.gapSeconds;
    if (update.pausedUntil !== undefined) set.pausedUntil = update.pausedUntil;
    if (update.startedAt) set.startedAt = update.startedAt;
    if (update.lastBatchAt) set.lastBatchAt = update.lastBatchAt;
    if (update.recentLogs) set.recentLogs = update.recentLogs.slice(-30);
    await HomeWatcherState.findOneAndUpdate({ watcherId: HOME_WATCHER_ID }, { $set: set }, { upsert: true });
  } catch (err) {
    console.error("[HomeWatcher] kalp atışı hatası:", err);
  }
}
