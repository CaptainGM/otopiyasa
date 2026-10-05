/**
 * Yönetim ekranında gösterilecek bekçi durumu ve günlük/saatlik özetler (saf fonksiyonlar, test edilebilir).
 */

/** Bekçi her dakika sinyal verir; bundan eski ise bilgisayar kapalı/uykuda ya da bekçi durmuştur. */
export const WATCHER_STALE_MS = 3 * 60 * 1000;

export interface WatcherStatus {
  /** online: çalışıyor, paused: Cloudflare engeli yüzünden molada, offline: sinyal yok. */
  state: "online" | "paused" | "offline";
  label: string;
  phase: string;
  host: string;
  gapSeconds: number | null;
  pausedUntil: string | null;
  lastHeartbeat: string | null;
  heartbeatAgeSec: number | null;
  startedAt: string | null;
  recentLogs: string[];
}

type StateLike = {
  host?: string;
  status?: string;
  phase?: string;
  gapSeconds?: number;
  pausedUntil?: Date | string | null;
  lastHeartbeat?: Date | string;
  startedAt?: Date | string;
  recentLogs?: string[];
} | null | undefined;

const iso = (value?: Date | string | null) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

export function describeWatcher(doc: StateLike, now = Date.now()): WatcherStatus {
  const last = doc?.lastHeartbeat ? new Date(doc.lastHeartbeat) : null;
  const ageSec = last && !Number.isNaN(last.getTime()) ? Math.max(0, Math.round((now - last.getTime()) / 1000)) : null;
  const fresh = ageSec !== null && ageSec * 1000 < WATCHER_STALE_MS;
  const stopped = doc?.status === "stopped";

  let state: WatcherStatus["state"] = "offline";
  if (fresh && !stopped) state = doc?.status === "paused" ? "paused" : "online";

  const label =
    state === "online"
      ? "Çalışıyor"
      : state === "paused"
        ? "Molada (engel)"
        : !doc
          ? "Hiç çalışmadı"
          : stopped
            ? "Durdu"
            : "Kapalı (bilgisayar kapalı ya da uykuda olabilir)";

  return {
    state,
    label,
    phase: state === "offline" ? "" : doc?.phase || "",
    host: doc?.host || "",
    gapSeconds: state === "offline" ? null : doc?.gapSeconds ?? null,
    pausedUntil: state === "paused" ? iso(doc?.pausedUntil) : null,
    lastHeartbeat: iso(doc?.lastHeartbeat),
    heartbeatAgeSec: ageSec,
    startedAt: iso(doc?.startedAt),
    recentLogs: doc?.recentLogs || [],
  };
}

export interface HourRow {
  dateStr: string;
  hour: number;
  checked: number;
  alive: number;
  archived: number;
  blocked: number;
  uncertain: number;
  batches?: number;
  pauses?: number;
  pausedMinutes?: number;
  activeSeconds?: number;
  /** Keşifle eklenen yeni ilan. */
  inserted?: number;
}

export interface DaySummary {
  dateStr: string;
  checked: number;
  alive: number;
  archived: number;
  blocked: number;
  /** Engel dışındaki belirsiz sonuçlar (zaman aşımı vb.). */
  uncertain: number;
  /** Bekçinin o gün ilan kontrol ederek geçirdiği süre (sn); molalar ve bekleme hariç. */
  activeSeconds: number;
  pausedMinutes: number;
  /** Keşifle eklenen yeni ilan. */
  inserted: number;
}

/** Saatlik kayıtları Türkiye gününe göre toplar; en yeni gün başta. */
export function summarizeDays(rows: HourRow[]): DaySummary[] {
  const byDay = new Map<string, DaySummary>();
  for (const r of rows) {
    const day =
      byDay.get(r.dateStr) ||
      { dateStr: r.dateStr, checked: 0, alive: 0, archived: 0, blocked: 0, uncertain: 0, activeSeconds: 0, pausedMinutes: 0, inserted: 0 };
    day.checked += r.checked;
    day.alive += r.alive;
    day.archived += r.archived;
    day.blocked += r.blocked;
    day.uncertain += r.uncertain;
    day.pausedMinutes += r.pausedMinutes || 0;
    day.activeSeconds += r.activeSeconds || 0;
    day.inserted += r.inserted || 0;
    byDay.set(r.dateStr, day);
  }
  const key = (d: string) => d.split(".").reverse().join("");
  return [...byDay.values()].sort((a, b) => key(b.dateStr).localeCompare(key(a.dateStr)));
}

export interface HourSlot extends HourRow {
  hourRange: string;
}

/** Bir günün 24 saatini döndürür; bekçinin çalışmadığı saatler sıfır olarak gelir. */
export function fillDayHours(dateStr: string, rows: HourRow[]): HourSlot[] {
  const byHour = new Map(rows.filter((r) => r.dateStr === dateStr).map((r) => [r.hour, r]));
  return Array.from({ length: 24 }, (_, hour) => {
    const r = byHour.get(hour);
    return {
      dateStr,
      hour,
      hourRange: `${String(hour).padStart(2, "0")}:00 - ${String((hour + 1) % 24).padStart(2, "0")}:00`,
      checked: r?.checked || 0,
      alive: r?.alive || 0,
      archived: r?.archived || 0,
      blocked: r?.blocked || 0,
      uncertain: r?.uncertain || 0,
      batches: r?.batches || 0,
      pauses: r?.pauses || 0,
      pausedMinutes: r?.pausedMinutes || 0,
      activeSeconds: r?.activeSeconds || 0,
      inserted: r?.inserted || 0,
    };
  });
}

/**
 * Kalan işin tahmini: son günlerde bekçinin çalıştığı saat başına ortalama kontrol sayısından, kalan ilanların
 * kaç ÇALIŞMA saati süreceği. Veri yoksa (henüz çalışmadıysa) null.
 */
export function estimateRemaining(remaining: number, days: DaySummary[]): { perActiveHour: number; activeHoursNeeded: number } | null {
  const recent = days.slice(0, 7);
  const seconds = recent.reduce((s, d) => s + d.activeSeconds, 0);
  const checked = recent.reduce((s, d) => s + d.checked, 0);
  // 5 dakikadan az veriyle hız ölçülmez (ilk partiler tahmini yanıltır).
  if (seconds < 300 || checked <= 0) return null;
  const perActiveHour = Math.max(1, Math.round(checked / (seconds / 3600)));
  return { perActiveHour, activeHoursNeeded: Math.ceil(remaining / perActiveHour) };
}

/** 4500 sn → "1 sa 15 dk", 700 sn → "11 dk", 0 → "—". */
export function formatActiveTime(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes <= 0) return seconds > 0 ? "<1 dk" : "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} sa${m > 0 ? ` ${m} dk` : ""}` : `${m} dk`;
}
