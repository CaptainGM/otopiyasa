/**
 * Arabam arka plan doğrulayıcısının (scripts/arabam-bekci.ts) hız kararı.
 *
 * Her partiden (≈20 ilan) sonra sonuca bakılır: engel yoksa ilanlar arası bekleme yavaşça temel
 * değere iner; engel gelirse bekleme uzar; art arda engel (ya da partinin büyük kısmı engel) gelirse
 * doğrulayıcı uzun bir mola verir ve molayı her seferinde ikiye katlar. Böylece Cloudflare hız sınırı
 * görülünce ısrar edilmez, engel kalkınca kendiliğinden devam edilir.
 */
export const PACING = {
  /**
   * İlanlar arası hedef bekleme (sn); ±%25 oynar. 8 Eki 2026'da 10'dan 8'e indirildi (%25 daha hızlı): son 6 günde günde 2–6 engel
   * görüldü, hiç uzun mola gerekmedi. Engel artarsa bekleme kendiliğinden uzar ve mola verilir; yine de sık mola görülürse 10'a dön.
   */
  baseGapSeconds: 8,
  maxGapSeconds: 40,
  /** İlk engel molası (dk); sonraki her engelde iki katına çıkar. */
  firstPauseMinutes: 15,
  maxPauseMinutes: 120,
  /** Sırada doğrulanacak ilan yokken (hepsi son 6 saatte denenmiş) bekleme. */
  idleMinutes: 10,
  /** Parti çoğunlukla hata verdiyse (internet/tarayıcı sorunu) bekleme. */
  errorMinutes: 5,
} as const;

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

export function planNextStep(state: PacingState, outcome: BatchOutcome): PacingPlan {
  const base = PACING.baseGapSeconds;

  if (outcome.checked === 0 && !outcome.paused) {
    return { ...state, sleepMinutes: PACING.idleMinutes, reason: "idle" };
  }

  const heavyBlock = outcome.paused || (outcome.checked > 0 && outcome.blocked >= Math.max(3, outcome.checked * 0.25));
  if (heavyBlock) {
    const pauseMinutes = state.pauseMinutes > 0 ? Math.min(state.pauseMinutes * 2, PACING.maxPauseMinutes) : PACING.firstPauseMinutes;
    return {
      gapSeconds: round1(Math.min(Math.max(state.gapSeconds, base) * 1.5, PACING.maxGapSeconds)),
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
      gapSeconds: round1(Math.min(Math.max(state.gapSeconds, base) * 1.3, PACING.maxGapSeconds)),
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
 * (8 Eki 2026'da bekçinin kontrol ettiği ilanların ~%27'si arşive gidiyordu: bugün pay %10'da kalır.)
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
