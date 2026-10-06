import * as cheerio from "cheerio";
import { isNonCarBrand, normalizeBrand } from "@/lib/normalize-brand";
import { classFromSourceCategory } from "@/lib/vehicle-scope";
import { ScrapedListing } from "@/lib/scraper/types";
import { waitForSlot, withRetry } from "@/lib/scraper/rate-limit";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
];

export function pickUserAgent() {
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

let zenrowsKeyIndex = 0;
function getZenRowsKey(): string | null {
  const keysStr = process.env.ZENROWS_API_KEYS || process.env.ZENROWS_API_KEY || "";
  const keys = keysStr.split(",").map((k) => k.trim()).filter(Boolean);
  if (keys.length === 0) return null;
  const key = keys[zenrowsKeyIndex % keys.length];
  zenrowsKeyIndex++;
  return key;
}

let zenrowsCreditsExhausted = false;

export async function fetchWithZenRows(
  url: string
): Promise<{ ok: boolean; status: number; html: string; finalUrl: string } | null> {
  if (process.env.ENABLE_ZENROWS !== "true" || process.env.DISABLE_ZENROWS === "true" || zenrowsCreditsExhausted) {
    return null;
  }
  const apiKey = getZenRowsKey();
  if (!apiKey) return null;

  try {
    const zenUrl = `https://api.zenrows.com/v1/?apikey=${apiKey}&url=${encodeURIComponent(
      url
    )}&js_render=true&premium_proxy=true`;
    const res = await fetch(zenUrl, { signal: AbortSignal.timeout(45000) });
    if (!res.ok) {
      if (res.status === 402 || res.status === 401) {
        zenrowsCreditsExhausted = true;
        console.warn(`[ZenRows] Kredi tükendi veya anahtar geçersiz (HTTP ${res.status}). ZenRows devre dışı bırakıldı, tarama yerel/WARP IP ile devam ediyor.`);
      } else {
        console.warn(`[ZenRows] Yanıt başarısız: HTTP ${res.status}`);
      }
      return null;
    }
    const html = await res.text();
    return {
      ok: true,
      status: 200,
      html,
      finalUrl: url,
    };
  } catch (err) {
    console.warn(`[ZenRows] İstek hatası:`, err instanceof Error ? err.message : err);
    return null;
  }
}

let arabamSessionCookies = "";
let arabamCookiesExpiresAt = 0;

export async function getArabamSessionCookies(): Promise<string> {
  const now = Date.now();
  if (arabamSessionCookies && arabamCookiesExpiresAt > now) {
    return arabamSessionCookies;
  }
  try {
    const res = await fetch("https://www.arabam.com/", {
      headers: {
        "User-Agent": pickUserAgent(),
        "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const setCookies = res.headers.getSetCookie
      ? res.headers.getSetCookie()
      : res.headers.get("set-cookie")
      ? [res.headers.get("set-cookie")!]
      : [];

    if (setCookies.length > 0) {
      arabamSessionCookies = setCookies.map((c) => c.split(";")[0].trim()).join("; ");
      arabamCookiesExpiresAt = now + 15 * 60 * 1000; // 15 dakika geçerli
      return arabamSessionCookies;
    }
  } catch (err) {
    console.warn("Arabam session cookie alınamadı:", err);
  }
  return arabamSessionCookies;
}

export async function fetchPageHtml(url: string) {
  const hostname = new URL(url).hostname;
  await waitForSlot(hostname);

  const headers: Record<string, string> = {
    "User-Agent": pickUserAgent(),
    "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "sec-ch-ua": '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": "none",
    "sec-fetch-user": "?1",
    "upgrade-insecure-requests": "1",
  };

  if (hostname.includes("arabam.com")) {
    headers["Referer"] = "https://www.arabam.com/ikinci-el/otomobil";
    const cookies = await getArabamSessionCookies();
    if (cookies) {
      headers["Cookie"] = cookies;
    }
  }

  let response: Response;
  try {
    response = await withRetry(
      () =>
        fetch(url, {
          headers,
          cache: "no-store",
          // Zaman aşımı olmayan istek 7/24 daemon'u sonsuza kadar kilitleyebiliyordu.
          signal: AbortSignal.timeout(20000),
        }),
      { label: `fetch ${hostname}`, retries: 1 }
    );
  } catch (err) {
    // Doğrudan istek ağ hatası verirse ve ZenRows açıksa ZenRows dene
    if (process.env.DISABLE_ZENROWS !== "true") {
      const zen = await fetchWithZenRows(url);
      if (zen && zen.ok) return zen;
    }
    throw err;
  }

  if (response.status === 429 || response.status === 403) {
    if (hostname.includes("arabam.com")) {
      // Çerezi sıfırla, taze oturum al ve bir kez daha dene
      arabamSessionCookies = "";
      arabamCookiesExpiresAt = 0;
      await new Promise((r) => setTimeout(r, 2500));
      const freshCookies = await getArabamSessionCookies();
      if (freshCookies) {
        headers["Cookie"] = freshCookies;
        try {
          const retryRes = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(20000) });
          if (retryRes.ok) {
            return {
              ok: true,
              status: 200,
              html: await retryRes.text(),
              finalUrl: retryRes.url || url,
            };
          }
        } catch {}
      }
    }
    if (process.env.ENABLE_ZENROWS === "true" && process.env.DISABLE_ZENROWS !== "true") {
      console.log(`  🛡️ Arabam ${response.status} (Rate-limit) verdi -> ZenRows proxy deneniyor: ${url}`);
      const zen = await fetchWithZenRows(url);
      if (zen && zen.ok) return zen;
    }

    // 429 gerçek oran sınırı ise kısa 3sn nefes al, 403 ise (Cloudflare koruması) beklemeden hemen tarayıcı motoruna geç!
    if (response.status === 429) {
      console.log(`  ⏳ Arabam 429 (Hız sınırı) verdi. 3 sn dinlenip aşılıyor...`);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    try {
      // Tarayıcının vardığı GERÇEK adres döndürülür: kaldırılmış bir Arabam ilanı
      // model kategori sayfasına yönlenir; adres kaybolursa ilan canlı sanılıyordu.
      const page = await fetchPageWithBrowser(url, true);
      if (isCloudflareChallenge(page.html)) {
        return { ok: false, status: 403, html: "", finalUrl: page.finalUrl };
      }
      if (page.html.length > 1000) {
        return { ok: page.status < 400, status: page.status, html: page.html, finalUrl: page.finalUrl };
      }
    } catch (browserErr: any) {
      console.warn(`  ⚠️ Yerel tarayıcı hatası:`, browserErr?.message || browserErr);
    }
  }

  const html = await response.text();
  if (response.ok && isCloudflareChallenge(html)) {
    return { ok: false, status: 403, html: "", finalUrl: response.url || url };
  }
  return {
    ok: response.ok,
    status: response.status,
    html,
    finalUrl: response.url || url,
  };
}

/** Cloudflare "Just a moment..." / challenge sayfası mı? Bu sayfa asla ilan içeriği değildir. */
export function isCloudflareChallenge(html: string): boolean {
  if (!html) return false;
  const head = html.slice(0, 6000);
  return (
    /<title>\s*Just a moment/i.test(head) ||
    /<title>\s*Attention Required/i.test(head) ||
    head.includes("challenges.cloudflare.com") ||
    head.includes("cf-chl-") ||
    head.includes("_cf_chl_opt")
  );
}

let sharedBrowser: any = null;
let sharedContext: any = null;
let browserLaunchPromise: Promise<any> | null = null;

/** Paylaşılan tarayıcıyı kapatır; sonraki sayfa yeni bir tane açar (günlerce açık kalan arka plan işlerinde bellek şişmesin). */
export async function closeSharedBrowser(): Promise<void> {
  const browser = sharedBrowser;
  sharedBrowser = null;
  sharedContext = null;
  if (browser) await browser.close().catch(() => {});
}

async function getSharedContext(hostname: string) {
  if (sharedBrowser && sharedBrowser.isConnected() && sharedContext) {
    return sharedContext;
  }

  if (browserLaunchPromise) {
    return browserLaunchPromise;
  }

  browserLaunchPromise = (async () => {
    try {
      const { chromium } = await import("playwright");
      if (!sharedBrowser || !sharedBrowser.isConnected()) {
        sharedBrowser = await chromium.launch({
          headless: true,
          args: [
            "--disable-blink-features=AutomationControlled",
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--disable-extensions",
          ],
        });
      }
      sharedContext = await sharedBrowser.newContext({
        userAgent: pickUserAgent(),
        locale: "tr-TR",
        viewport: { width: 1440, height: 900 },
        storageState: storageStateByHost.get(hostname),
      });
      await sharedContext.addInitScript(() => {
        Object.defineProperty(navigator, "webdriver", { get: () => undefined });
        // @ts-ignore
        window.chrome = { runtime: {} };
      });
      return sharedContext;
    } finally {
      browserLaunchPromise = null;
    }
  })();

  return browserLaunchPromise;
}

export async function fetchPageHtmlWithBrowser(url: string, skipWait = false) {
  return (await fetchPageWithBrowser(url, skipWait)).html;
}

/** Sayfayı gerçek Chromium ile açar; HTML ile birlikte yönlendirme sonrası adresi ve HTTP kodunu döndürür. */
export async function fetchPageWithBrowser(
  url: string,
  skipWait = false
): Promise<{ html: string; finalUrl: string; status: number }> {
  const hostname = new URL(url).hostname;
  if (!skipWait) {
    await waitForSlot(hostname);
  }

  return withRetry(
    async () => {
      const context = await getSharedContext(hostname);
      const page = await context.newPage();
      try {
        const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
        // Sadece DOM'un oturması için kısa bir bekleme (500-900ms)
        await page.waitForTimeout(500 + Math.random() * 400);
        const html = await page.content();
        return { html, finalUrl: page.url() || url, status: response?.status() ?? 200 };
      } catch (err) {
        if (sharedBrowser && !sharedBrowser.isConnected()) {
          sharedBrowser = null;
          sharedContext = null;
        }
        throw err;
      } finally {
        await page.close().catch(() => {});
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

/** Bozuk sayfalara karşı üst sınır; ölçülen en büyük gerçek galeri 71 fotoğraf. */
export const ARABAM_MAX_GALLERY = 80;

/** Aynı fotoğrafın farklı boyut/sunucu varyantları için ortak anahtar. */
const arabamPhotoKey = (url: string) =>
  url
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/\?.*$/, "")
    .replace(/_\d{2,4}x\d{2,4}(\.\w+)$/i, "$1")
    .toLowerCase();

/**
 * Sayfadan toplanan fotoğraf adreslerini galeriye çevirir. Sayfa aynı fotoğrafı birkaç
 * boyutta (küçük resim, 800x600, 1920x1080) içeriyor; eskiden adresler yükseltmeden ÖNCE
 * tekilleştirildiği için her fotoğraf 2-3 kez kaydediliyordu (400 ilanlık örnekte 27.043
 * adresin yalnızca 10.098'i farklı fotoğraftı). Ayrıca benzer ilanların fotoğrafları,
 * "noImage" yer tutucuları ve kaçış karakteriyle biten bozuk adresler ayıklanır.
 */
export function normalizeArabamGallery(urls: string[], listingId?: string): string[] {
  const cleaned = urls
    // "_{0}.jpg": sayfadaki JS şablonundan boyutu doldurulmamış adres; boyut yerine konur
    // (aynı fotoğrafın gerçek adresi de varsa aşağıda tekilleşir).
    .map((u) => (typeof u === "string" ? u.trim().replace(/[\\'"),]+$/, "").replace(/_(?:\{0\}|%7B0%7D)(\.\w+)$/i, "_1920x1080$1") : ""))
    .filter((u) => /^https?:\/\//i.test(u) && !/\/noimage/i.test(u) && !/[{}]|%7B|%7D/i.test(u));
  const own = listingId ? cleaned.filter((u) => u.includes(`/${listingId}/`)) : [];
  const pool = own.length > 0 ? own : cleaned;

  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of upgradeArabamImageQuality(pool)) {
    const key = arabamPhotoKey(url);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(url);
    if (out.length >= ARABAM_MAX_GALLERY) break;
  }
  return out;
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

export function extractArabamGalleryImages(html: string, listingId?: string): string[] {
  const $ = cheerio.load(html);
  const collected: string[] = [];

  // 1. ld+json bloklarından gelenler (eğer dizi ise)
  const ldJsonBlocks = $('script[type="application/ld+json"]')
    .map((_, el) => $(el).text())
    .get();

  for (const raw of ldJsonBlocks) {
    try {
      const data = JSON.parse(raw);
      const list = Array.isArray(data) ? data : [data];
      for (const item of list) {
        if (item["@type"] === "Car" || item["@type"] === "Vehicle" || item["@type"] === "Product") {
          const imgs = Array.isArray(item.image) ? item.image : typeof item.image === "string" ? [item.image] : [];
          collected.push(...imgs);
        }
      }
    } catch {
      continue;
    }
  }

  // 2. Sayfadaki TÜM img ve a etiketlerindeki ilan fotoğrafları
  $("img").each((_, el) => {
    const src = $(el).attr("src") || $(el).attr("data-src") || "";
    if (src.includes("ilanfotograflari")) collected.push(src);
  });
  $("a[href*='ilanfotograflari']").each((_, el) => {
    const href = $(el).attr("href") || "";
    if (href) collected.push(href);
  });

  // 3. Script içindeki fotoğraf bağlantıları
  $("script").each((_, el) => {
    const txt = $(el).text();
    const matches = txt.match(/https?:\/\/[^"'\s]+ilanfotograflari[^"'\s]+/g);
    if (matches) collected.push(...matches);
  });

  return normalizeArabamGallery(collected, listingId);
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
/**
 * Bir detay sayfa yanıtının (HTML veya yönlendirilmiş URL) yayından kaldırılmış
 * ya da silinmiş bir ilan olup olmadığını tespit eder.
 */
export function isListingGone(html: string, finalUrl = ""): boolean {
  if (finalUrl) {
    // /ilan/ linki kategori/arama sayfasına yönlendiyse ilan kaldırılmıştır
    // (Arabam kaldırılan ilanı model kategorisine yönlendiriyor, ölçüldü).
    // Ana sayfaya yönlendirme ise KANIT DEĞİLDİR: bot/bölge filtresi de aynı şeyi yapar.
    let path = "";
    try {
      path = new URL(finalUrl).pathname;
    } catch {
      path = "";
    }
    const isRoot = path === "" || path === "/";
    const isSearchRedirect =
      !isRoot &&
      !/\/ilan\//.test(finalUrl) &&
      /\/(ikinci-el|vasita|arac-arama|satilik-araba)(\/|\?|$)/.test(finalUrl);
    if (isSearchRedirect) return true;
  }
  const text = (html || "").toLocaleLowerCase("tr-TR");
  return (
    text.includes("bu ilan yayında değildir") ||
    text.includes("ilan yayından kaldırılmıştır") ||
    text.includes("böyle bir ilan bulunamadı") ||
    text.includes("aradığınız ilan bulunamamıştır") ||
    text.includes("aradığınız ilan artık aktif değildir") ||
    text.includes("ilanın süresi dolmuştur") ||
    text.includes("araç satılmıştır") ||
    text.includes("bu araç satıldı") ||
    text.includes("araç satıldı") ||
    text.includes("sayfa bulunamadı")
  );
}

/** İlan sayfasının gezinme yolundaki kategori adresleri ("otomobil", "motosiklet/yamaha", "karavan-motokaravan"...). */
export function arabamCategoriesFromHtml(html: string): string[] {
  const start = html.indexOf('"BreadcrumbList"');
  if (start < 0) return [];
  const crumb = html.slice(start, start + 4000);
  return [...crumb.matchAll(/"@id"\s*:\s*"https:\/\/www\.arabam\.com\/ikinci-el\/([a-z0-9/-]+)"/g)].map((m) => m[1]);
}

/**
 * Platform kapsamı dışında bir ilan mı (ATV/UTV, deniz/hava aracı, kiralık, "taksi hat & plaka"...)? Sitemap'teki
 * ilan adresleri kategori taşımıyor; kategori ilan sayfasının gezinme yolundan okunur. Motosiklet, ticari araç ve
 * karavan kapsamdadır (bkz. vehicle-scope.ts).
 */
export function isNonCarArabamPage(html: string): boolean {
  return arabamCategoriesFromHtml(html).some((path) => classFromSourceCategory(path) === "excluded");
}

export function parseArabamDetailHtml(
  html: string,
  listingUrl: string
): ScrapedListing | null {
  if (isNonCarArabamPage(html)) return null;
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
    // Arabam etiket yazımını değiştirdi ("Vites Tipi" → "Vites tipi"); eşleşme büyük/küçük harf duyarsız olmalı,
    // yoksa kasa tipi hiç okunmuyor, yakıt ise sayfadaki rastgele kelimelerden tahmin ediliyordu.
    const lower = text.toLocaleLowerCase("tr-TR");
    const label = ARABAM_PROPERTY_LABELS.find((candidate) => lower.startsWith(candidate.toLocaleLowerCase("tr-TR")));
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

  const images = extractArabamGalleryImages(html, externalIdMatch ? externalIdMatch[1] : undefined);

  const damageFlag =
    props["Ağır Hasarlı"] === "Var" || props["Ağır Hasarlı"] === "Evet";

  const brand = normalizeBrand(carData.brand || guessBrandModel(title).brand);
  
  if (isNonCarBrand(brand)) return null;

  const confirmedFeatures: NonNullable<ScrapedListing["confirmedFeatures"]> = [];
  if (carData.vehicleTransmission || props["Vites Tipi"]) confirmedFeatures.push("transmission");
  if (props["Yakıt Tipi"]) confirmedFeatures.push("fuelType");
  if (props["Kasa Tipi"]) confirmedFeatures.push("bodyType");
  if (carData.color || props["Renk"]) confirmedFeatures.push("color");

  const domPriceText = $("[class*='price']").first().text();
  const domPrice = parsePrice(domPriceText);
  const price = Number(carData.offers?.price) || domPrice || 0;

  return {
    externalId: `arabam-${externalId}`,
    sourceSite: "arabam",
    listingUrl,
    title,
    brand,
    model: carData.model || guessBrandModel(title).model,
    year: Number(carData.productionDate) || extractYear(title),
    price,
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
    confirmedFeatures,
    sourceCategory: arabamCategoriesFromHtml(html)[0],
    features: {
      // Sayfada yazmayan yakıt/renk tahmin edilmez: eskiden sayfanın tamamında (menüler, öneri kartları) geçen ilk
      // yakıt/renk kelimesi alınıyordu.
      fuelType: props["Yakıt Tipi"] || "Bilinmiyor",
      transmission,
      bodyType: (props["Kasa Tipi"] || "Belirtilmemiş").split("/")[0].trim(),
      color: carData.color || props["Renk"] || "Belirtilmemiş",
      engineSize: engineSizeCc ? Math.round((engineSizeCc / 1000) * 10) / 10 : undefined,
      horsepower: horsepowerMatch ? Number(horsepowerMatch[0].replace(/\D/g, "")) : undefined,
      drivetrain: props["Çekiş"] || undefined,
      avgFuelConsumption: props["Ort. Yakıt Tüketimi"] || undefined,
      fuelTank: props["Yakıt Deposu"] || undefined,
    },
  };
}
