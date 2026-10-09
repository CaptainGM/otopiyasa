/**
 * ARABAM DOĞRULAMA RİTMİ (scrape.bat 11, scripts/sync-arabam.ts): bir partinin büyük kısmı engel yüzünden okunamadıysa kaynağa vurmayı
 * sürdürmek yerine kendiliğinden dinlenilir (10 → 20 → 40 → 60 dk); engel düzelmezse işlem bırakılır. Eskiden parti hiç ilan okuyamazsa
 * (ya da hiç) kimse fark etmeden her ilan için ~30 sn bekleniyor, kullanıcı pencereyi elle kapatıp açmak zorunda kalıyordu.
 */
/** Parti ilanlarının bu oranı ya da fazlası engel yüzünden okunamadıysa engel molası verilir. */
export const BLOCKED_SHARE = 0.3;
/** Engel molaları art arda bu kadar sürüp düzelmediyse işlem bırakılır. */
export const MAX_BLOCK_STREAK = 6;

export interface BatchFacts {
  /** Sayfası açılmaya çalışılan ilan sayısı. */
  checked?: number;
  /** ... bunlardan engel / ağ hatası yüzünden okunamayanlar. */
  blocked?: number;
  /** Art arda çok engelle parti yarıda bırakıldı. */
  aborted?: boolean;
}

export type BatchVerdict =
  /** Normal parti: engel serisi sıfırlanır. */
  | { kind: "ok"; streak: 0 }
  /** Kuyrukta kontrol edilecek ilan kalmadı (kalanların hepsi son saatlerde denendi). */
  | { kind: "empty"; streak: number }
  /** Engel: [waitMinutes] dinlen, aynı partiyle devam et. */
  | { kind: "blocked"; streak: number; waitMinutes: number }
  /** Engel molalarına rağmen düzelmedi: bırak. */
  | { kind: "give-up"; streak: number };

export const blockWaitMinutes = (streak: number) => Math.min(60, 10 * 2 ** (streak - 1));

/** Bir partinin sonucuna göre sıradaki adım; [streak]: bu partiden önceki art arda engel molası sayısı. */
export function judgeBatch(facts: BatchFacts, streak: number): BatchVerdict {
  const checked = facts.checked ?? 0;
  const blocked = facts.blocked ?? 0;
  if (facts.checked === 0) return { kind: "empty", streak };
  const blockedBatch = !!facts.aborted || (checked > 0 && blocked / checked >= BLOCKED_SHARE);
  if (!blockedBatch) return { kind: "ok", streak: 0 };
  const next = streak + 1;
  if (next > MAX_BLOCK_STREAK) return { kind: "give-up", streak: next };
  return { kind: "blocked", streak: next, waitMinutes: blockWaitMinutes(next) };
}
