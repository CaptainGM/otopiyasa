/**
 * Arabam bağlantı listesinden veritabanında OLMAYAN ilanları seçer (sıra korunur).
 *
 * Seyrek emsal taramasında aday listesi kayıttan önce ilan sayısına (12) kesiliyordu. Bir modelin ilk 12
 * bağlantısı zaten kayıtlıysa o yıl için tek yeni ilan çıkmıyor, tur bütçesi kayıtlı ilanlara harcanıyordu.
 * Bu seçici önce yenileri ayırır; kesme yalnızca yeni adaylar üzerinden yapılır.
 */
export function pickUnknownArabamHrefs(
  hrefs: string[],
  toId: (href: string) => string | null,
  knownExternalIds: ReadonlySet<string>
): string[] {
  const unknown: string[] = [];
  for (const href of hrefs) {
    const id = toId(href);
    if (id && !knownExternalIds.has(`arabam-${id}`)) unknown.push(href);
  }
  return unknown;
}
