import * as cheerio from "cheerio";
import { Car } from "@/models/Car";
import { foldForFilter } from "@/lib/content-filter";
import type { ScrapedListing } from "@/lib/scraper/types";
import { classifyOtokocHtml, classifyRedirect } from "@/lib/scraper/verify-listing";
import { archiveListings, breakerTripped } from "@/lib/scraper/listing-lifecycle";
import { EXTRA_DETAIL_SOURCES, fetchExtraDetail } from "@/lib/scraper/detail-sources";
import { FUEL_TYPES, normalizeFuelType } from "@/lib/normalize-fuel";
import { incompleteReason, lacksGallery } from "@/lib/scraper/listing-quality";

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
/** İlan detayı okunabilen kurumsal kaynaklar; son üçü sitelerin kendi veri uç noktalarından (bkz. detail-sources.ts). */
export const DETAIL_SOURCES = ["otokoc", "otoplus", "carvak", "dod", "otomerkezi"] as const;
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
  damageParts?: { name: string; state: string }[];
  horsepower?: number;
  /** Resmi ortalama tüketim ("4,9 lt"); yakıt maliyeti hesabında kullanılır. */
  avgFuelConsumption?: string;
}

const MAX_IMAGES = 24;
const UNKNOWN_VALUES = new Set(["", "belirtilmemiş", "bilinmiyor", "otomobil", "belirtilmemis"]);
export const isUnknownValue = (v?: string | null) => UNKNOWN_VALUES.has((v || "").trim().toLocaleLowerCase("tr-TR"));

/**
 * Detay sayfasındaki (aracın kendi kaydı) yakıt, liste sayfasından tahmin edilenden güvenilirdir:
 * liste açıklamasındaki "EVOQUE"/"MHEV" gibi kelimeler aracı yanlışlıkla elektrikli gösterebiliyordu.
 * Sonradan takılmış LPG ise fabrika kaydıyla ezilmez.
 */
export function shouldReplaceFuel(current?: string | null, next?: string | null): boolean {
  if (!next || isUnknownValue(next)) return false;
  const proposed = normalizeFuelType(next);
  if (!(FUEL_TYPES as readonly string[]).includes(proposed)) return isUnknownValue(current);
  const existing = normalizeFuelType(current);
  if (existing === proposed) return current !== proposed;
  return !(existing === "LPG & Benzin" && proposed === "Benzin");
}

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

/**
 * ok     → ilan sayfası okundu
 * gone   → ilan kaldırılmış (güçlü kanıt: 404/410, Otokoç'un "Sayfa Bulunamadı" sayfası,
 *          Otoplus'un ilan numarasını kaybeden yönlendirmesi)
 * failed → ağ hatası, engel ya da anlaşılamayan sayfa: hiçbir şey kanıtlamaz
 */
export type DetailOutcome =
  | { kind: "ok"; patch: DetailPatch }
  | { kind: "gone"; reason: string }
  | { kind: "failed"; reason: string };

export async function fetchDetail(source: string, url: string, externalId?: string, title?: string): Promise<DetailOutcome> {
  if (!isDetailSource(source) || !url) return { kind: "failed", reason: "desteklenmeyen kaynak" };
  if ((EXTRA_DETAIL_SOURCES as readonly string[]).includes(source)) {
    // Bu kaynaklarda ilanın kaldırıldığına detaydan karar verilmez; envanter senkronu karar verir.
    const extra = await fetchExtraDetail(source, url, externalId, title);
    return extra ? { kind: "ok", patch: extra } : { kind: "failed", reason: "ilan verisi okunamadı" };
  }
  const res = await fetch(url, {
    headers: { "User-Agent": DETAIL_UA, "Accept-Language": "tr-TR,tr;q=0.9" },
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });
  if (res.status === 404 || res.status === 410) return { kind: "gone", reason: `HTTP ${res.status}` };
  if (!res.ok) return { kind: "failed", reason: `HTTP ${res.status}` };
  if (source === "otoplus" && classifyRedirect(url, res.url || url) === "lost-id") {
    return { kind: "gone", reason: "ilan adresi ilan numarası olmayan bir sayfaya yönlendi" };
  }
  const html = await res.text();
  const patch = source === "otokoc" ? parseOtokocDetail(html) : parseOtoplusDetail(html);
  if (patch) return { kind: "ok", patch };
  // 2026-09 ölçümü: okunamayan Otokoç sayfalarının hepsi HTTP 200 ile dönen "Sayfa Bulunamadı"
  // kabuğuydu (satılmış ilan); eskiden bunlar yalnızca "okunamadı" sayılıp aktif kalıyordu.
  if (source === "otokoc" && classifyOtokocHtml(html) === "gone") {
    return { kind: "gone", reason: "ilan sayfası 'Sayfa Bulunamadı' döndürüyor (satılmış)" };
  }
  return { kind: "failed", reason: "ilan verisi bulunamadı" };
}

export async function fetchDetailPatch(source: string, url: string, externalId?: string, title?: string): Promise<DetailPatch | null> {
  const outcome = await fetchDetail(source, url, externalId, title);
  return outcome.kind === "ok" ? outcome.patch : null;
}

/** Yeni ilan kaydedilmeden önce detay bilgisini listeleme verisine işler. */
export function mergeDetailIntoListing(listing: ScrapedListing, patch: DetailPatch): ScrapedListing {
  const features = { ...listing.features };
  if (patch.color && shouldReplaceColor(features.color, patch.color)) features.color = patch.color;
  if (patch.bodyType && isUnknownValue(features.bodyType)) features.bodyType = patch.bodyType;
  if (shouldReplaceFuel(features.fuelType, patch.fuelType)) features.fuelType = normalizeFuelType(patch.fuelType);
  if (patch.transmission && isUnknownValue(features.transmission)) features.transmission = patch.transmission;
  if (patch.engineSize && !features.engineSize) features.engineSize = patch.engineSize;
  if (patch.horsepower && !features.horsepower) features.horsepower = patch.horsepower;
  if (patch.avgFuelConsumption && !features.avgFuelConsumption) features.avgFuelConsumption = patch.avgFuelConsumption;

  const images = patch.images && patch.images.length > (listing.images?.length ?? 0) ? patch.images : listing.images;
  return {
    ...listing,
    images,
    imageUrl: images?.[0] || listing.imageUrl,
    description: patch.description || listing.description,
    paintChange: patch.paintChange ?? listing.paintChange,
    damageFlag: patch.damageFlag ?? listing.damageFlag,
    damageParts: patch.damageParts?.length ? patch.damageParts : listing.damageParts,
    features,
  };
}

export interface BackfillResult {
  checked: number;
  enriched: number;
  imagesAdded: number;
  /** Sayfası kaldırılmış görünen ilanlar (arşivlenenler + fren nedeniyle bekletilenler). */
  gone: number;
  archived: number;
  failed: number;
}

/**
 * Mevcut kurumsal ilanlar için detay bilgisini arka planda tamamlar. Henüz hiç
 * denenmemiş ilanlar önceliklidir; tek fotoğraflı kalanlar 7 günde bir yeniden denenir.
 */
export async function runDetailBackfill(
  limit = 20,
  options: { source?: DetailSource; log?: (msg: string) => void; delayMs?: number; ids?: unknown[] } = {}
): Promise<BackfillResult> {
  const now = new Date();
  const retryBefore = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sources = options.source ? [options.source] : [...DETAIL_SOURCES];

  // ids verilirse (eksik detay taraması) sıra seçimi atlanır, yalnızca o ilanlar işlenir.
  const docs = await Car.find(
    options.ids
      ? { _id: { $in: options.ids }, sourceSite: { $in: sources }, status: "active", listingUrl: { $nin: ["", null] } }
      : {
          sourceSite: { $in: sources },
          status: "active",
          listingUrl: { $nin: ["", null] },
          $or: [
            { detailCheckedAt: { $exists: false } },
            { "images.1": { $exists: false }, detailCheckedAt: { $lt: retryBefore } },
          ],
        }
  )
    .sort({ detailCheckedAt: 1, createdAt: -1 })
    .limit(limit)
    .select("_id sourceSite listingUrl externalId title images description features detailCheckedAt")
    .lean<
      Array<{
        _id: unknown;
        sourceSite: string;
        listingUrl: string;
        detailCheckedAt?: Date;
        images?: string[];
        description?: string;
        externalId?: string;
        title?: string;
        features?: { color?: string; bodyType?: string; fuelType?: string; transmission?: string; engineSize?: number; horsepower?: number; avgFuelConsumption?: string };
      }>
    >();

  const result: BackfillResult = { checked: 0, enriched: 0, imagesAdded: 0, gone: 0, archived: 0, failed: 0 };
  const perSource = new Map<string, { checked: number; alive: number; gone: Array<{ id: unknown; reason: string }>; incomplete: unknown[] }>();
  for (const doc of docs) {
    result.checked++;
    let outcome: DetailOutcome;
    try {
      outcome = await fetchDetail(doc.sourceSite, doc.listingUrl, doc.externalId, doc.title);
    } catch (err) {
      outcome = { kind: "failed", reason: err instanceof Error ? err.message : "istek hatası" };
    }
    const stats = perSource.get(doc.sourceSite) || { checked: 0, alive: 0, gone: [], incomplete: [] };
    stats.checked++;
    if (outcome.kind === "ok") stats.alive++;
    if (outcome.kind === "gone") stats.gone.push({ id: doc._id, reason: outcome.reason });
    perSource.set(doc.sourceSite, stats);

    const patch = outcome.kind === "ok" ? outcome.patch : null;
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
      if (shouldReplaceFuel(f.fuelType, patch.fuelType)) set["features.fuelType"] = normalizeFuelType(patch.fuelType);
      if (patch.transmission && isUnknownValue(f.transmission)) set["features.transmission"] = patch.transmission;
      if (patch.engineSize && !f.engineSize) set["features.engineSize"] = patch.engineSize;
      if (patch.horsepower && !f.horsepower) set["features.horsepower"] = patch.horsepower;
      if (patch.avgFuelConsumption && !f.avgFuelConsumption) set["features.avgFuelConsumption"] = patch.avgFuelConsumption;
      if (patch.damageParts?.length) set.damageParts = patch.damageParts;
      if (patch.paintChange !== undefined) set.paintChange = patch.paintChange;
      if (patch.damageFlag !== undefined) set.damageFlag = patch.damageFlag;
      result.enriched++;
    } else if (outcome.kind === "gone") {
      result.gone++;
    } else {
      result.failed++;
    }

    // Daha önce de okunmuş (ilk deneme sayılmaz) ve galerisi bu okumadan sonra da tek fotoğraf kalan
    // ilan "eksik" sayılır; arşive alma aşağıda, parti ölçeğindeki güvenlik freninden sonra yapılır.
    const finalImages = (set.images as string[] | undefined) ?? doc.images;
    if (doc.detailCheckedAt && outcome.kind !== "gone" && lacksGallery(doc.sourceSite, finalImages)) {
      stats.incomplete.push(doc._id);
    }

    // updatedAt'e dokunulmaz: detay tamamlamak ilanın "son değişikliği" değildir.
    await Car.updateOne({ _id: doc._id }, { $set: set }, { timestamps: false });
    await new Promise((r) => setTimeout(r, options.delayMs ?? 700));
  }

  // Kaldırılmış sayfalar güçlü kanıttır; yine de partide yeterince canlı sayfa okunmadıysa
  // (site değişmiş/engel) arşivlenmez. Yanlışlıkla arşivlenen ilan, envanter senkronunda
  // görüldüğünde kendiliğinden geri açılır.
  const held: string[] = [];
  for (const [source, stats] of perSource) {
    // Sayfa hiç açılmıyorsa (engel/ağ sorunu) hepsini "eksik" saymamak için aynı fren: parti çoğunlukla
    // okunamıyorsa dokunulmaz.
    if (stats.incomplete.length > 0 && !breakerTripped(stats.checked, stats.incomplete.length, stats.alive)) {
      result.archived += await archiveListings(stats.incomplete as string[], incompleteReason(source), now);
    }
    if (stats.gone.length === 0) continue;
    if (breakerTripped(stats.checked, stats.gone.length, stats.alive)) {
      held.push(source);
      continue;
    }
    for (const g of stats.gone) {
      result.archived += await archiveListings([g.id as string], `${source}: ${g.reason}`, now);
    }
  }

  if (result.checked > 0) {
    const goneText =
      result.gone > 0
        ? `, ${result.gone} satılmış/kaldırılmış (${result.archived} arşive taşındı${held.length ? `; güvenlik freni: ${held.join(", ")}` : ""})`
        : "";
    options.log?.(
      `🖼️ [DETAY] ${result.checked} ilan kontrol edildi: ${result.enriched} zenginleştirildi (+${result.imagesAdded} fotoğraf)${goneText}, ${result.failed} okunamadı.`
    );
  }
  return result;
}
