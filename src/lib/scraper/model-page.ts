/**
 * ARABAM MODEL SAYFASI: nadir model taramasının "bu sayfadan ne çıktı, o aile ne zaman yeniden denensin" kararı. Eskiden her boş ya da
 * alakasız sayfa "kaynakta tükendi" sayılıp aileyi 14 gün kilitliyordu; ölçümde üç ayrı yanlış sinyal vardı:
 *  - Model adresi kaynakta ayrı bir sayfa değil: "audi-a7" markanın genel sayfasına ("audi"), "hyundai-ioniq" kardeş modele
 *    ("hyundai-ioniq6") yönleniyor. Tarama markanın rastgele ilanlarını çekiyor, aile sayısı artmıyor, aile kilitleniyordu.
 *  - Engel / geçici hata: liste sayfası ilansız dönünce (ağ hatası, Cloudflare'ın boş sayfası) aile "tükendi" yazılıyordu.
 *  - Gerçekten boş sayfa (kaynakta o an ilanı kalmamış model) ile yukarıdakileri ayıran bir işaret yoktu.
 */
export type QuotaOutcome =
  /** Kota doldu. */
  | "satisfied"
  /** Kaynakta bu sayfadan çekilecek başka ilan yok (hepsi bizde). */
  | "exhausted"
  /** Aranan sayfalar yetmedi: kaynakta daha fazlası var. */
  | "more"
  /** Model adresi başka bir sayfaya yönleniyor: model sayfası yok. */
  | "unavailable"
  /** Gerçek bir model sayfası, ama içinde ilan yok (kaynakta o an ilanı kalmamış). */
  | "empty"
  /** Sayfa okunamadı ya da engel olabilir: sonuç belirsiz. */
  | "unknown";

/** Adresin son yol parçası ("…/otomobil/audi-a7?page=2" → "audi-a7"). */
export function lastSlug(url: string): string {
  let path = url;
  try {
    path = new URL(url, "https://www.arabam.com").pathname;
  } catch {
    path = url.split("?")[0];
  }
  return path.split("/").filter(Boolean).pop() || "";
}

/**
 * İstenen model sayfası mı yoksa kaynak başka bir sayfaya mı yönlendirdi? Daraltan yönlendirme kabul edilir ("mercedes-benz-190" →
 * "mercedes-benz-190-190-d": aynı modelin alt sayfası); markanın genel sayfasına ("audi") ya da kardeş modele ("hyundai-ioniq6") yönlenme
 * kabul edilmez.
 */
export function isRequestedModelPage(requestedSlug: string, finalUrl: string): boolean {
  const last = lastSlug(finalUrl);
  return last === requestedSlug || last.startsWith(`${requestedSlug}-`);
}

/** Gerçek bir Arabam liste sayfası mı (Cloudflare / hata sayfası değil)? Ölçüm: ilansız bile 500 KB civarı ve başlığında site adı geçer. */
export function isRealListPage(html: string): boolean {
  if (!html || html.length < 150_000) return false;
  const title = /<title>([^<]*)<\/title>/i.exec(html.slice(0, 12_000))?.[1] ?? "";
  // "İkinci El" başındaki noktalı İ küçük harfe katlanmadığı için sözcüklerin ilk harfi desene alınmaz.
  return /arabam|kinci el|2\. el|atılık|lanları/i.test(title);
}

export type AttemptReason = QuotaOutcome | "mismatch" | "sitemap";

export interface AttemptFacts {
  outcome: QuotaOutcome;
  /** Bu denemede kaydedilen yeni ilan sayısı. */
  added: number;
  /** Kaynakta bulunan, bizde olmayan ilan sayısı (kaydedilmeye çalışılan). */
  fresh: number;
  /** Aile adedi önce / sonra (ölçülebildiyse). */
  before?: number;
  after?: number;
}

export const RETRY_DAYS = { more: 3, exhausted: 14, mismatch: 14, unavailable: 7, empty: 7, unknown: 1, satisfied: 0, sitemap: 7 } as const;

/**
 * Denemenin sonucu ve ailenin kaç gün sonra yeniden aranacağı. Kural sırası önemli: önce "sayfa güvenilir değil" durumları, sonra
 * eklenen ilanların aileyi artırıp artırmadığı, en son kaynakta kalan ilan.
 */
export function judgeAttempt(facts: AttemptFacts): { reason: AttemptReason; retryDays: number } {
  const { outcome, added, fresh, before, after } = facts;
  if (outcome === "unavailable") return { reason: "unavailable", retryDays: RETRY_DAYS.unavailable };
  if (outcome === "unknown") return { reason: "unknown", retryDays: RETRY_DAYS.unknown };
  if (outcome === "empty") return { reason: "empty", retryDays: RETRY_DAYS.empty };
  // Kaynakta bizde olmayan ilan görüldü ama hiçbiri kaydedilemedi: ilan sayfaları engellenmiş olabilir, "tükendi" demek yanlış.
  if (fresh > 0 && added === 0) return { reason: "unknown", retryDays: RETRY_DAYS.unknown };
  // Eklenen ilanlar bu ailenin sayısını artırmadı (başka model adıyla kaydoldu): aynı denemeyi tekrarlamanın anlamı yok.
  if (added > 0 && before !== undefined && after !== undefined && after - before < added * 0.5) {
    return { reason: "mismatch", retryDays: RETRY_DAYS.mismatch };
  }
  if (outcome === "satisfied") return { reason: "satisfied", retryDays: RETRY_DAYS.satisfied };
  if (outcome === "exhausted") return { reason: "exhausted", retryDays: RETRY_DAYS.exhausted };
  return { reason: "more", retryDays: RETRY_DAYS.more };
}

/** Bekleme gerekçesinin yönetim panelinde görünen kısa Türkçe açıklaması. */
export function reasonLabel(reason: AttemptReason | undefined): string {
  switch (reason) {
    case "satisfied":
      return "kademe dolduruldu";
    case "more":
      return "kaynakta daha fazlası var";
    case "exhausted":
      return "kaynakta çekilecek yeni ilan kalmadı";
    case "mismatch":
      return "çekilen ilanlar başka model adıyla kaydoldu";
    case "unavailable":
      return "kaynakta model sayfası yok (markanın sayfasına yönleniyor)";
    case "empty":
      return "kaynak sayfası boş (katalog eski olabilir)";
    case "unknown":
      return "belirsiz: sayfa okunamadı ya da engel var";
    case "sitemap":
      return "site haritasından arandı";
    default:
      return "";
  }
}
