import * as cheerio from "cheerio";
import { Car } from "@/models/Car";
import { foldForFilter } from "@/lib/content-filter";
import type { ScrapedListing } from "@/lib/scraper/types";

/**
 * KURUMSAL KAYNAKLARDA İLAN DETAYI
 *
 * Otokoç ve Otoplus liste sayfası ilan başına tek fotoğraf ve şablon bir açıklama
 * veriyor; asıl galeri ve teknik bilgiler ilan sayfasında. Arabam için ayrı bir
 * zenginleştirme vardı (scrape.bat G), bu kaynaklar için yoktu: siteye eklenen
 * ilanlar tek fotoğraflı ve açıklamasız kalıyordu.
 *
 * Bu modül ilan sayfasından fotoğraf galerisi, renk/kasa/motor hacmi, tramer ve
 * boya-değişen bilgisini çıkarır. Yeni ilan kaydedilirken (saveListing) ve mevcut
 * ilanlar için arka planda (runDetailBackfill) kullanılır.
 *
 * Satıcı açıklaması yalnızca sayfada gerçekten varsa alınır; bu iki kaynakta yok,
 * bu yüzden açıklama sayfadaki verilerden derlenir (uydurma bilgi eklenmez).
 */
export const DETAIL_SOURCES = ["otokoc", "otoplus"] as const;
export type DetailSource = (typeof DETAIL_SOURCES)[number];

export const isDetailSource = (source?: string): source is DetailSource =>
  !!source && (DETAIL_SOURCES as readonly string[]).includes(source);

export interface DetailPatch {
  images?: string[];
  description?: string;
  color?: string;
  bodyType?: string;
  fuelType?: string;
  transmission?: string;
  engineSize?: number;
  paintChange?: string;
  damageFlag?: boolean;
}

const MAX_IMAGES = 24;
const UNKNOWN_VALUES = new Set(["", "belirtilmemiş", "bilinmiyor", "otomobil", "belirtilmemis"]);
export const isUnknownValue = (v?: string | null) => UNKNOWN_VALUES.has((v || "").trim().toLocaleLowerCase("tr-TR"));

/** Liste sayfası rengi küçük harfle veriyor ("beyaz"); ilan sayfasındaki yazımı ("Beyaz") tercih et. */
const sameIgnoringCase = (a?: string | null, b?: string | null) =>
  !!a && !!b && a.trim().toLocaleLowerCase("tr-TR") === b.trim().toLocaleLowerCase("tr-TR");
const shouldReplaceColor = (current?: string | null, next?: string | null) =>
  isUnknownValue(current) || sameIgnoringCase(current, next);

function ldJsonBlocks(html: string): any[] {
  const $ = cheerio.load(html);
  const out: any[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).text());
      const list = Array.isArray(data) ? data : data["@graph"] ? data["@graph"] : [data];
      out.push(...list);
    } catch {
      // bozuk blok: atla
    }
  });
  return out;
}

const findVehicle = (html: string) =>
  ldJsonBlocks(html).find((b) => ["Car", "Vehicle", "Product"].includes(b?.["@type"]));

function cleanImages(list: unknown, upgrade?: (u: string) => string): string[] {
  const arr = Array.isArray(list) ? list : typeof list === "string" ? [list] : [];
  const seen = new Set<string>();
  for (const item of arr) {
    const raw = typeof item === "string" ? item : (item as any)?.url;
    if (typeof raw !== "string" || !/^https?:\/\//.test(raw)) continue;
    seen.add(upgrade ? upgrade(raw) : raw);
    if (seen.size >= MAX_IMAGES) break;
  }
  return [...seen];
}

// ---------------------------------------------------------------------------
// OTOKOÇ
// ---------------------------------------------------------------------------

export interface TramerInfo {
  status: "none" | "record" | "unknown";
  note: string;
}

/**
 * Tramer alanı serbest metin ("TRAMER KAYDI YOKTUR", "SORGU TARİHİ: YOK",
 * "15.04.2025:ERP-ÇARPMA:11.000TL", "Tramer kaydı teknik bir sebepten dolayı
 * sorgulanamamıştır."). Yaklaşık 45 canlı ilandan çıkarılan biçimlere göre sınıflanır.
 */
export function classifyTramer(raw?: string | null): TramerInfo {
  const cleaned = (raw || "")
    .replace(/\\+[rn]/g, " ")
    .replace(/&gt;|>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || cleaned === "undefined") return { status: "unknown", note: "" };
  const folded = foldForFilter(cleaned);

  if (/sorgulanamam|sorgulanamiyor|alinamad/.test(folded)) return { status: "unknown", note: "" };
  if (/(kayd?i?\s*(yoktur|yok)|hasar\s*kayd?i?\s*yok|hasari\s*bulunamamistir|tramer\s*yok|:\s*yok\s*$|bulunamamistir)/.test(folded)) {
    return { status: "none", note: "" };
  }
  if (/(carpma|kaza|adet|\d\s*tl|\d\.\d{3}|tutarsiz|rakam yok|hasar)/.test(folded)) {
    const note = cleaned.replace(/^sorgu tarihi\s*:?\s*/i, "").slice(0, 200).trim();
    return { status: "record", note };
  }
  return { status: "unknown", note: "" };
}

const OTOKOC_IMAGE_RE = /\/car\/(?:220x|335x|450x)\//;
/** Liste sayfası 450x küçük görsel veriyor; 640x aynı adreste mevcut (12/12 ilanda doğrulandı). */
const upgradeOtokocImage = (url: string) => url.replace(OTOKOC_IMAGE_RE, "/car/640x/");

export function parseOtokocDetail(html: string): DetailPatch | null {
  const vehicle = findVehicle(html);
  if (!vehicle) return null;

  // Sayfadaki RSC yükü kaçışlı JSON içeriyor; alanlar için düz metne çevrilir.
  const text = html
    .replace(/\\"/g, '"')
    .replace(/\\u0026/g, "&")
    .replace(/\\u003e/g, ">")
    .replace(/\\u003c/g, "<");

  const images = cleanImages(vehicle.image, upgradeOtokocImage);
  const color = typeof vehicle.color === "string" ? vehicle.color.trim() : "";
  const bodyType = typeof vehicle.bodyType === "string" ? vehicle.bodyType.trim() : "";
  const fuelType = typeof vehicle.vehicleEngine?.fuelType === "string" ? vehicle.vehicleEngine.fuelType.trim() : "";
  const transmission = typeof vehicle.vehicleTransmission === "string" ? vehicle.vehicleTransmission.trim() : "";

  // Ana araç nesnesi "similarVehicles"tan önce geldiği için ilk eşleşme kullanılır.
  const volume = (text.match(/"engineVolume":"(\d+(?:[.,]\d+)?)"/) || [])[1];
  // Otokoç kendi verisinde elektrikli araca da motor hacmi yazabiliyor (Corsa-e: 1,2 L); bu değer güvenilmez.
  const isElectric = /elektrik/i.test(fuelType);
  const engineSize = volume && !isElectric ? Number(volume.replace(",", ".")) : undefined;

  const tramer = classifyTramer((text.match(/"tramerRecords":"([^"]*)"/) || [])[1]);

  // Boya/değişen kutusu: "Araçta boya veya değişen parça kaydı bulunmamaktadır. Tüm parçalar orijinaldir."
  const $ = cheerio.load(html.replace(/\\u003c/g, "<"));
  let paintText = "";
  $('[class*="status-box-module"][class*="description"]').each((_, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (t && !paintText) paintText = t;
  });
  if (!paintText) {
    paintText = (text.match(/status-box-module__[A-Za-z0-9_-]+__description">([^<]+)</) || [])[1]?.trim() || "";
  }
  const paintClean = /bulunmamaktadir|orijinaldir/.test(foldForFilter(paintText));
  const paintChange = paintText ? (paintClean ? "Boya/değişen yok (tüm parçalar orijinal)" : paintText.slice(0, 200)) : undefined;

  const damageFlag = tramer.status === "record" ? true : tramer.status === "none" ? false : undefined;

  const name = typeof vehicle.name === "string" ? vehicle.name.replace(/\s*\|\s*Otokoç.*$/i, "").trim() : "";
  const mileage = Number(vehicle.mileageFromOdometer?.value) || 0;
  const facts: string[] = [];
  if (color) facts.push(`renk ${color.toLocaleLowerCase("tr-TR")}`);
  if (bodyType) facts.push(`kasa tipi ${bodyType}`);
  if (fuelType) facts.push(`yakıt ${fuelType.toLocaleLowerCase("tr-TR")}`);
  if (transmission) facts.push(`vites ${transmission.toLocaleLowerCase("tr-TR")}`);
  if (engineSize) facts.push(`motor hacmi ${engineSize.toLocaleString("tr-TR", { minimumFractionDigits: 1 })} L`);
  if (mileage) facts.push(`${mileage.toLocaleString("tr-TR")} km`);

  const parts = [`${name || "Araç"} — Otokoç 2. El güvencesiyle satılan ikinci el araç.`];
  if (facts.length) parts.push(`${facts[0].charAt(0).toLocaleUpperCase("tr-TR")}${facts[0].slice(1)}${facts.length > 1 ? ", " + facts.slice(1).join(", ") : ""}.`);
  if (tramer.status === "none") parts.push("Tramer sorgusunda hasar kaydı bulunmuyor.");
  else if (tramer.status === "record") parts.push(`Tramer kaydı: ${tramer.note || "hasar kaydı mevcut"}.`);
  if (paintChange) parts.push(paintClean ? "Boya ve değişen parça kaydı yok, tüm parçalar orijinal." : `Boya/değişen: ${paintChange}.`);

  return {
    images: images.length ? images : undefined,
    description: parts.join(" "),
    color: color || undefined,
    bodyType: bodyType || undefined,
    fuelType: fuelType || undefined,
    transmission: transmission || undefined,
    engineSize,
    paintChange,
    damageFlag,
  };
}

// ---------------------------------------------------------------------------
// OTOPLUS
// ---------------------------------------------------------------------------

export function parseOtoplusDetail(html: string): DetailPatch | null {
  const vehicle = findVehicle(html);
  if (!vehicle) return null;

  const images = cleanImages(vehicle.image);
  const description = typeof vehicle.description === "string" ? vehicle.description.trim() : "";
  const color = typeof vehicle.color === "string" ? vehicle.color.trim() : "";
  const folded = foldForFilter(description);
  const paintChange = /boyasiz|degisensiz/.test(folded) ? "Boyasız" : undefined;

  return {
    images: images.length ? images : undefined,
    description: description ? `${description} Otoplus ekspertizli araç.` : undefined,
    color: color || undefined,
    paintChange,
  };
}

// ---------------------------------------------------------------------------
// Ortak
// ---------------------------------------------------------------------------

const DETAIL_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export async function fetchDetailPatch(source: string, url: string): Promise<DetailPatch | null> {
  if (!isDetailSource(source) || !url) return null;
  const res = await fetch(url, {
    headers: { "User-Agent": DETAIL_UA, "Accept-Language": "tr-TR,tr;q=0.9" },
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return null;
  const html = await res.text();
  return source === "otokoc" ? parseOtokocDetail(html) : parseOtoplusDetail(html);
}

/** Yeni ilan kaydedilmeden önce detay bilgisini listeleme verisine işler. */
export function mergeDetailIntoListing(listing: ScrapedListing, patch: DetailPatch): ScrapedListing {
  const features = { ...listing.features };
  if (patch.color && shouldReplaceColor(features.color, patch.color)) features.color = patch.color;
  if (patch.bodyType && isUnknownValue(features.bodyType)) features.bodyType = patch.bodyType;
  if (patch.fuelType && isUnknownValue(features.fuelType)) features.fuelType = patch.fuelType;
  if (patch.transmission && isUnknownValue(features.transmission)) features.transmission = patch.transmission;
  if (patch.engineSize && !features.engineSize) features.engineSize = patch.engineSize;

  const images = patch.images && patch.images.length > (listing.images?.length ?? 0) ? patch.images : listing.images;
  return {
    ...listing,
    images,
    imageUrl: images?.[0] || listing.imageUrl,
    description: patch.description || listing.description,
    paintChange: patch.paintChange ?? listing.paintChange,
    damageFlag: patch.damageFlag ?? listing.damageFlag,
    features,
  };
}

export interface BackfillResult {
  checked: number;
  enriched: number;
  imagesAdded: number;
  failed: number;
}

/**
 * Mevcut kurumsal ilanlar için detay bilgisini arka planda tamamlar. Henüz hiç
 * denenmemiş ilanlar önceliklidir; tek fotoğraflı kalanlar 7 günde bir yeniden denenir.
 */
export async function runDetailBackfill(
  limit = 20,
  options: { source?: DetailSource; log?: (msg: string) => void; delayMs?: number } = {}
): Promise<BackfillResult> {
  const now = new Date();
  const retryBefore = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sources = options.source ? [options.source] : [...DETAIL_SOURCES];

  const docs = await Car.find({
    sourceSite: { $in: sources },
    status: "active",
    listingUrl: { $nin: ["", null] },
    $or: [
      { detailCheckedAt: { $exists: false } },
      { "images.1": { $exists: false }, detailCheckedAt: { $lt: retryBefore } },
    ],
  })
    .sort({ detailCheckedAt: 1, createdAt: -1 })
    .limit(limit)
    .select("_id sourceSite listingUrl images description features")
    .lean<
      Array<{
        _id: unknown;
        sourceSite: string;
        listingUrl: string;
        images?: string[];
        description?: string;
        features?: { color?: string; bodyType?: string; fuelType?: string; transmission?: string; engineSize?: number };
      }>
    >();

  const result: BackfillResult = { checked: 0, enriched: 0, imagesAdded: 0, failed: 0 };
  for (const doc of docs) {
    result.checked++;
    let patch: DetailPatch | null = null;
    try {
      patch = await fetchDetailPatch(doc.sourceSite, doc.listingUrl);
    } catch {
      patch = null;
    }

    const set: Record<string, unknown> = { detailCheckedAt: now };
    if (patch) {
      const f = doc.features || {};
      const currentCount = doc.images?.length ?? 0;
      if (patch.images && patch.images.length > currentCount) {
        set.images = patch.images;
        set.imageUrl = patch.images[0];
        result.imagesAdded += patch.images.length - currentCount;
      }
      if (patch.description) set.description = patch.description;
      if (patch.color && shouldReplaceColor(f.color, patch.color)) set["features.color"] = patch.color;
      if (patch.bodyType && isUnknownValue(f.bodyType)) set["features.bodyType"] = patch.bodyType;
      if (patch.fuelType && isUnknownValue(f.fuelType)) set["features.fuelType"] = patch.fuelType;
      if (patch.transmission && isUnknownValue(f.transmission)) set["features.transmission"] = patch.transmission;
      if (patch.engineSize && !f.engineSize) set["features.engineSize"] = patch.engineSize;
      if (patch.paintChange !== undefined) set.paintChange = patch.paintChange;
      if (patch.damageFlag !== undefined) set.damageFlag = patch.damageFlag;
      result.enriched++;
    } else {
      result.failed++;
    }

    // updatedAt'e dokunulmaz: detay tamamlamak ilanın "son değişikliği" değildir.
    await Car.updateOne({ _id: doc._id }, { $set: set }, { timestamps: false });
    await new Promise((r) => setTimeout(r, options.delayMs ?? 700));
  }

  if (result.checked > 0) {
    options.log?.(
      `🖼️ [DETAY] ${result.checked} ilan kontrol edildi: ${result.enriched} zenginleştirildi (+${result.imagesAdded} fotoğraf), ${result.failed} okunamadı.`
    );
  }
  return result;
}
