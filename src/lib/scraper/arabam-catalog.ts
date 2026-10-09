import { ArabamCatalog, type CatalogModel } from "@/models/ArabamCatalog";
import { fetchPageWithBrowser, isCloudflareChallenge } from "@/lib/scraper/browser-scrape";
import { waitForArabamTurn } from "@/lib/scraper/verify-listing";

/**
 * KAYNAĞIN MARKA / MODEL KATALOĞU
 *
 * Kategori sayfası (örn. /ikinci-el/otomobil) markaları, marka sayfası (örn. /ikinci-el/otomobil/hyundai) o markanın modellerini
 * ilan sayılarıyla "list-item" bağlantıları olarak veriyor; sahibinden gibi "i20 / i20 Active / i20 N" ayrı satırlardır.
 * Hangi adın ayrı model sayılacağı buradan ÖĞRENİLİR (elle liste yok); ilan sayfası çekilmez, kategori başına 1 + marka başına 1 istek.
 */
export const CATALOG_CATEGORIES = ["otomobil", "arazi-suv-pick-up", "minivan-panelvan"] as const;
export type CatalogCategory = (typeof CATALOG_CATEGORIES)[number];

export interface FacetLink {
  /** "/ikinci-el/" sonrası yol: "otomobil/hyundai-i20-n" */
  path: string;
  name: string;
  count: number;
}

const FACET_RE = /<a href="\/ikinci-el\/([^"]+)" class="list-item[^"]*"[^>]*>\s*([^<]*?)\s*<span class="count">\s*([\d.]+)\s*<\/span>/g;

/** Sayfadaki filtre bağlantıları (kategori, marka ya da model satırı) ve yanlarındaki ilan sayısı. */
export function parseFacetLinks(html: string): FacetLink[] {
  const out: FacetLink[] = [];
  for (const m of html.matchAll(FACET_RE)) {
    const name = m[2].replace(/&amp;/g, "&").replace(/&#39;/g, "'").trim();
    if (!name) continue;
    out.push({ path: m[1], name, count: Number(m[3].replace(/\./g, "")) || 0 });
  }
  return out;
}

/** Kategori sayfasındaki markalar: "otomobil/hyundai" → { slug: "hyundai", name: "Hyundai" }. */
export function parseCategoryBrands(links: FacetLink[], category: string): Array<{ slug: string; name: string; count: number }> {
  const re = new RegExp(`^${category}/([a-z0-9-]+)$`);
  return links.flatMap((l) => {
    const m = re.exec(l.path);
    return m ? [{ slug: m[1], name: l.name, count: l.count }] : [];
  });
}

/** İl, yakıt, vites, satıcı filtreleri model değildir. */
const NOT_MODEL = new Set(
  "sahibinden galeriden duz otomatik yari benzin dizel lpg hibrit avrupa anadolu istanbul ankara izmir".split(" ")
);

/** Marka sayfasındaki modeller: "otomobil/hyundai-i20-n" → { name: "i20 N", slug: "hyundai-i20-n" }. */
export function parseBrandModels(links: FacetLink[], category: string, brandSlug: string): CatalogModel[] {
  const re = new RegExp(`^${category}/(${brandSlug}-([a-z0-9-]+))$`);
  const seen = new Set<string>();
  const out: CatalogModel[] = [];
  for (const l of links) {
    const m = re.exec(l.path);
    if (!m || NOT_MODEL.has(m[2]) || seen.has(m[1])) continue;
    seen.add(m[1]);
    out.push({ name: l.name, slug: m[1], count: l.count });
  }
  return out;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export interface CatalogRefreshResult {
  brands: number;
  models: number;
  requests: number;
  blocked: boolean;
  skipped: number;
}

async function fetchLinks(url: string): Promise<{ links: FacetLink[] } | { blocked: true } | { error: string }> {
  try {
    await waitForArabamTurn();
    const res = await fetchPageWithBrowser(url, true);
    if (isCloudflareChallenge(res.html) || res.status === 403 || res.status === 429) return { blocked: true };
    if (res.status >= 400) return { error: `HTTP ${res.status}` };
    return { links: parseFacetLinks(res.html) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Kataloğu yeniler: kategori başına marka listesi, marka başına model listesi. Son [maxAgeDays] gün içinde alınmış marka atlanır
 * (yarıda kalırsa kaldığı yerden sürer). Engel görülürse durur.
 */
export async function refreshArabamCatalog(options: { maxAgeDays?: number; log?: (message: string) => void } = {}): Promise<CatalogRefreshResult> {
  const maxAgeMs = (options.maxAgeDays ?? 14) * DAY_MS;
  const log = options.log || (() => {});
  const result: CatalogRefreshResult = { brands: 0, models: 0, requests: 0, blocked: false, skipped: 0 };

  for (const category of CATALOG_CATEGORIES) {
    const page = await fetchLinks(`https://www.arabam.com/ikinci-el/${category}`);
    result.requests++;
    if ("blocked" in page) {
      result.blocked = true;
      return result;
    }
    if ("error" in page) {
      log(`  ${category}: ${page.error}`);
      continue;
    }
    const brands = parseCategoryBrands(page.links, category);
    log(`📚 ${category}: ${brands.length} marka`);

    for (const brand of brands) {
      const existing = await ArabamCatalog.findOne({ category, brandSlug: brand.slug }).select("fetchedAt models").lean<{ fetchedAt: Date; models: unknown[] }>();
      if (existing && Date.now() - new Date(existing.fetchedAt).getTime() < maxAgeMs) {
        result.skipped++;
        result.brands++;
        result.models += existing.models.length;
        continue;
      }
      const res = await fetchLinks(`https://www.arabam.com/ikinci-el/${category}/${brand.slug}`);
      result.requests++;
      if ("blocked" in res) {
        result.blocked = true;
        return result;
      }
      if ("error" in res) {
        log(`  ${brand.name}: ${res.error}`);
        continue;
      }
      const models = parseBrandModels(res.links, category, brand.slug);
      await ArabamCatalog.updateOne(
        { category, brandSlug: brand.slug },
        { $set: { brand: brand.name, brandCount: brand.count, models, fetchedAt: new Date() } },
        { upsert: true }
      );
      result.brands++;
      result.models += models.length;
      log(`  ${brand.name} (${category}): ${models.length} model`);
    }
  }
  return result;
}
