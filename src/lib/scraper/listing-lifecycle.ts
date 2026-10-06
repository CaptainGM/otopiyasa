import type { Types } from "mongoose";
import { Car } from "@/models/Car";

/**
 * İlan yaşam döngüsü kuralları: bir ilan ne zaman "canlı teyit edildi", ne zaman
 * "arşive taşındı" sayılır.
 *
 * NEDEN BU KADAR TEMKİNLİ: eski doğrulama "anlaşılamayan her yanıtı ölü" kabul
 * ediyordu. Cloudflare engel sayfası, ana sayfaya yönlendirme ya da site adres
 * değişikliği binlerce CANLI ilanı arşive atıyor, keşif taraması aynı ilanları
 * tekrar bulup geri açıyordu (VavaCars/Otomerkezi arşivle→aç döngüsü; Arabam'da
 * arşivde olup hâlâ yayında olan ilanlar). Kurallar:
 *
 *  - GÜÇLÜ kanıt (ilanın kendi adresi 404/410 verdi, ilan başka sayfaya
 *    yönlendi, sayfada "satıldı" yazıyor): tek gözlem yeterli.
 *  - ZAYIF kanıt (tam envanter taramasında görünmedi): en az iki gözlem ve
 *    aralarında en az 6 saat. Sayfalama kayması gibi tek seferlik hatalar
 *    ilanı arşive atamaz.
 *  - Engel/zaman aşımı/anlaşılamayan yanıt: hiçbir zaman ölü sayılmaz.
 *  - Bir partide ölü oranı anormal yüksekse (site değişmiş, engel sayfası
 *    döndürüyor) devre kesici hiçbir şeyi arşivlemez.
 */
export const LIFECYCLE = {
  missingChecksToArchive: 2,
  minMissingSpanMs: 6 * 60 * 60 * 1000,
  breakerRatio: 0.35,
  breakerMinSample: 8,
  /**
   * Ölü oranı yüksek ama aynı partide bu kadar (ve bu oranda) sayfa ilan verisiyle "canlı"
   * okunduysa sınıflandırıcı çalışıyor demektir; oran gerçektir. Otokoç'un eski stokunda
   * satılmış ilanlar birikiyor (en eski 40 ilanın 27'si), sabit oran freni orada hiçbir
   * ilanı arşivletmiyordu.
   */
  breakerMinAlive: 5,
  breakerMinAliveRatio: 0.25,
  /**
   * Gerçek tarayıcıyla açılan Arabam ilan sayfasında "kaldırıldı" kanıtı güçlüdür (kategori sayfasına yönlendirme/404);
   * engel ve bot sayfaları zaten ayrı sınıflanır. Bu yüzden oran aranmaz, partide en az bu kadar CANLI ilan çıkması
   * (tarayıcı ve sınıflandırıcı çalışıyor demektir) yeter. En eski ilanlar çoğunlukla ölü olduğundan oran şartı
   * 27 ilanı arşive almadan günlerce kuyrukta döndürüyordu.
   */
  arabamBreakerMinAlive: 3,
  /** Tam envanter taraması aktif ilanların en az bu oranını bulmalı; yoksa tarama şüphelidir. */
  minCrawlCoverage: 0.5,
  /** Envanterde görünmeyen ilan oranı bunu aşarsa arşivleme yapılmaz. */
  maxMissingRatio: 0.5,
  /** Oranlara dayalı güvenlik kontrolleri bu kadar ilandan azsa uygulanmaz. */
  ratioMinActive: 10,
  /** Arşivlenen ilanda tutulan fotoğraf sayısı: fiyat geri bildirimi için yeter, DB'yi şişirmez. */
  archivedImageLimit: 6,
  /** Doğrulaması engellenen ilan bu süre boyunca kuyrukta atlanır. */
  attemptCooldownMs: 6 * 60 * 60 * 1000,
  /** Açılan ilanın kaynaktaki son kontrolü bundan eskiyse bekçi sırasında öne alınır. */
  priorityStaleMs: 12 * 60 * 60 * 1000,
} as const;

/** Kaynaktan derlenen (kullanıcı ilanı olmayan) kayıtlar. */
export const SCRAPED_SOURCE_FILTER = { sourceSite: { $nin: ["user", "manual", "demo"] } } as const;

export interface MissingState {
  missingSince?: Date | string | null;
  missingChecks?: number | null;
}

/** Bu (zayıf) "yok" gözlemi ilanı arşive taşımalı mı? */
export function shouldArchiveMissing(state: MissingState, now: Date): boolean {
  if (!state.missingSince) return false;
  const checksIncludingThis = (state.missingChecks || 0) + 1;
  const span = now.getTime() - new Date(state.missingSince).getTime();
  return checksIncludingThis >= LIFECYCLE.missingChecksToArchive && span >= LIFECYCLE.minMissingSpanMs;
}

/**
 * Bir doğrulama partisinde ölü oranı güvenilmeyecek kadar yüksek mi? `alive`, aynı partide
 * pozitif kanıtla canlı okunan sayfa sayısıdır (verilmezse yalnızca oran bakılır).
 */
export function breakerTripped(checked: number, gone: number, alive = 0): boolean {
  if (checked < LIFECYCLE.breakerMinSample || gone / checked <= LIFECYCLE.breakerRatio) return false;
  const controlsOk = alive >= LIFECYCLE.breakerMinAlive && alive / checked >= LIFECYCLE.breakerMinAliveRatio;
  return !controlsOk;
}

/** Arabam tek tek ilan doğrulamasında güvenlik freni (bkz. LIFECYCLE.arabamBreakerMinAlive). */
export function arabamBreakerTripped(checked: number, gone: number, alive: number): boolean {
  if (checked < LIFECYCLE.breakerMinSample || gone / checked <= LIFECYCLE.breakerRatio) return false;
  return alive < LIFECYCLE.arabamBreakerMinAlive;
}

/**
 * Tam envanter taramasının sonucuna güvenilebilir mi? Tarama çok az ilan
 * bulduysa ya da aktif ilanların yarısından fazlası "yok" görünüyorsa site
 * değişmiş/engellenmiş olabilir; bu durumda hiçbir ilan "yok" işaretlenmez.
 */
export function inventoryLooksTrustworthy(activeCount: number, seenCount: number, missingCount: number): {
  ok: boolean;
  reason?: string;
} {
  if (seenCount === 0) return { ok: false, reason: "Taramada hiç ilan bulunamadı." };
  if (activeCount < LIFECYCLE.ratioMinActive) return { ok: true };
  if (seenCount < activeCount * LIFECYCLE.minCrawlCoverage) {
    return { ok: false, reason: `Tarama yalnızca ${seenCount} ilan buldu (DB'de ${activeCount} aktif).` };
  }
  if (missingCount > activeCount * LIFECYCLE.maxMissingRatio) {
    return { ok: false, reason: `${missingCount}/${activeCount} ilan kayıp görünüyor; site değişmiş olabilir.` };
  }
  return { ok: true };
}

type Id = Types.ObjectId | string;

/**
 * Kullanıcı ilanı açtığında: kaynakta son kontrolü eski (ya da hiç yok) bir Arabam ilanı bekçinin sırasında öne alınır.
 * Kullanıcı eski fiyatı görmüş olabilir; bekçi kısa süre içinde ilan sayfasını açıp fiyat/km/durumu günceller.
 */
export async function requestPriorityVerify(id: Id, now = new Date()): Promise<boolean> {
  const staleBefore = new Date(now.getTime() - LIFECYCLE.priorityStaleMs);
  const res = await Car.updateOne(
    {
      _id: id,
      sourceSite: "arabam",
      status: "active",
      verifyPriorityAt: { $exists: false },
      $or: [{ lastVerifiedAt: { $exists: false } }, { lastVerifiedAt: { $lt: staleBefore } }],
    },
    { $set: { verifyPriorityAt: now } },
    { timestamps: false }
  );
  return (res.modifiedCount || 0) > 0;
}

/** Kaynakta görülen ilanları "canlı teyit edildi" olarak işaretler (updatedAt'e dokunmadan). */
export async function markSeenAlive(ids: Id[], now = new Date()) {
  if (ids.length === 0) return;
  await Car.updateMany(
    { _id: { $in: ids } },
    {
      $set: { lastVerifiedAt: now, lastVerifyAttemptAt: now },
      $unset: { missingSince: 1, missingChecks: 1, lastVerifyStatus: 1, verifyPriorityAt: 1 },
    },
    { timestamps: false }
  );
}

/** Doğrulama denemesini kaydeder (sonuç belirsiz olsa bile kuyruk ilerlesin diye). */
export async function markVerifyAttempt(ids: Id[], now = new Date(), status?: VerifyAttemptStatus) {
  if (ids.length === 0) return;
  await Car.updateMany(
    { _id: { $in: ids } },
    { $set: { lastVerifyAttemptAt: now, ...(status ? { lastVerifyStatus: status } : {}) }, $unset: { verifyPriorityAt: 1 } },
    { timestamps: false }
  );
}

/** Son doğrulama denemesinin sonucu (yönetim listesinde "neden doğrulanamadı" göstermek için). */
export type VerifyAttemptStatus = "blocked" | "error" | "gone-held";

/**
 * İlanları piyasa arşivine taşır. Silmez: fiyat, km, hasar ve fiyat geçmişi
 * fiyat tahmini/ortalama için saklanır; yalnızca fotoğraf listesi kısaltılır.
 */
export async function archiveListings(ids: Id[], reason: string, now = new Date()): Promise<number> {
  if (ids.length === 0) return 0;
  const res = await Car.updateMany(
    { _id: { $in: ids }, status: { $ne: "removed" }, ...SCRAPED_SOURCE_FILTER },
    {
      $set: { status: "removed", removedAt: now, removedReason: reason.slice(0, 200), lastVerifyAttemptAt: now },
      $unset: { missingSince: 1, missingChecks: 1, needsRecheck: 1, verifyPriorityAt: 1 },
      $push: { images: { $each: [], $slice: LIFECYCLE.archivedImageLimit } },
    }
  );
  return res.modifiedCount || 0;
}

/**
 * Zayıf "kaynakta yok" gözlemlerini işler: yeterince teyit edilenleri arşivler,
 * diğerlerinin sayacını artırır.
 */
export async function recordMissing(
  docs: Array<{ _id: Id } & MissingState>,
  reason: string,
  now = new Date()
): Promise<{ archived: number; marked: number }> {
  const toArchive = docs.filter((d) => shouldArchiveMissing(d, now)).map((d) => d._id);
  const toMark = docs.filter((d) => !shouldArchiveMissing(d, now)).map((d) => d._id);

  const archived = await archiveListings(toArchive, reason, now);
  if (toMark.length > 0) {
    await Car.updateMany(
      { _id: { $in: toMark }, missingSince: { $exists: false } },
      { $set: { missingSince: now } },
      { timestamps: false }
    );
    await Car.updateMany(
      { _id: { $in: toMark } },
      { $inc: { missingChecks: 1 }, $set: { lastVerifyAttemptAt: now } },
      { timestamps: false }
    );
  }
  return { archived, marked: toMark.length };
}
