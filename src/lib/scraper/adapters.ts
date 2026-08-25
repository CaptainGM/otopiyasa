import { resolveCarImage, applySeedImages } from "@/lib/car-images";
import {
  extractArabamListingHrefs,
  fetchPageHtml,
  fetchPageHtmlWithBrowser,
  parseArabamDetailHtml,
  parseSahibindenHtml,
} from "@/lib/scraper/browser-scrape";
import { scrapeOtomerkeziListings } from "@/lib/scraper/otomerkezi";
import { reportProgress } from "@/lib/scraper/progress";
import { ScrapedListing, ScrapeAdapter, OnListing } from "@/lib/scraper/types";
import { seedCars } from "@/lib/seed-data";
import { Car } from "@/models/Car";


const SCRAPE_CONCURRENCY = Math.max(1, Number(process.env.SCRAPE_CONCURRENCY) || 4);


const COLLECT_CONCURRENCY = Math.max(
  1,
  Number(process.env.SCRAPE_COLLECT_CONCURRENCY) || SCRAPE_CONCURRENCY * 2
);


function arabamIdFromHref(href: string): string | null {
  return href.match(/(\d+)\/?$/)?.[1] ?? null;
}


async function mapPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
}

function enrichListing(listing: ScrapedListing): ScrapedListing {
  const resolvedCover = resolveCarImage(listing.brand, listing.features.bodyType, listing.imageUrl);
  return {
    ...listing,
    imageUrl: resolvedCover,
    images: Array.from(
      new Set([resolvedCover, ...(listing.images || []).filter(Boolean)])
    ),
    damageFlag: listing.damageFlag || false,
    location: listing.location || undefined,
  };
}

async function scrapeWithFallback(
  url: string,
  parser: (html: string, limit: number) => ScrapedListing[],
  label: string,
  limit = 12
) {
  const direct = await fetchPageHtml(url);
  let html = direct.html;

  if (!direct.ok) {
    html = await fetchPageHtmlWithBrowser(url);
  }

  let listings = parser(html, limit);
  if (listings.length === 0 && direct.ok) {
    html = await fetchPageHtmlWithBrowser(url);
    listings = parser(html, limit);
  }

  if (listings.length === 0) {
    throw new Error(`${label} ilanları okunamadı. Site yapısı değişmiş olabilir.`);
  }

  return listings.map(enrichListing);
}

export const sahibindenAdapter: ScrapeAdapter = {
  id: "sahibinden",
  label: "Sahibinden.com",
  async scrape(query, limit = 12, onListing) {
    const url = `https://www.sahibinden.com/otomobil?query_text=${encodeURIComponent(query)}`;
    
    const listings = await scrapeWithFallback(url, parseSahibindenHtml, "Sahibinden", limit);
    for (const listing of listings) await onListing(listing);
    return { fetched: listings.length };
  },
};


const POPULAR_BRANDS = [
  
  "Volkswagen", "Renault", "Fiat", "Ford", "Opel", "Toyota", "Hyundai", "Honda",
  "Peugeot", "Citroen", "Dacia", "Nissan", "Kia", "Skoda", "Seat", "Suzuki",
  "Mazda", "Mitsubishi", "Chevrolet",
 
  "Tofaş", "Daewoo", "Anadol", "Abarth",
  
  "Mercedes-Benz", "BMW", "Audi", "Volvo", "Mini", "Land Rover", "Range Rover",
  "Jaguar", "Porsche", "Lexus", "Infiniti", "Jeep", "Alfa Romeo", "Cupra",
  "DS Automobiles", "Smart", "Cadillac", "Genesis", "Saab",
  
  "Togg", "BYD", "MG", "Chery", "Skywell", "DFSK",
  "Geely", "Omoda", "Jaecoo", "Leapmotor", "JAC", "Haval", "Great Wall",
  
  "Subaru", "SsangYong", "Isuzu", "Tesla", "Lada", "Daihatsu", "Chrysler",
  "Dodge", "Lancia", "Rover", "Proton", "Tata", "Mahindra", "Aixam", "Hummer",
  
  "Maserati", "Bentley", "Ferrari", "Lamborghini", "Aston Martin",
  "Rolls-Royce", "McLaren",
];


export function arabamBrandSlug(brand: string): string {
  return brand
    .toLocaleLowerCase("tr-TR")
    .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i")
    .replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}


async function hrefsFromUrl(url: string): Promise<string[]> {
  const direct = await fetchPageHtml(url);
  let hrefs = extractArabamListingHrefs(direct.ok ? direct.html : "", 30);
  if (hrefs.length === 0) {
    const html = await fetchPageHtmlWithBrowser(url);
    hrefs = extractArabamListingHrefs(html, 30);
  }
  return hrefs;
}


const resolvedBaseCache = new Map<string, string>();

async function resolveArabamBase(slug: string): Promise<string> {
  const cached = resolvedBaseCache.get(slug);
  if (cached) return cached;

  const probeUrl = `https://www.arabam.com/ikinci-el/otomobil/${slug}`;
  let base = probeUrl;
  try {
    const probe = await fetchPageHtml(probeUrl);
    
    if (probe.ok && probe.finalUrl.includes("/ikinci-el/")) {
      base = probe.finalUrl.split("?")[0];
    }
  } catch {
    
  }
  resolvedBaseCache.set(slug, base);
  return base;
}

async function fetchArabamSearchHrefs(searchText: string, page: number): Promise<string[]> {
  const isBrand = searchText.toLowerCase() !== "otomobil";


  if (isBrand) {
    const base = await resolveArabamBase(arabamBrandSlug(searchText));
    const brandHrefs = await hrefsFromUrl(`${base}?page=${page}`);
    if (brandHrefs.length > 0) return brandHrefs;
  }

  const searchUrl = `https://www.arabam.com/ikinci-el/otomobil?searchText=${encodeURIComponent(searchText)}&page=${page}`;
  return hrefsFromUrl(searchUrl);
}


export function arabamModelSlug(brand: string, model: string): string {
  return `${arabamBrandSlug(brand)}-${arabamBrandSlug(model)}`;
}


export async function collectArabamHrefsForModel(
  brand: string,
  model: string,
  pages: number
): Promise<string[]> {
  const modelSlug = arabamModelSlug(brand, model);
  const base = await resolveArabamBase(modelSlug);

  
  const lastSegment = base.split("?")[0].split("/").filter(Boolean).pop() || "";
  if (lastSegment !== modelSlug) return [];

  const hrefs = new Set<string>();

  for (let page = 1; page <= pages; page++) {
    let found: string[] = [];
    try {
      found = await hrefsFromUrl(`${base}?page=${page}`);
    } catch {
      break;
    }
    if (found.length === 0) break;
    const before = hrefs.size;
    found.forEach((h) => hrefs.add(h));
    
    if (hrefs.size === before) break;
  }

  return [...hrefs];
}


async function collectArabamHrefsSingleQuery(query: string, limit: number): Promise<string[]> {
  const hrefs = await fetchArabamSearchHrefs(query, 1);
  if (hrefs.length === 0) {
    throw new Error("Arabam ilanları okunamadı. Site yapısı değişmiş olabilir.");
  }
  return hrefs.slice(0, limit);
}


async function collectArabamHrefsAcrossBrands(
  targetCount: number,
  brands: string[] = POPULAR_BRANDS,
  perBrandPages = 12
): Promise<string[]> {
  const hrefs = new Set<string>();
  
  const exhausted = new Set<string>();
  let scanned = 0;
  const totalSlots = perBrandPages * brands.length;

  
  for (let page = 1; page <= perBrandPages; page++) {
    if (hrefs.size >= targetCount) break;
    const active = brands.filter((b) => !exhausted.has(b));
    if (active.length === 0) break;

    await mapPool(active, COLLECT_CONCURRENCY, async (brand) => {
      if (hrefs.size >= targetCount) return;

      try {
        const found = await fetchArabamSearchHrefs(brand, page);
        if (found.length === 0) {
          exhausted.add(brand); 
          return;
        }
        
        let fresh = 0;
        for (const href of found) {
          if (!hrefs.has(href)) {
            hrefs.add(href);
            fresh += 1;
          }
        }
        
        if (fresh === 0) exhausted.add(brand);
      } catch {
        exhausted.add(brand);
      } finally {
        scanned += 1;
        reportProgress(`1/2 Tarama: ${brand} sf.${page} (${hrefs.size} link)`, scanned, totalSlots);
      }
    });
  }

  if (hrefs.size === 0) {
    throw new Error("Arabam ilanları okunamadı. Site yapısı değişmiş olabilir.");
  }

  return Array.from(hrefs).slice(0, targetCount);
}


async function fetchAndSaveArabamDetails(
  hrefs: string[],
  onListing: OnListing,
  skipExisting = true,
  onGone?: (href: string) => void
): Promise<number> {
  let toFetch = hrefs;

  if (skipExisting && hrefs.length > 0) {
    const wanted = [...new Set(hrefs.map(arabamIdFromHref).filter(Boolean))].map(
      (id) => `arabam-${id}`
    );
    const existing = new Set(
      (
        await Car.find({ externalId: { $in: wanted } }, { externalId: 1 }).lean<
          { externalId: string }[]
        >()
      ).map((d) => d.externalId)
    );
    toFetch = hrefs.filter((h) => {
      const id = arabamIdFromHref(h);
      return id && !existing.has(`arabam-${id}`);
    });
    reportProgress(
      `2/2 ${hrefs.length - toFetch.length} mevcut atlandı, ${toFetch.length} yeni ilan çekiliyor`,
      0,
      toFetch.length
    );
  }

  let fetched = 0;
  let done = 0;
  await mapPool(toFetch, SCRAPE_CONCURRENCY, async (href) => {
    const listingUrl = `https://www.arabam.com${href}`;
    try {
      const detail = await fetchPageHtml(listingUrl);
      if (detail.ok) {
        const listing = parseArabamDetailHtml(detail.html, listingUrl);

        if (listing) {
          await onListing(enrichListing(listing));
          fetched += 1;
        }
      } else if (detail.status === 404 || detail.status === 410) {
 
        onGone?.(href);
      }
    } catch {

    } finally {
      done += 1;
      reportProgress("2/2 İlan çekiliyor ve kaydediliyor", done, toFetch.length);
    }
  });
  return fetched;
}

async function scrapeArabamListings(
  query: string,
  limit: number,
  onListing: OnListing
): Promise<number> {
  const hrefs =
    limit > 20
      ? await collectArabamHrefsAcrossBrands(limit)
      : await collectArabamHrefsSingleQuery(query, limit);

  const fetched = await fetchAndSaveArabamDetails(hrefs, onListing);
  if (fetched === 0) {
    throw new Error("Arabam ilan detayları okunamadı. Site yapısı değişmiş olabilir.");
  }
  return fetched;
}


export async function scrapeArabamForBrands(
  brands: string[],
  perBrandPages: number,
  onListing: OnListing
): Promise<number> {
  if (brands.length === 0) return 0;
  
  const hrefs = await collectArabamHrefsAcrossBrands(Number.MAX_SAFE_INTEGER, brands, perBrandPages);
  return fetchAndSaveArabamDetails(hrefs, onListing);
}


export async function refetchArabamDetails(
  hrefs: string[],
  onListing: OnListing,
  onGone?: (href: string) => void
): Promise<number> {
  return fetchAndSaveArabamDetails(hrefs, onListing, false, onGone);
}

export async function scrapeArabamForModels(
  segments: { brand: string; model: string }[],
  perModelPages: number,
  onListing: OnListing,
  maxListings = Number.MAX_SAFE_INTEGER
): Promise<number> {
  if (segments.length === 0) return 0;

  
  const seen = new Set<string>(); 
  let fetched = 0;

  for (const [index, segment] of segments.entries()) {
    if (fetched >= maxListings) break;

    reportProgress(
      `Model taraması: ${segment.brand} ${segment.model} (${fetched} ilan kaydedildi)`,
      index + 1,
      segments.length
    );

    let hrefs: string[] = [];
    try {
      hrefs = await collectArabamHrefsForModel(segment.brand, segment.model, perModelPages);
    } catch {
      continue; 
    }

    const fresh = hrefs.filter((h) => !seen.has(h));
    fresh.forEach((h) => seen.add(h));
    if (fresh.length === 0) continue;

   
    fetched += await fetchAndSaveArabamDetails(fresh, onListing);
  }

  return fetched;
}

export { POPULAR_BRANDS };

export const arabamAdapter: ScrapeAdapter = {
  id: "arabam",
  label: "Arabam.com",
  async scrape(query, limit = 12, onListing) {
    const fetched = await scrapeArabamListings(query, limit, onListing);
    return { fetched };
  },
};

export const otomerkeziAdapter: ScrapeAdapter = {
  id: "otomerkezi",
  label: "Otomerkezi.net",
  async scrape(_query, limit = 12, onListing) {
    const fetched = await scrapeOtomerkeziListings(limit, (listing) =>
      onListing(enrichListing(listing))
    );
    return { fetched };
  },
};

export const demoImportAdapter: ScrapeAdapter = {
  id: "demo",
  label: "Demo kaynak (geliştirme)",
  async scrape(_query, _limit, onListing) {
    const cars = applySeedImages(seedCars);
    const listings = cars.map((car, index) => ({
      externalId: `demo-${index + 1}`,
      sourceSite: index % 2 === 0 ? "sahibinden" : "arabam",
      listingUrl:
        index % 2 === 0
          ? `https://www.sahibinden.com/ilan/demo-${index + 1}`
          : `https://www.arabam.com/ilan/demo-${index + 1}`,
      title: car.title,
      brand: car.brand,
      model: car.model,
      year: car.year,
      price: car.price,
      mileage: car.mileage,
      city: car.city,
      description: car.description,
      imageUrl: car.imageUrl,
      features: car.features,
    })) as ScrapedListing[];

    for (const listing of listings) await onListing(listing);
    return { fetched: listings.length };
  },
};
