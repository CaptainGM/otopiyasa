import { cityToCoords } from "@/lib/city-coords";
import { normalizeBrand, isNonCarBrand } from "@/lib/normalize-brand";
import { reportProgress } from "@/lib/scraper/progress";
import { CrawlReport, ScrapedListing } from "@/lib/scraper/types";
import { Car } from "@/models/Car";

// www.dod.com.tr her isteği dod.com.tr'ye 301 ile yönlendiriyor.
const SITEMAP_URL = "https://dod.com.tr/sitemap.xml";

const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";

interface DodCarSchema {
  "@context"?: string;
  "@type"?: string;
  name?: string;
  brand?: { name?: string };
  model?: string;
  description?: string;
  image?: { url?: string };
  offers?: {
    price?: string | number;
    url?: string;
  };
}

/**
 * Sitemap'teki adresi kullanılabilir hâle getirir. XML içinde `&` karakteri
 * `&amp;` olarak kaçışlanır; ham okununca adres `...s&amp;s-style...` olarak
 * kaydediliyordu (35 ilanda bozuk link). Alan adı da yönlendirmesiz hâline çekilir.
 */
export function normalizeDodUrl(raw: string): string {
  return raw
    .trim()
    .replace(/&amp;/g, "&")
    .replace(/&#38;/g, "&")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/^https?:\/\/www\.dod\.com\.tr/i, "https://dod.com.tr");
}

export function dodExternalIdFromUrl(url: string): string | null {
  const match = url.match(/(\d{6,})$/);
  return match ? `dod-${match[1]}` : null;
}

let cachedDodUrls: string[] = [];
let lastDodSitemapFetch = 0;

/** DOD'un yayındaki tüm araç adresleri (sitemap = güncel envanter). */
export async function fetchDodCarUrls(): Promise<string[]> {
  const now = Date.now();
  if (cachedDodUrls.length > 0 && now - lastDodSitemapFetch < 1000 * 60 * 60) {
    return cachedDodUrls;
  }

  try {
    const res = await fetch(SITEMAP_URL, {
      headers: {
        "User-Agent": MOBILE_UA,
        Accept: "text/xml,application/xml,text/html,*/*",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return [];
    const text = await res.text();
    const urls = [...text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => normalizeDodUrl(m[1]));
    const carUrls = [...new Set(urls.filter((u) => u.includes("/arac-detay/") && dodExternalIdFromUrl(u)))];
    if (carUrls.length > 0) {
      cachedDodUrls = carUrls;
      lastDodSitemapFetch = now;
    }
    return carUrls;
  } catch (err) {
    console.warn("[DOD] Sitemap fetch hatası:", err instanceof Error ? err.message : err);
    return [];
  }
}

/** Verilen DOD araç sayfalarını açıp ilan verisine çevirir. */
export async function scrapeDodDetails(
  items: Array<{ url: string; externalId: string }>,
  onListing: (listing: ScrapedListing) => Promise<void>
): Promise<number> {
  let fetched = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    reportProgress("DOD araçları taranıyor", i + 1, items.length);

    try {
      const res = await fetch(item.url, {
        headers: {
          "User-Agent": MOBILE_UA,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "tr-TR,tr;q=0.9",
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) continue;
      const html = await res.text();

      // JSON-LD Car şemasını yakala
      const ldMatches = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
      let carData: DodCarSchema | null = null;

      for (const m of ldMatches) {
        try {
          const parsed = JSON.parse(m[1]);
          if (parsed["@type"] === "Car") {
            carData = parsed;
            break;
          }
        } catch {}
      }

      if (!carData) continue;

      const rawBrand = carData.brand?.name || "";
      const brand = normalizeBrand(rawBrand);
      if (!brand || isNonCarBrand(brand)) continue;

      const rawModel = (carData.model || "").trim();
      const price = Number(carData.offers?.price) || 0;
      if (price < 50000) continue;

      const desc = carData.description || "";
      // Yıl tespiti (desc: "... 2012 39.028 km ...")
      const yearMatch = desc.match(/\b(19|20)\d{2}\b/);
      const year = yearMatch ? Number(yearMatch[0]) : new Date().getFullYear();

      // Km tespiti
      const kmMatch = desc.match(/([\d.]+)\s*km/i);
      const mileage = kmMatch ? Number(kmMatch[1].replace(/\./g, "")) || 0 : 0;

      // Resim
      const imageUrl = carData.image?.url || "";
      if (!imageUrl || !imageUrl.startsWith("http")) continue;

      // Yakıt & Vites
      // Tahmin; detay okununca aracın kendi kaydındaki yakıtla düzeltilir. "EV" yalnızca ayrı kelimeyse
      // elektrik sayılır ("EVOQUE", "Evolution", "MHEV" eskiden elektrikli görünüyordu).
      let fuelType = "Bilinmiyor";
      if (/TDI|Dizel/i.test(desc)) fuelType = "Dizel";
      else if (/TSI|TFSI|Benzin/i.test(desc)) fuelType = "Benzin";
      else if (/Hibrit|Hybrid|Ibrida|e-TSI|\b[MP]?HEV\b/i.test(desc)) fuelType = "Hibrit";
      else if (/Elektrik/i.test(desc) || /\bEV\b/.test(desc)) fuelType = "Elektrik";

      let transmission = "Bilinmiyor";
      if (/STRONIC|DSG|EDCT|Otomatik|AT\b/i.test(desc)) transmission = "Otomatik";
      else if (/Manuel|MT\b/i.test(desc)) transmission = "Manuel";

      // Şehir tespiti
      let city = "İstanbul";
      const cityMatches = [
        "İstanbul", "Ankara", "İzmir", "Bursa", "Antalya", "Adana", "Konya",
        "Gaziantep", "Kocaeli", "Mersin", "Eskişehir", "Samsun", "Denizli", "Kayseri"
      ];
      for (const c of cityMatches) {
        if (html.includes(c)) {
          city = c;
          break;
        }
      }
      const coords = cityToCoords(city);

      const title = `${brand} ${rawModel} ${year} ${mileage.toLocaleString("tr-TR")} km`.trim();
      const description = `${title} - DOD Doğuş Otomotiv Kurumsal Ekspertizli 2. El. ${city} Doğuş Otomotiv Yetkili Satıcısı. ${transmission} vites, ${fuelType} yakıt.`;

      const listing: ScrapedListing = {
        externalId: item.externalId,
        sourceSite: "dod",
        listingUrl: item.url,
        title,
        brand,
        model: rawModel,
        year,
        price,
        mileage,
        city,
        address: `${city} DOD Doğuş Otomotiv Bayisi`,
        description,
        imageUrl,
        images: [imageUrl],
        damageFlag: false,
        sellerType: "Kurumsal",
        location: coords ? { lat: coords.lat, lng: coords.lng } : undefined,
        features: {
          fuelType,
          transmission,
          bodyType: "Belirtilmemiş",
          color: "Belirtilmemiş",
        },
      };

      await onListing(listing);
      fetched += 1;

      // İstekler arası nazik 200ms nefes
      await new Promise((r) => setTimeout(r, 200));
    } catch {
      continue;
    }
  }

  return fetched;
}

export async function scrapeDodListings(
  limit: number,
  onListing: (listing: ScrapedListing) => Promise<void>,
  skipExisting = true,
  report?: CrawlReport
): Promise<number> {
  const carUrls = await fetchDodCarUrls();
  if (report) {
    report.pages = 1;
    if (carUrls.length > 0) report.endedNaturally = true;
    else report.error = "DOD sitemap okunamadı ya da boş.";
  }
  if (carUrls.length === 0) return 0;

  let candidates = carUrls.map((url) => ({ url, externalId: dodExternalIdFromUrl(url) as string }));

  if (skipExisting) {
    const existingIds = new Set(
      (
        await Car.find(
          { externalId: { $in: candidates.map((u) => u.externalId) } },
          { externalId: 1 }
        ).lean<{ externalId: string }[]>()
      ).map((d) => d.externalId)
    );

    candidates = candidates.filter((c) => !existingIds.has(c.externalId));
  }

  return scrapeDodDetails(candidates.slice(0, limit), onListing);
}
