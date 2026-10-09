import { hrefFromUrl, listSitemapFiles, streamSitemapFile } from "@/lib/scraper/arabam-sitemap";

/**
 * MODEL SAYFASI OLMAYAN AİLELER İÇİN SİTE HARİTASI YOLU. Kaynakta bazı model adresleri ("audi-a7", "subaru-levorg", "byd-seal-u-ev")
 * markanın genel sayfasına yönleniyor; model sayfası gezilemeyince o modelin ilanlarına liste sayfasından ulaşılamıyor. Ama her ilanın
 * adresi marka-model adını taşıyor ("/ilan/galeriden-satilik-audi-a7-3-0-tdi/<başlık>/<no>") ve site haritası (Cloudflare'a takılmaz)
 * bütün ilan adreslerini veriyor: model adıyla eşleşen, bizde olmayan adresler doğrudan ilan sayfasından okunur.
 */
export interface FamilySlugTarget {
  /** Çağıranın kimliği (ör. "Audi::a7"). */
  id: string;
  /** Kaynağın model adresi son parçası ("audi-a7"). */
  slug: string;
  /** En çok kaç yeni ilan alınacak. */
  quota: number;
}

/** "/ilan/galeriden-satilik-audi-a7-3-0-tdi/başlık/123" → "audi-a7-3-0-tdi"; ilan adresi değilse null. */
export function modelPartOfListingUrl(url: string): string | null {
  const path = hrefFromUrl(url) ?? url;
  const seg = /^\/ilan\/([^/]+)\//.exec(path)?.[1];
  if (!seg) return null;
  const i = seg.indexOf("satilik-");
  return i >= 0 ? seg.slice(i + "satilik-".length) : null;
}

/**
 * Model parçasını hedef ailelerden birine bağlar. En uzun eşleşen adres kazanır: "hyundai-ioniq-5-advance" için hem "hyundai-ioniq"
 * hem "hyundai-ioniq-5" adayken ikincisi seçilir; [otherSlugs] hedef olmayan ama ayrı model olan adreslerdir ("ioniq-5" hedef değilse bile
 * "ioniq" hedefinin ilanı saymasın diye eşleşmeyi onlar alır).
 */
export function createFamilyMatcher(targets: FamilySlugTarget[], otherSlugs: Iterable<string>): (modelPart: string) => string | null {
  const owner = new Map<string, string | null>();
  for (const slug of otherSlugs) if (slug) owner.set(slug, null);
  for (const t of targets) if (t.slug) owner.set(t.slug, t.id);

  const targetFirst = new Set(targets.map((t) => t.slug.split("-", 1)[0]));
  const byFirst = new Map<string, string[]>();
  for (const slug of owner.keys()) {
    const first = slug.split("-", 1)[0];
    if (!targetFirst.has(first)) continue; // hedefi olmayan markaların ilanlarına hiç bakılmaz
    (byFirst.get(first) ?? byFirst.set(first, []).get(first)!).push(slug);
  }
  for (const list of byFirst.values()) list.sort((a, b) => b.length - a.length);

  return (modelPart) => {
    const list = byFirst.get(modelPart.split("-", 1)[0]);
    if (!list) return null;
    for (const slug of list) {
      if (modelPart === slug || modelPart.startsWith(`${slug}-`)) return owner.get(slug) ?? null;
    }
    return null;
  };
}

export interface SitemapCandidate {
  id: string;
  num: number;
  href: string;
}

/**
 * Site haritasının tamamını bir kez okuyup hedef ailelerin bizde olmayan en yeni ilanlarını verir (en yeni numara önce; yeni ilan daha
 * çok yayında). [known]: bizdeki Arabam ilan numaraları (her durumda). Tek istekle ~1,3 milyon adres, Cloudflare doğrulaması yok.
 */
export async function collectFamilyCandidates(
  targets: FamilySlugTarget[],
  otherSlugs: Iterable<string>,
  known: ReadonlySet<string>,
  onProgress?: (done: number, total: number, entries: number) => void
): Promise<Map<string, SitemapCandidate[]>> {
  const result = new Map<string, SitemapCandidate[]>(targets.map((t) => [t.id, []]));
  if (targets.length === 0) return result;
  const quotaOf = new Map(targets.map((t) => [t.id, t.quota]));
  const match = createFamilyMatcher(targets, otherSlugs);
  const files = await listSitemapFiles();
  if (files.length === 0) throw new Error("Sitemap dizininde ilan dosyası bulunamadı.");

  let entries = 0;
  for (const [i, file] of files.entries()) {
    await streamSitemapFile(file, (id, _lastmod, url) => {
      entries++;
      if (known.has(id)) return;
      const part = modelPartOfListingUrl(url);
      if (!part) return;
      const owner = match(part);
      if (!owner) return;
      const href = hrefFromUrl(url);
      if (!href) return;
      const list = result.get(owner)!;
      list.push({ id, num: Number(id) || 0, href });
      // Bellek: hedef başına kotanın birkaç katı kadar en yeni aday yeter.
      const cap = Math.max(20, (quotaOf.get(owner) || 0) * 6);
      if (list.length > cap * 2) {
        list.sort((a, b) => b.num - a.num);
        list.length = cap;
      }
    });
    onProgress?.(i + 1, files.length, entries);
    await new Promise((r) => setTimeout(r, 1000));
  }

  for (const [id, list] of result) {
    list.sort((a, b) => b.num - a.num);
    list.length = Math.min(list.length, quotaOf.get(id) || 0);
  }
  return result;
}
