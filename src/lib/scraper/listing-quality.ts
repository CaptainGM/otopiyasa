import { Car } from "@/models/Car";
import { archiveListings } from "@/lib/scraper/listing-lifecycle";

/**
 * GALERİ ŞARTI: bu kaynakların ilanları liste sayfasında tek fotoğrafla gelir; gerçek galeri ve
 * hasar bilgisi ilanın kendi kaydından okunur. Detayı okunup yine de galerisi çıkmayan ilan
 * (kaynakta galeri yok ya da sayfa hiç açılmıyor) eksik ve güvenilmez görünür; yayında tutulmaz.
 * Arşive taşınır (silinmez: fiyat geçmişi piyasa ortalaması için kalır) ve envanter senkronu,
 * liste sayfası yine tek fotoğraf verdiği sürece onu geri açmaz.
 */
export const GALLERY_REQUIRED_SOURCES = ["carvak", "dod", "otomerkezi"] as const;

export const INCOMPLETE_REASON_PREFIX = "Eksik ilan";

export const incompleteReason = (source: string) => `${INCOMPLETE_REASON_PREFIX}: ${source} galerisi tamamlanamadı`;

export const isGalleryRequired = (source?: string | null) =>
  (GALLERY_REQUIRED_SOURCES as readonly string[]).includes(source || "");

/** Galeri şartı olan kaynakta en fazla bir fotoğrafı olan ilan. */
export const lacksGallery = (source: string | undefined | null, images?: readonly string[] | null) =>
  isGalleryRequired(source) && (images?.length ?? 0) <= 1;

/** Arşive "eksik" olduğu için taşınmış mı (satıldığı için taşınanlardan ayırmak için). */
export const isIncompleteRemoval = (reason?: string | null) => (reason || "").startsWith(INCOMPLETE_REASON_PREFIX);

export interface IncompleteReport {
  /** Kaynak başına bulunan ve arşive alınan (ya da alınacak) ilan sayısı. */
  bySource: Record<string, number>;
  total: number;
  archived: number;
}

/**
 * Detayı en az bir kez okunmuş ama galerisi hâlâ tek fotoğraf olan ilanları bulur; `apply`
 * verilirse arşive taşır. Okunmamış ilanlara dokunmaz (önce detay tamamlayıcı denesin).
 */
export async function archiveIncompleteGalleries(options: { apply?: boolean; source?: string } = {}): Promise<IncompleteReport> {
  const sources = options.source ? [options.source].filter(isGalleryRequired) : [...GALLERY_REQUIRED_SOURCES];
  const docs = await Car.find({
    sourceSite: { $in: sources },
    status: "active",
    "images.1": { $exists: false },
    detailCheckedAt: { $exists: true },
  })
    .select("_id sourceSite")
    .lean<Array<{ _id: unknown; sourceSite: string }>>();

  const report: IncompleteReport = { bySource: {}, total: docs.length, archived: 0 };
  for (const d of docs) report.bySource[d.sourceSite] = (report.bySource[d.sourceSite] || 0) + 1;
  if (!options.apply) return report;

  for (const source of Object.keys(report.bySource)) {
    const ids = docs.filter((d) => d.sourceSite === source).map((d) => d._id as string);
    report.archived += await archiveListings(ids, incompleteReason(source));
  }
  return report;
}
