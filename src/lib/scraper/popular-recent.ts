/**
 * POPÜLER AİLELER: 2020 ve sonrası ilanların toplanması. Piyasa fiyatını (emsal, adil değer) doğru çıkarmak için çok ilanı olan popüler
 * modellerin yeni model yıllarında da yeterli ilan gerekir. Nadir model taraması bu aileleri (100+ ilan) hiç büyütmüyordu.
 *
 * Hedef aile başına "en az N yeni ilan" (yıl ≥ minYear). Liste sayfası yılı gösterdiği için eski ilanların detay sayfası açılmaz.
 */

/** Bu kadar ilanı olan aileler "popüler" sayılır. */
export const POPULAR_FAMILY_MIN = 100;
/** Bir turda bir aileye en çok bu kadar yeni ilan eklenir (aile dengeli büyür). */
export const RECENT_ROUND_CAP = 60;

export interface FamilyStanding {
  brand: string;
  familyKey: string;
  label: string;
  /** Aktif ilan sayısı (tüm yıllar). */
  total: number;
  /** Aktif ilanlardan minYear ve sonrası olanlar. */
  recent: number;
  /** Kaynağın model sayfası yolu (katalogdan), yoksa ad çözülür. */
  path?: string;
}

export interface RecentTarget extends FamilyStanding {
  /** Bu turda aranacak yeni ilan sayısı (hedef − mevcut, tur başına üst sınırla). */
  quota: number;
}

/**
 * Hedefi eksik popüler aileleri, en az ilanlıdan başlayıp en popülere doğru seçer (yeni nesil ilanı en az olan aileler önce
 * tamamlanır; hedefi tutanlar her turda otomatik düşer, böylece çalışmalar birikerek en popülerlere ulaşır). [blocked]: son
 * denemesi "bekle" dediği için bu turda atlananlar (aile kimliği: "marka::aileAnahtarı"). [roundCap]: aileye bu turda en çok
 * kaç yeni ilan (tam çekimde büyük aileler için yüksek tutulur).
 */
export function planPopularRecent(
  families: FamilyStanding[],
  targetRecent: number,
  maxFamilies: number,
  blocked: ReadonlySet<string> = new Set(),
  roundCap = RECENT_ROUND_CAP
): RecentTarget[] {
  // Marka toplamı: eşitlikte az ilanlı markanın (ör. Porsche) modeli, kalabalık markanın (ör. Hyundai) modelinden önce gelir.
  const brandTotal = new Map<string, number>();
  for (const f of families) brandTotal.set(f.brand, (brandTotal.get(f.brand) ?? 0) + f.total);
  return families
    .filter((f) => f.recent < targetRecent && !blocked.has(`${f.brand}::${f.familyKey}`))
    .sort(
      (a, b) =>
        a.recent - b.recent ||
        a.total - b.total ||
        (brandTotal.get(a.brand) ?? 0) - (brandTotal.get(b.brand) ?? 0) ||
        a.label.localeCompare(b.label, "tr")
    )
    .slice(0, maxFamilies)
    .map((f) => ({ ...f, quota: Math.min(targetRecent - f.recent, roundCap) }));
}
