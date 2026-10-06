/**
 * Arabam ilanlarından bekçinin henüz hiç doğrulamadığı (lastVerifiedAt hiç yazılmamış) aktif olanlar.
 * Yönetim panelindeki sayı kartı, bekçi kartı ve liste sayfası aynı süzgeci kullanır ki rakamlar tutsun.
 */
export const UNVERIFIED_ARABAM_FILTER = {
  sourceSite: "arabam",
  status: "active",
  lastVerifiedAt: { $exists: false },
} as const;

export const UNVERIFIED_PAGE_SIZE = 20;

/** Listede gösterilen alanlar (web sayfası ve mobil API aynısını kullanır). */
export const UNVERIFIED_PROJECTION = {
  title: 1,
  brand: 1,
  model: 1,
  year: 1,
  price: 1,
  city: 1,
  listingUrl: 1,
  createdAt: 1,
  lastVerifyAttemptAt: 1,
  lastVerifyStatus: 1,
} as const;

/** Listede "neden hâlâ doğrulanmadı" açıklaması. */
export function describeVerifyStatus(status?: string | null, attemptedAt?: Date | string | null): string {
  if (!attemptedAt) return "sırada (henüz denenmedi)";
  switch (status) {
    case "gone-held":
      return "kaynakta kaldırılmış görünüyor; sıradaki denemede arşive alınacak";
    case "blocked":
      return "bot engeline takıldı, tekrar denenecek";
    case "error":
      return "yanıt anlaşılamadı, tekrar denenecek";
    default:
      return "denendi, sonuç bekleniyor";
  }
}
