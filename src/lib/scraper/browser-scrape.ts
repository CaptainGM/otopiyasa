import * as cheerio from "cheerio";
import { isNonCarBrand, normalizeBrand } from "@/lib/normalize-brand";
import { ScrapedListing } from "@/lib/scraper/types";
import { waitForSlot, withRetry } from "@/lib/scraper/rate-limit";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
];

function pickUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}


export function parseArabamLocation(text: string): { city: string; address: string } {
  const address = (text || "").replace(/\s+/g, " ").trim();
  const city = address.split(",").pop()?.trim() || "Türkiye";
  return { city, address };
}


const storageStateByHost = new Map<string, Awaited<ReturnType<import("playwright").BrowserContext["storageState"]>>>();

function parsePrice(raw: string) {
  const digits = raw.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

function guessBrandModel(title: string) {
  const parts = title.trim().split(/\s+/);
  const brand = parts[0] || "Bilinmiyor";
  const model = parts.slice(1, 3).join(" ") || "Model";
  return { brand, model };
}

function extractYear(title: string) {
  const match = title.match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : new Date().getFullYear() - 3;
}

function extractMileage(text: string) {
  const match = text.match(/([\d.,]{3,})\s*km/i);
  if (!match) return 0;
  const digits = match[1].replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

const FUEL_TYPES = ["Benzin", "Dizel", "LPG", "Elektrik", "Hibrit"];
const TRANSMISSIONS = ["Manuel", "Otomatik", "Yarı Otomatik"];
const COLORS = [
  "Beyaz", "Siyah", "Gri", "Gümüş Gri", "Kırmızı", "Mavi", "Yeşil",
  "Sarı", "Turuncu", "Kahverengi", "Bordo", "Lacivert", "Bej",
];

function extractFromKeywords(text: string, options: string[]) {
  const found = options.find((option) =>
    new RegExp(`\\b${option.replace(/\s+/g, "\\s+")}\\b`, "i").test(text)
  );
  return found || "Bilinmiyor";
}

export async function fetchPageHtml(url: string) {
  const hostname = new URL(url).hostname;
  await waitForSlot(hostname);

  const response = await withRetry(
    () =>
      fetch(url, {
        headers: {
          "User-Agent": pickUserAgent(),
          "Accept-Language": "tr-TR,tr;q=0.9",
          Accept: "text/html,application/xhtml+xml",
        },
        cache: "no-store",
      }),
    { label: `fetch ${hostname}`, retries: 1 }
  );

  
  return {
    ok: response.ok,
    status: response.status,
    html: await response.text(),
    finalUrl: response.url || url,
  };
}

export async function fetchPageHtmlWithBrowser(url: string) {
  const hostname = new URL(url).hostname;
  await waitForSlot(hostname);

  return withRetry(
    async () => {
      const { chromium } = await import("playwright");
      const browser = await chromium.launch({
        headless: true,
        args: ["--disable-blink-features=AutomationControlled"],
      });

      try {
        const context = await browser.newContext({
          userAgent: pickUserAgent(),
          locale: "tr-TR",
          viewport: { width: 1440, height: 900 },
          storageState: storageStateByHost.get(hostname),
        });
        const page = await context.newPage();
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
        await page.waitForTimeout(2000 + Math.random() * 1500);
        const html = await page.content();

        storageStateByHost.set(hostname, await context.storageState());
        await context.close();
        return html;
      } finally {
        await browser.close();
      }
    },
    { label: `browser fetch ${hostname}`, retries: 1 }
  );
}

export function parseSahibindenHtml(html: string, limit = 12): ScrapedListing[] {
  const $ = cheerio.load(html);
  const listings: ScrapedListing[] = [];

  $("tr[data-id]").each((_, el) => {
    if (listings.length >= limit) return false;

    const row = $(el);
    const id = row.attr("data-id");
    const link = row.find('a[href^="/ilan/"]').first();
    const href = link.attr("href");
    const title =
      row.find(".classifiedTitle").first().attr("title")?.trim() ||
      link.attr("title")?.trim() ||
      link.text().trim();
    const priceText = row.find(".searchResultsPriceValue").first().text();
    const blockText = row.text();

    if (!id || !href || !title || !priceText) return;

    const imageUrl =
      row.find("img").first().attr("data-src") ||
      row.find("img").first().attr("src") ||
      "";
    const images = row
      .find("img")
      .map((__, img) => $(img).attr("data-src") || $(img).attr("src"))
      .get()
      .filter((src): src is string => !!src && /^https?:\/\//.test(src));

    listings.push({
      externalId: `sahibinden-${id}`,
      sourceSite: "sahibinden",
      listingUrl: `https://www.sahibinden.com${href}`,
      title,
      brand: guessBrandModel(title).brand,
      model: guessBrandModel(title).model,
      year: extractYear(title),
      price: parsePrice(priceText),
      mileage: extractMileage(blockText),
      city: "Türkiye",
      description: `${title} - Sahibinden ilanı`,
      imageUrl: imageUrl || "",
      images: images.length ? Array.from(new Set([imageUrl, ...images])) : undefined,
      damageFlag: /hasar|kaza|hasarlı/i.test(blockText),
      features: {
        fuelType: extractFromKeywords(blockText, FUEL_TYPES),
        transmission: extractFromKeywords(blockText, TRANSMISSIONS),
        bodyType: "Otomobil",
        color: extractFromKeywords(blockText, COLORS),
      },
    });
  });

  return listings;
}

/**
 * Arama sonucundaki küçük thumbnail'leri tam çözünürlük varyantına yükseltir.
 *
 * DİKKAT: CDN her ilan için 1920x1080 varyantı ÜRETMİYOR — eski/düşük çözünürlüklü
 * ilanlarda bu adres 404 döner (ölçüldü: bozuk bir ilanın 49 fotoğrafının tamamı
 * 1920x1080'de 404, 800x600'de 200). Bu yüzden yükseltme "iyimser" kabul edilir;
 * arayüz tarafında `lib/image-url.ts` bozuk boyutu tespit edip 800x600'e düşer.
 * Zaten yeterince büyük olan (≥1280 genişlik) adreslere dokunulmaz.
 */
function upgradeArabamImageQuality(urls: string[]): string[] {
  return urls.map((url) =>
    url.replace(
      /_(\d{2,4})x(\d{2,4})(\.(?:jpe?g|png|webp))(\?.*)?$/i,
      (match, width: string, _height: string, ext: string, query = "") =>
        Number(width) >= 1280 ? match : `_1920x1080${ext}${query}`
    )
  );
}

/**
 * İlan detay sayfasından galerideki tüm gerçek fotoğrafları çeker (arama sonucundaki
 * küçük thumbnail yerine). ld+json Product/Car şeması varsa oradan, yoksa slider
 * img etiketlerinden toplar; CDN'in desteklediği en yüksek çözünürlük varyantına yükseltir.
 */
/**
 * PARÇA BAZLI boya/değişen durumu.
 *
 * Kaynak sayfada araç şeması gömülü bir SVG olarak duruyor ve her parça kendi
 * durumunu taşıyor:
 *   <path id="B01001" uib-tooltip="Boyanmış"><title>Motor Kaputu</title></path>
 *
 * NEDEN GEREKLİ: `Boya-değişen` özet alanı yalnızca SAYI veriyor
 * ("1 değişen, 3 boyalı") — hangi parçanın boyandığını söylemiyor. Şemayı
 * gerçek anlamda çizebilmek için parça adı + durum çiftleri lazım.
 *
 * DİKKAT — yapı ilanlara göre değişiyor: kimi ilanda 13 parça, kimisinde 6,
 * kimisinde hiç yok (ölçüldü). Bu yüzden bulunamaması HATA DEĞİL; boş dizi
 * dönerse arayüz eski özet görünümüne düşer.
 */
export interface DamagePart {
  name: string;
  /** "Orijinal" | "Boyanmış" | "Değişmiş" | "Lokal Boyanmış" | "Belirtilmemiş" */
  state: string;
}

export function extractArabamDamageParts(html: string): DamagePart[] {
  const parts: DamagePart[] = [];
  const seen = new Set<string>();

 
  const re = /<path\b[^>]*?uib-tooltip="([^"]*)"[^>]*?>[\s\S]{0,200}?<title>([^<]*)<\/title>/g;
  let match: RegExpExecArray | null;

  while ((match = re.exec(html)) !== null) {
    const state = match[1].trim();
    const name = match[2].replace(/\s+/g, " ").trim();
    if (!name || !state) continue;
   
    if (seen.has(name)) continue;
    seen.add(name);
    parts.push({ name, state });
  }

  return parts;
}

export function extractArabamGalleryImages(html: string): string[] {
  const $ = cheerio.load(html);

  const ldJsonBlocks = $('script[type="application/ld+json"]')
    .map((_, el) => $(el).text())
    .get();

  for (const raw of ldJsonBlocks) {
    try {
      const data = JSON.parse(raw);
      const images = Array.isArray(data.image)
        ? data.image
        : typeof data.image === "string"
          ? [data.image]
          : [];
      if (images.length > 0) {
        return upgradeArabamImageQuality(images);
      }
    } catch {
      continue;
    }
  }

  const fallback = $("img[data-src*='mncdn'], img[src*='mncdn']")
    .map((_, img) => $(img).attr("data-src") || $(img).attr("src"))
    .get()
    .filter((src): src is string => !!src && /ilanfotograflari/.test(src));

  return upgradeArabamImageQuality(Array.from(new Set(fallback)));
}

/** Arama sonuç sayfasından sadece ilan linklerini toplar; alan verileri detay sayfasından okunur. */
export function extractArabamListingHrefs(html: string, limit = 12): string[] {
  const $ = cheerio.load(html);
  const hrefs = new Set<string>();

  $('a[href^="/ilan/"]').each((_, el) => {
    if (hrefs.size >= limit) return false;
    const href = $(el).attr("href");
    if (href) hrefs.add(href);
  });

  return Array.from(hrefs);
}

const ARABAM_PROPERTY_LABELS = [
  "İlan Tarihi",
  "Vites Tipi",
  "Yakıt Tipi",
  "Kasa Tipi",
  "Renk",
  "Motor Hacmi",
  "Motor Gücü",
  "Çekiş",
  "Ort. Yakıt Tüketimi",
  "Yakıt Deposu",
  "Ağır Hasarlı",
  "Boya-değişen",
  "Kimden",
];

/**
 * Arabam ilan detay sayfasını parse eder. Arama sonuç tablosu sık değişen, sınıf adı
 * olmayan hücrelerden oluştuğu için (bkz. site yapısı notları) marka/model/yıl/km/fiyat
 * gibi kritik alanları sayfanın schema.org Car (ld+json) bloğundan, yakıt/vites/kasa/hasar
 * gibi alanları ise özellik listesinden (.property-item) okur — ikisi de arama sonucu
 * tablosundaki class'sız hücrelere göre çok daha kararlı.
 */
export function parseArabamDetailHtml(
  html: string,
  listingUrl: string
): ScrapedListing | null {
  const $ = cheerio.load(html);

  interface ArabamCarLd {
    brand?: string;
    model?: string;
    name?: string;
    vehicleTransmission?: string;
    color?: string;
    productionDate?: number | string;
    mileageFromOdometer?: { value?: number };
    offers?: { price?: number };
  }

  let found: ArabamCarLd | null = null;

  $('script[type="application/ld+json"]').each((_, el) => {
    if (found) return;
    try {
      const data = JSON.parse($(el).text());
      if (data["@type"] === "Car") found = data;
    } catch {
      
    }
  });

   
  const carData = found as ArabamCarLd | null;
  if (!carData) return null;

  const props: Record<string, string> = {};
  $(".property-item").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    const label = ARABAM_PROPERTY_LABELS.find((candidate) => text.startsWith(candidate));
    if (label) props[label] = text.slice(label.length).trim();
  });

  const externalIdMatch = listingUrl.match(/(\d+)\/?$/);
  const externalId = externalIdMatch ? externalIdMatch[1] : listingUrl;

  const headline = $(".listing-title-lines").first().text().trim();
  const rawTitle =
    headline ||
    carData.name?.split(" | ")[0]?.trim() ||
    `${carData.brand || "Bilinmiyor"} ${carData.model || ""}`.trim();

  const title = rawTitle.replace(/\s*-\s*\d+$/, "").trim();

  const locationText = $("[class*='location']").first().text().trim();
  const { city, address } = parseArabamLocation(locationText);

  
  const sellerNote = $("#tab-description").find("h5").remove().end().text().replace(/\s+/g, " ").trim();
  const description = sellerNote.length > 20 ? sellerNote.slice(0, 4000) : `${title} - Arabam ilanı`;

   
  const engineSizeCcMatch = (props["Motor Hacmi"] || "").match(/[\d.,]+/);
  const engineSizeCc = engineSizeCcMatch
    ? Number(engineSizeCcMatch[0].replace(/\./g, "").replace(",", "."))
    : undefined;
  const horsepowerMatch = (props["Motor Gücü"] || "").match(/[\d.,]+/);
  const transmissionRaw = carData.vehicleTransmission || props["Vites Tipi"] || "";
  const transmission =
    transmissionRaw === "Düz" ? "Manuel" : transmissionRaw || "Bilinmiyor";

  const images = extractArabamGalleryImages(html);

  const damageFlag =
    props["Ağır Hasarlı"] === "Var" || props["Ağır Hasarlı"] === "Evet";

  const brand = normalizeBrand(carData.brand || guessBrandModel(title).brand);
  
  if (isNonCarBrand(brand)) return null;

  return {
    externalId: `arabam-${externalId}`,
    sourceSite: "arabam",
    listingUrl,
    title,
    brand,
    model: carData.model || guessBrandModel(title).model,
    year: Number(carData.productionDate) || extractYear(title),
    price: Number(carData.offers?.price) || 0,
    mileage: Number(carData.mileageFromOdometer?.value) || 0,
    city,
    address,
    description,
    imageUrl: images[0] || "",
    images,
    damageFlag,
    listingDate: props["İlan Tarihi"] || undefined,
    sellerType: props["Kimden"] || undefined,
    paintChange: props["Boya-değişen"] || undefined,
    
    damageParts: extractArabamDamageParts(html),
    features: {
      fuelType: props["Yakıt Tipi"] || extractFromKeywords(html, FUEL_TYPES),
      transmission,
      bodyType: (props["Kasa Tipi"] || "Otomobil").split("/")[0].trim(),
      color: carData.color || props["Renk"] || extractFromKeywords(html, COLORS),
      engineSize: engineSizeCc ? Math.round((engineSizeCc / 1000) * 10) / 10 : undefined,
      horsepower: horsepowerMatch ? Number(horsepowerMatch[0].replace(/\D/g, "")) : undefined,
      drivetrain: props["Çekiş"] || undefined,
      avgFuelConsumption: props["Ort. Yakıt Tüketimi"] || undefined,
      fuelTank: props["Yakıt Deposu"] || undefined,
    },
  };
}
