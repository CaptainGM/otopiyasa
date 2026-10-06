/**
 * Tam envanteri otomatik senkronlanan kurumsal kaynaklar (veritabanı içe aktarmadan; sağlık denetimi de kullanır).
 *
 * İkinciYeni otomatik taramalardan çıkarıldı (2026-10-06): zamanlı açık artırma platformu, liste API'si boş dönüyor
 * (toplam 0 ilan) ve sunucudan HTTP 403 veriyor; hiç ilan gelmemişti. Elle tarama (scrape.bat 19) duruyor.
 */
export const RECONCILE_SOURCES = ["vavacars", "carvak", "otoplus", "otomerkezi", "otokoc", "dod"] as const;
export type ReconcileSource = (typeof RECONCILE_SOURCES)[number];
