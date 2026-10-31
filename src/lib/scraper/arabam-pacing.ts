/**
 * Arabam arka plan doğrulayıcısının (scripts/arabam-bekci.ts) hız ve mola kararı.
 *
 * Her partiden (≈20 ilan) sonra sonuca bakılır: engel yoksa ilanlar arası bekleme yavaşça temel
 * değere iner; engel gelirse bekleme uzar; art arda engel gelirse doğrulayıcı 20-25 dk mola verir.
 * Hafta sonu Cloudflare daha sıkı olduğundan 10-14 sn temkinli; hafta içi 8-11.5 sn akıcıdır.
 */
export const PACING = {
  /** Hafta sonu: Cloudflare koruması hafta sonu yoğun insan trafiğinde daha agresif olduğundan temkinli hız (10 - 14 sn arası dinamik, taban 12 sn) */
  weekendBaseGapSeconds: 12,
  weekendMinMs: 10000,
  weekendSpreadMs: 4000,

  /** Hafta içi: Daha gevşek Cloudflare eşikleri için akıcı hız (8 - 11.5 sn arası dinamik, taban 9 sn) */
  weekdayBaseGapSeconds: 9,
  weekdayMinMs: 8000,
  weekdaySpreadMs: 3500,

  /** Geriye dönük uyumluluk tabanı */
  baseGapSeconds: 9,
  maxGapSeconds: 30,

  /**
   * Engel molası (dk): Kullanıcı isteği doğrultusunda 20-25 dk yapıldı.
   * İlk engelde 20 dk mola verilir; art arda engelde en fazla 25 dk olur (asla 45-60-120 dk olmaz).
   */
  firstPauseMinutes: 20,
  maxPauseMinutes: 25,

  /** Sırada doğrulanacak ilan yokken (hepsi son saatlerde denenmiş) bekleme. */
  idleMinutes: 10,
  /** Parti çoğunlukla hata verdiyse (internet/tarayıcı sorunu) bekleme. */
  errorMinutes: 5,
} as const;

export function isWeekendInTurkey(date = new Date()): boolean {
  try {
    const dayStr = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Istanbul", weekday: "short" }).format(date);
    return dayStr === "Sat" || dayStr === "Sun";
  } catch {
    const day = date.getDay();
    return day === 0 || day === 6;
  }
}

export interface DayPacingConfig {
  isWeekend: boolean;
  baseGapSeconds: number;
  minMs: number;
  spreadMs: number;
  minSec: number;
  maxSec: number;
}

/**
 * Günün durumuna göre hız profilini döner:
 * - Hafta sonu (Cloudflare daha sıkı): 10 - 14 sn arası dinamik (taban ~12 sn)
 * - Hafta içi (Cloudflare daha gevşek): 8 - 11.5 sn arası dinamik (taban ~9 sn)
 */
export function getArabamPacingConfig(date = new Date()): DayPacingConfig {
  const isWeekend = isWeekendInTurkey(date);
  if (isWeekend) {
    return {
      isWeekend: true,
      baseGapSeconds: PACING.weekendBaseGapSeconds,
      minMs: PACING.weekendMinMs,
      spreadMs: PACING.weekendSpreadMs,
      minSec: 10,
      maxSec: 14,
    };
  }
  return {
    isWeekend: false,
    baseGapSeconds: PACING.weekdayBaseGapSeconds,
    minMs: PACING.weekdayMinMs,
    spreadMs: PACING.weekdaySpreadMs,
    minSec: 8,
    maxSec: 11.5,
  };
}

export interface PacingState {
  gapSeconds: number;
  pauseMinutes: number;
}

export interface BatchOutcome {
  checked: number;
  blocked: number;
  errors: number;
  /** Partide art arda engel sınırı aşıldı (BlockStreak). */
  paused: boolean;
}

export interface PacingPlan extends PacingState {
  /** Bir sonraki partiye başlamadan önce beklenecek dakika (0: hemen devam). */
  sleepMinutes: number;
  reason: "idle" | "blocked-pause" | "errors" | "slow-down" | "ok";
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function planNextStep(state: PacingState, outcome: BatchOutcome, customBase?: number): PacingPlan {
  const base = customBase || PACING.baseGapSeconds;

  if (outcome.checked === 0 && !outcome.paused) {
    return { ...state, sleepMinutes: PACING.idleMinutes, reason: "idle" };
  }

  const heavyBlock = outcome.paused || (outcome.checked > 0 && outcome.blocked >= Math.max(3, outcome.checked * 0.25));
  if (heavyBlock) {
    // 20 dk mola ile başlar, art arda engelde en fazla 25 dk olur. Asla 45 veya 60 dk'ya çıkmaz.
    const pauseMinutes = state.pauseMinutes > 0
      ? Math.min(Math.round(state.pauseMinutes * 1.25), PACING.maxPauseMinutes)
      : PACING.firstPauseMinutes;
    return {
      gapSeconds: round1(Math.min(Math.max(state.gapSeconds, base) * 1.3, PACING.maxGapSeconds)),
      pauseMinutes,
      sleepMinutes: pauseMinutes,
      reason: "blocked-pause",
    };
  }

  if (outcome.checked > 0 && outcome.errors >= outcome.checked * 0.8) {
    return { ...state, sleepMinutes: PACING.errorMinutes, reason: "errors" };
  }

  if (outcome.blocked > 0) {
    return {
      gapSeconds: round1(Math.min(Math.max(state.gapSeconds, base) * 1.2, PACING.maxGapSeconds)),
      pauseMinutes: 0,
      sleepMinutes: 0,
      reason: "slow-down",
    };
  }

  return { gapSeconds: round1(Math.max(base, state.gapSeconds * 0.9)), pauseMinutes: 0, sleepMinutes: 0, reason: "ok" };
}

/**
 * Bekçinin zamanı KONTROL (mevcut ilanları doğrulama) ve KEŞİF (yeni ilan çekme) arasında bölünür. Varsayılan keşif payı %10.
 * Kontrol verimliyken (arşive giden ya da fiyatı değişen ilan çoksa) böyle kalır; kontrol edilen ilanların neredeyse hiçbiri
 * değişmiyorsa (<%1) zaman boşa gidiyordur, pay otomatik olarak %50'ye kadar çıkar. Aradaki oranlarda doğrusal geçiş.
 */
export const DISCOVERY_SHARE = { min: 0.1, max: 0.5, busyRate: 0.08, idleRate: 0.01 } as const;

export function discoveryShare(changeRate: number | null): number {
  if (changeRate === null || !Number.isFinite(changeRate)) return DISCOVERY_SHARE.min;
  const { min, max, busyRate, idleRate } = DISCOVERY_SHARE;
  const t = Math.min(1, Math.max(0, (busyRate - changeRate) / (busyRate - idleRate)));
  return Math.round((min + (max - min) * t) * 1000) / 1000;
}

/** Son kontrollerin kayan penceresi: toplam kontrol sayısı `windowSize`ı geçince en eski partiler atılır. */
export class ChangeWindow {
  private batches: Array<{ checked: number; changed: number }> = [];
  constructor(private readonly windowSize = 400, private readonly minChecks = 150) {}

  add(checked: number, changed: number) {
    if (checked <= 0) return;
    this.batches.push({ checked, changed });
    let total = this.batches.reduce((s, b) => s + b.checked, 0);
    while (this.batches.length > 1 && total - this.batches[0].checked >= this.windowSize) {
      total -= this.batches[0].checked;
      this.batches.shift();
    }
  }

  /** Değişen / kontrol edilen; yeterli veri yoksa null (varsayılan pay kullanılır). */
  rate(): number | null {
    const checked = this.batches.reduce((s, b) => s + b.checked, 0);
    if (checked < this.minChecks) return null;
    return this.batches.reduce((s, b) => s + b.changed, 0) / checked;
  }
}
