/**
 * Arabam arka plan doğrulayıcısının (scripts/arabam-bekci.ts) hız kararı.
 *
 * Her partiden (≈20 ilan) sonra sonuca bakılır: engel yoksa ilanlar arası bekleme yavaşça temel
 * değere iner; engel gelirse bekleme uzar; art arda engel (ya da partinin büyük kısmı engel) gelirse
 * doğrulayıcı uzun bir mola verir ve molayı her seferinde ikiye katlar. Böylece Cloudflare hız sınırı
 * görülünce ısrar edilmez, engel kalkınca kendiliğinden devam edilir.
 */
export const PACING = {
  /** İlanlar arası hedef bekleme (sn); ±%25 oynar. */
  baseGapSeconds: 10,
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
