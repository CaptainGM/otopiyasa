// ============================================================================
// OtoPiyasa - Kademeli Emsal & Nadir Model Turbo Tarama Motoru
// ============================================================================
// 1) En az ilanli olan marka/model veya marka/model/yil gruplarindan baslar.
// 2) Kademeli seviye artirimi yapar:
//    Orn: Once tum eksikleri 4 ilana tamamlar (1 olan 3 ceker, 3 olan 1 ceker).
//    Ardindan hepsi 4 olunca siradaki kademeye gecer: 8, 12, 16, 20...
// 3) Filtreli URL ile Arabam'a direkt gider: ?minYear=X&maxYear=X&sort=date.desc
//    Sayfada hedef disi yil veya cop ilan gezmez.
// 4) Ilk cekiste TUM FOTOGRAFLAR (galeri), ACIKLAMA ve HASAR/TRAMER matrisini alir!
//    Sonradan 'G' ile ek tarama yapmaya gerek kalmaz.
// 5) Hedefe ulastigi anda beklemeden aninda siradaki eksik modele atlar.
// 6) Zamanli modda (Z): Tur basina N ilan (orn: 1000) ceker, M dk mola verir,
//    kaldigi seviyeden sonraki turlarda devam eder.
// 7) Canli Denetim Kaydi: Yonetim Paneli "Manuel Tarama Denetim Kayitlari"
//    tablosuna her 5 saniyede bir canli ilerlemeyi ve eklenen araclari yazar.
// ============================================================================

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchPageHtml, isNonCarArabamPage, parseArabamDetailHtml } from "../src/lib/scraper/browser-scrape";
import { parseArabamListPage, type ArabamListDoc } from "../src/lib/scraper/arabam-list";
import type { ScrapedListing } from "../src/lib/scraper/types";
import { normalizeBrandModel, normalizeBrand } from "../src/lib/normalize-brand";
import { normalizeCity } from "../src/lib/normalize-city";
import { arabamBrandSlug, arabamModelSlug } from "../src/lib/scraper/adapters";
import { outOfScopeReason } from "../src/lib/vehicle-scope";
import { pauseWatcher } from "./bekci-pause.mjs";
import { setArabamPace } from "../src/lib/scraper/rate-limit";

pauseWatcher("kademeli emsal ve nadir model taramasi");
setArabamPace(2800);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

// 1. Ortam Degiskenlerini Yukle
for (const envName of [".env", ".env.local"]) {
  const envPath = path.join(projectRoot, envName);
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const idx = line.indexOf("=");
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

// 2. Parametreleri Ayristir
const args = process.argv.slice(2);
let turIlan = 1000;         // Tur basina cekilecek ilan hedefi
let molaDk = 45;            // Turlar arasi mola (dakika)
let toplamTur = 0;          // 0 = durdurana kadar sonsuz
let minYearFilter = 0;      // 0 = tum yillar, orn: 2020
let maxYearFilter = 0;
let filterDays = 0;         // 0 = tumu, 1 = son 24 saat, 3 = son 3 gun
let nadirMod = false;       // Sadece katalogda olup bizde az olan nadir modeller
let filterBrand = "";       // Spesifik tek marka
let filterModel = "";       // Spesifik tek model
let filterYear = 0;         // Spesifik tek yil

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if ((arg === "--tur-ilan" || arg === "--hedef" || arg === "-h") && args[i + 1]) {
    turIlan = parseInt(args[++i], 10) || turIlan;
  } else if ((arg === "--mola" || arg === "-m") && args[i + 1]) {
    molaDk = parseInt(args[++i], 10) || molaDk;
  } else if ((arg === "--tur" || arg === "-t") && args[i + 1]) {
    toplamTur = parseInt(args[++i], 10) || 0;
  } else if (arg === "--minYear" && args[i + 1]) {
    minYearFilter = parseInt(args[++i], 10) || 0;
  } else if (arg === "--maxYear" && args[i + 1]) {
    maxYearFilter = parseInt(args[++i], 10) || 0;
  } else if ((arg === "--days" || arg === "--gun") && args[i + 1]) {
    filterDays = parseInt(args[++i], 10) || 0;
  } else if (arg === "--nadir") {
    nadirMod = true;
  } else if (arg === "--marka" && args[i + 1]) {
    filterBrand = args[++i].trim();
  } else if (arg === "--model" && args[i + 1]) {
    filterModel = args[++i].trim();
  } else if (arg === "--yil" && args[i + 1]) {
    filterYear = parseInt(args[++i], 10) || 0;
  } else if (!arg.startsWith("--") && /^\d+$/.test(arg)) {
    turIlan = parseInt(arg, 10) || turIlan;
  }
}

// Kademeli artirma seviyeleri
const QUOTA_LEVELS = [4, 8, 12, 16, 20, 25, 30, 40, 50];

let isShuttingDown = false;
process.on("SIGINT", () => {
  console.log("\n\n  [DURDURULUYOR] Lutfen bekleyin, guvenli sekilde kapatiliyor...");
  isShuttingDown = true;
});
process.on("SIGTERM", () => {
  isShuttingDown = true;
});

// Geri sayimli mola bekleyicisi
async function sleepWithCountdown(seconds: number) {
  for (let s = seconds; s > 0; s--) {
    if (isShuttingDown) break;
    const m = Math.floor(s / 60);
    const sec = s % 60;
    process.stdout.write(`\r  ⏳ Mola: Sonraki tur icin bekleniyor... ${m} dk ${sec.toString().padStart(2, "0")} sn  `);
    await new Promise((r) => setTimeout(r, 1000));
  }
  process.stdout.write("\r" + " ".repeat(70) + "\r");
}

function toScrapedListing(d: ArabamListDoc): ScrapedListing {
  const modelFull = d.modelName || d.title || "";
  const parts = modelFull.trim().split(/\s+/);
  const brandGuess = parts[0] || "Bilinmiyor";
  const modelGuess = parts.slice(1).join(" ") || modelFull;
  const { brand, model } = normalizeBrandModel(brandGuess, modelGuess);
  const city = normalizeCity(d.city || "Turkiye");
  const confirmedFeatures: string[] = [];
  if (d.transmission) confirmedFeatures.push("transmission");
  if (d.fuelType) confirmedFeatures.push("fuelType");
  if (d.color) confirmedFeatures.push("color");

  return {
    externalId: `arabam-${d.id}`,
    sourceSite: "arabam",
    listingUrl: d.url.startsWith("http") ? d.url : `https://www.arabam.com${d.url}`,
    title: d.title || modelFull,
    brand,
    model,
    year: d.year || 0,
    price: d.price || 0,
    mileage: d.mileage || 0,
    city,
    address: d.town ? `${city}, ${d.town}` : city,
    description: d.title || modelFull,
    imageUrl: d.photo || "",
    images: d.photo ? [d.photo] : [],
    features: {
      fuelType: d.fuelType || "Bilinmiyor",
      transmission: d.transmission || "Bilinmiyor",
      bodyType: "Belirtilmemis",
      color: d.color || "Belirtilmemis",
    },
    confirmedFeatures: confirmedFeatures as ScrapedListing["confirmedFeatures"],
    sourceCategory: d.modelPath || d.categoryPath || undefined,
  };
}

// Detay sayfasindan tum fotograflari, aciklamayi ve hasar matrisini al
async function fetchDetailListing(listingUrl: string): Promise<ScrapedListing | null> {
  try {
    const page = await fetchPageHtml(listingUrl);
    if (!page || !page.ok || !page.html) return null;
    if (isNonCarArabamPage(page.html)) return null;
    return parseArabamDetailHtml(page.html, page.finalUrl || listingUrl);
  } catch {
    return null;
  }
}

async function fetchPageWithRetry(url: string, maxRetries = 4): Promise<string> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const pageResult = await fetchPageHtml(url);
      if (pageResult.status === 429) {
        const wait = 30000 + Math.random() * 15000;
        process.stdout.write(`\n  [!] [429 Hiz Siniri] ${Math.round(wait / 1000)}sn dinleniliyor... `);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      if (!pageResult.ok || !pageResult.html || pageResult.html.length < 500) {
        throw new Error(`HTTP ${pageResult?.status || "Hata"}`);
      }
      return pageResult.html;
    } catch {
      const waitTime = Math.min(20000, attempt * 3500);
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, waitTime));
      } else {
        return "";
      }
    }
  }
  return "";
}

interface TargetSegment {
  brand: string;
  model: string;
  year?: number;
  currentCount: number;
  category?: string;
  brandSlug?: string;
  modelSlug?: string;
}

async function main() {
  const startTime = Date.now();
  console.log("====================================================================");
  console.log("   OTOPIYASA - KADEMELI EMSAL & NADIR MODEL TURBO MOTORU");
  console.log("====================================================================");
  console.log(`  Tur Basina Hedef : ${turIlan} yeni ilan`);
  console.log(`  Mola Suresi      : ${molaDk} dakika`);
  console.log(`  Toplam Tur       : ${toplamTur === 0 ? "Durdurana kadar (Sonsuz)" : `${toplamTur} tur`}`);
  console.log(`  Calisma Modu     : ${nadirMod ? "Nadir Model Odakli" : "Az Emsalli Segment Odakli (Marka/Model/Yil)"}`);
  console.log(`  Hiz & Koruma     : Ilanlar arasi 3-4 sn | Model gecisleri 4-5 sn (Insansi Pacing)`);
  if (minYearFilter > 0) console.log(`  Yil Siniri       : ${minYearFilter} ve sonrasi`);
  if (filterBrand) console.log(`  Spesifik Filtre  : ${filterBrand} ${filterModel} (${filterYear || "Tum Yillar"})`);
  console.log("====================================================================\n");

  const { connectDB } = await import("../src/lib/mongodb");
  await connectDB();
  const { Car } = await import("../src/models/Car");
  const { saveListing } = await import("../src/lib/scraper/run-scrape");
  const { ArabamCatalog } = await import("../src/models/ArabamCatalog").catch(() => ({ ArabamCatalog: null }));
  const { ManualScrapeLog } = await import("../src/models/ManualScrapeLog.js").catch(async () => await import("../src/models/ManualScrapeLog")).catch(() => ({ ManualScrapeLog: null }));
  const { RareModelAttempt } = await import("../src/models/RareModelAttempt").catch(() => ({ RareModelAttempt: null }));

  // 1. Arabam Katalogunu hafizaya al (slug ve kategori cozumu icin)
  interface CatalogEntry {
    category: string;
    brandSlug: string;
    brandName: string;
    modelSlug: string;
    modelName: string;
    count: number;
  }
  const catalogMap = new Map<string, CatalogEntry>();
  const catalogList: CatalogEntry[] = [];

  if (ArabamCatalog) {
    try {
      const catalogDocs = await ArabamCatalog.find().lean();
      for (const doc of catalogDocs as any[]) {
        for (const m of doc.models || []) {
          if (!m.name) continue;
          const entry: CatalogEntry = {
            category: doc.category || "otomobil",
            brandSlug: doc.brandSlug || arabamBrandSlug(doc.brand),
            brandName: doc.brand,
            modelSlug: m.slug || arabamBrandSlug(m.name),
            modelName: m.name,
            count: m.count || 0,
          };
          catalogList.push(entry);
          const key = `${String(doc.brand).toLowerCase()}::${String(m.name).toLowerCase()}`;
          catalogMap.set(key, entry);
        }
      }
      console.log(`  [i] Katalog yuklendi: ${catalogList.length} resmi Arabam modeli hazir.`);
    } catch {}
  }

  // Model kategori cozum onbellegi
  const resolvedCategoryCache = new Map<string, string>();

  function getModelUrlBase(brand: string, model: string): { urlBase: string; category: string } {
    const bLower = brand.toLowerCase();
    const mLower = model.toLowerCase();
    const directKey = `${bLower}::${mLower}`;
    let inCatalog = catalogMap.get(directKey);

    if (!inCatalog) {
      for (const item of catalogList) {
        if (item.brandName.toLowerCase() === bLower) {
          const itemMLower = item.modelName.toLowerCase();
          if (mLower === itemMLower || mLower.startsWith(itemMLower) || itemMLower.startsWith(mLower)) {
            inCatalog = item;
            break;
          }
        }
      }
    }

    if (inCatalog) {
      const slug = inCatalog.modelSlug.startsWith(inCatalog.brandSlug)
        ? inCatalog.modelSlug
        : `${inCatalog.brandSlug}-${inCatalog.modelSlug}`;
      return {
        urlBase: `https://www.arabam.com/ikinci-el/${inCatalog.category}/${slug}`,
        category: inCatalog.category,
      };
    }

    const bSlug = arabamBrandSlug(brand);
    const mSlug = arabamModelSlug(brand, model);
    const cachedCat = resolvedCategoryCache.get(directKey) || "otomobil";
    return {
      urlBase: `https://www.arabam.com/ikinci-el/${cachedCat}/${mSlug}`,
      category: cachedCat,
    };
  }

  let currentTour = 1;
  let grandTotalInserted = 0;
  let grandTotalUpdated = 0;
  let grandTotalScanned = 0;

  // Yonetim Paneli Canli Denetim Kaydi
  let logDoc: any = null;
  const sampleVehicles: Array<{
    _id?: any;
    source: string;
    title?: string;
    imageUrl?: string;
    listingUrl?: string;
    status?: string;
    action?: "inserted" | "updated" | "deleted";
  }> = [];

  if (ManualScrapeLog) {
    try {
      const actorLabel = nadirMod ? "Terminal (scrape.bat - 6 Nadir Model)" : "Terminal (scrape.bat - 20 Az Emsalli Segment)";
      const opLabel = nadirMod ? "Nadir Model Kademeli Tarama" : "Az Emsalli Segment Kademeli Tarama (Marka/Model/Yıl)";
      logDoc = await ManualScrapeLog.create({
        actor: actorLabel,
        source: "arabam",
        label: opLabel,
        scanned: 0,
        inserted: 0,
        updated: 0,
        deleted: 0,
        durationSeconds: 0,
        status: "partial",
        message: `${opLabel} baslatildi (Tur basina ${turIlan} ilan).`,
        bySource: {
          arabam: { scanned: 0, inserted: 0, updated: 0 },
        },
        sampleVehicles: [],
      });
      console.log(`  📋 Yonetim Paneli Denetim Kaydi Acildi (ID: ${logDoc._id})\n`);
    } catch {}
  }

  let lastSyncTime = Date.now();
  async function syncLog(forcedStatus?: "success" | "partial" | "error", customMessage?: string) {
    if (!ManualScrapeLog || !logDoc?._id) return;
    try {
      const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
      const status = forcedStatus || "partial";
      const msg =
        customMessage ||
        `Terminal: +${grandTotalInserted.toLocaleString("tr-TR")} yeni kademeli emsal ilan (tam galeri, aciklama, hasar), ~${grandTotalUpdated.toLocaleString("tr-TR")} guncellendi (Taranan: ${grandTotalScanned.toLocaleString("tr-TR")}).`;

      await ManualScrapeLog.updateOne(
        { _id: logDoc._id },
        {
          $set: {
            scanned: grandTotalScanned,
            inserted: grandTotalInserted,
            updated: grandTotalUpdated,
            durationSeconds: elapsedSec,
            status,
            message: msg,
            bySource: {
              arabam: {
                scanned: grandTotalScanned,
                inserted: grandTotalInserted,
                updated: grandTotalUpdated,
              },
            },
            sampleVehicles: sampleVehicles.slice(0, 300),
          },
        }
      );
    } catch {}
  }

  // ANA ZAMANLI TUR DONGUSU
  while (!isShuttingDown && (toplamTur === 0 || currentTour <= toplamTur)) {
    console.log(`\n====================================================================`);
    console.log(`  🏁 TUR ${currentTour} BAŞLADI | Hedef: Bu turda ${turIlan} yeni/detaylı ilan`);
    console.log(`====================================================================\n`);

    let roundInserted = 0;
    let roundUpdated = 0;

    // 14 Gunluk Timeout Listesini Yukle:
    // Kaynakta tukenen / hic yeni ilani bulunmayan segmentler 14 gun boyunca tekrar taranmaz.
    const blockedTimeoutKeys = new Set<string>();
    if (RareModelAttempt) {
      try {
        const attempts = await RareModelAttempt.find(
          { retryAfterDays: { $gt: 0 } },
          { brand: 1, familyKey: 1, attemptedAt: 1, retryAfterDays: 1 }
        ).lean();
        const now = Date.now();
        for (const att of attempts as any[]) {
          const attTime = att.attemptedAt ? new Date(att.attemptedAt).getTime() : 0;
          const retryDays = att.retryAfterDays || 14;
          if (attTime + retryDays * 24 * 60 * 60 * 1000 > now) {
            blockedTimeoutKeys.add(`${(att.brand || "").toLowerCase()}::${(att.familyKey || "").toLowerCase()}`);
          }
        }
        if (blockedTimeoutKeys.size > 0) {
          console.log(`  [i] 14 gunluk bekleme listesinde (timeout) ${blockedTimeoutKeys.size} segment var, bu turda atlanacak.\n`);
        }
      } catch {}
    }

    // KADEMELI MERDIVEN DONGUSU (4 -> 8 -> 12 -> 16 -> 20 -> 25 -> 30 -> 40...)
    for (const currentLevel of QUOTA_LEVELS) {
      if (roundInserted >= turIlan || isShuttingDown) break;

      let eligibleTargets: TargetSegment[] = [];

      // A. Spesifik tek arac verilmisse
      if (filterBrand && filterModel) {
        const cur = await Car.countDocuments({
          brand: normalizeBrand(filterBrand),
          model: new RegExp(`^${filterModel}$`, "i"),
          status: "active",
          ...(filterYear > 0 ? { year: filterYear } : {}),
        });
        if (cur < currentLevel) {
          eligibleTargets.push({
            brand: filterBrand,
            model: filterModel,
            year: filterYear > 0 ? filterYear : undefined,
            currentCount: cur,
          });
        }
      }
      // B. Nadir Model Modu
      else if (nadirMod) {
        const existingAgg = await Car.aggregate([
          { $match: { status: "active", brand: { $type: "string", $ne: "" }, model: { $type: "string", $ne: "" } } },
          { $group: { _id: { brand: { $toLower: "$brand" }, model: { $toLower: "$model" } }, count: { $sum: 1 } } },
        ]);
        const existingCounts = new Map<string, number>();
        for (const g of existingAgg) {
          if (g._id?.brand && g._id?.model) {
            existingCounts.set(`${g._id.brand}::${g._id.model}`, g.count);
          }
        }

        for (const cat of catalogList) {
          if (cat.count < 2) continue;
          const key = `${cat.brandName.toLowerCase()}::${cat.modelName.toLowerCase()}`;
          const cur = existingCounts.get(key) || 0;
          if (cur < currentLevel) {
            eligibleTargets.push({
              brand: cat.brandName,
              model: cat.modelName,
              currentCount: cur,
              category: cat.category,
              brandSlug: cat.brandSlug,
              modelSlug: cat.modelSlug,
            });
          }
        }
        eligibleTargets.sort((a, b) => a.currentCount - b.currentCount);
      }
      // C. Az Emsalli Segment Modu (Marka + Model + Yil)
      else {
        const matchFilter: any = {
          status: "active",
          brand: { $type: "string", $ne: "" },
          model: { $type: "string", $nin: ["", "Model", "Bilinmiyor"] },
          year: { $type: "number", $gte: 1990 },
        };
        if (minYearFilter > 0) matchFilter.year.$gte = minYearFilter;
        if (maxYearFilter > 0) matchFilter.year.$lte = maxYearFilter;

        const groups = await Car.aggregate([
          { $match: matchFilter },
          {
            $group: {
              _id: { brand: "$brand", model: "$model", year: "$year" },
              count: { $sum: 1 },
            },
          },
          { $match: { count: { $lt: currentLevel } } },
          { $sort: { count: 1 } },
          { $limit: 400 },
        ]);

        for (const g of groups) {
          eligibleTargets.push({
            brand: g._id.brand,
            model: g._id.model,
            year: g._id.year,
            currentCount: g.count,
          });
        }
      }

      // 14 gunluk timeout listesindekileri filtrele
      const beforeFilterCount = eligibleTargets.length;
      eligibleTargets = eligibleTargets.filter((t) => {
        const key = t.year
          ? `${t.brand.toLowerCase()}::${t.model.toLowerCase()}::year::${t.year}`
          : `${t.brand.toLowerCase()}::${t.model.toLowerCase()}`;
        return !blockedTimeoutKeys.has(key);
      });
      const skippedTimeoutCount = beforeFilterCount - eligibleTargets.length;
      if (skippedTimeoutCount > 0) {
        console.log(`  [i] Bu kademede 14 gunluk timeout nedeniyle ${skippedTimeoutCount} tukenmis segment atlandi.`);
      }

      if (eligibleTargets.length === 0) {
        continue;
      }

      console.log(`\n  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`  🎯 KADEME SEVİYESİ: ${currentLevel} İLAN HEDEFİ (${eligibleTargets.length} eksik grup tamamlanıyor)`);
      console.log(`  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

      // Her hedef icin tarama
      for (let sIdx = 0; sIdx < eligibleTargets.length; sIdx++) {
        if (roundInserted >= turIlan || isShuttingDown) break;

        const target = eligibleTargets[sIdx];
        const needCount = currentLevel - target.currentCount;
        if (needCount <= 0) continue;

        const yearLabel = target.year ? `(${target.year})` : "";
        console.log(`\n[Grup ${sIdx + 1}/${eligibleTargets.length}] ${target.brand} ${target.model} ${yearLabel} | Mevcut: ${target.currentCount} -> Hedef: ${currentLevel} (+${needCount} lazım)`);

        const { urlBase, category } = getModelUrlBase(target.brand, target.model);
        const categoriesToTry = [category, "otomobil", "arazi-suv-pick-up", "minivan-panelvan"].filter(
          (c, idx, arr) => arr.indexOf(c) === idx
        );

        let segmentInserted = 0;

        for (const tryCat of categoriesToTry) {
          if (segmentInserted >= needCount || isShuttingDown) break;

          let catBase = urlBase;
          if (tryCat !== category) {
            catBase = urlBase.replace(`/ikinci-el/${category}/`, `/ikinci-el/${tryCat}/`);
          }

          // Sayfa 1 ve gerekirse Sayfa 2
          for (let page = 1; page <= 3; page++) {
            if (segmentInserted >= needCount || isShuttingDown) break;

            const params: string[] = [];
            if (target.year) {
              params.push(`minYear=${target.year}`);
              params.push(`maxYear=${target.year}`);
            } else if (minYearFilter > 0) {
              params.push(`minYear=${minYearFilter}`);
            }
            if (filterDays > 0) params.push(`days=${filterDays}`);
            params.push("sort=date.desc");
            if (page > 1) params.push(`page=${page}`);

            const pageUrl = `${catBase}?${params.join("&")}`;
            const html = await fetchPageWithRetry(pageUrl);
            if (!html) break;

            const listPage = parseArabamListPage(html);
            if (!listPage.docs || listPage.docs.length === 0) {
              break;
            }

            resolvedCategoryCache.set(`${target.brand.toLowerCase()}::${target.model.toLowerCase()}`, tryCat);

            const extIds = listPage.docs.map((d) => `arabam-${d.id}`);
            const existingDocs = (await Car.find(
              { sourceSite: "arabam", externalId: { $in: extIds } },
              { externalId: 1, images: 1, description: 1 }
            ).lean()) as unknown as Array<{ externalId: string; images?: string[]; description?: string }>;

            const existingMap = new Map<string, { imageCount: number; hasDesc: boolean }>(
              existingDocs.map((d) => [
                d.externalId,
                {
                  imageCount: d.images?.length || 0,
                  hasDesc: Boolean(d.description && d.description.length > 30),
                },
              ])
            );

            let pageNewCount = 0;

            for (const doc of listPage.docs) {
              if (segmentInserted >= needCount || roundInserted >= turIlan || isShuttingDown) break;
              if (!doc.price) continue;
              if (target.year && doc.year && doc.year !== target.year) continue;

              grandTotalScanned++;
              const extId = `arabam-${doc.id}`;
              const ex = existingMap.get(extId);

              if (ex && ex.imageCount > 1 && ex.hasDesc) {
                try {
                  const basicListing = toScrapedListing(doc);
                  const res = await saveListing({ ...basicListing, description: "" });
                  if (res === "updated") {
                    roundUpdated++;
                    grandTotalUpdated++;
                  }
                } catch {}
                continue;
              }

              const fullListingUrl = doc.url.startsWith("http") ? doc.url : `https://www.arabam.com${doc.url}`;
              let detailedListing: ScrapedListing | null = await fetchDetailListing(fullListingUrl);

              let listingToSave: ScrapedListing;
              let photoCount = 1;

              if (detailedListing) {
                listingToSave = {
                  ...detailedListing,
                  sourceCategory: detailedListing.sourceCategory || doc.categoryPath || tryCat,
                };
                photoCount = detailedListing.images?.length || 1;
              } else {
                listingToSave = toScrapedListing(doc);
              }

              if (outOfScopeReason({ brand: listingToSave.brand, model: listingToSave.model, title: listingToSave.title })) {
                continue;
              }

              const res = await saveListing(listingToSave);
              if (res === "inserted" || res === "reactivated") {
                segmentInserted++;
                roundInserted++;
                grandTotalInserted++;
                pageNewCount++;

                sampleVehicles.unshift({
                  source: "arabam",
                  title: listingToSave.title,
                  imageUrl: listingToSave.imageUrl || listingToSave.images?.[0] || "",
                  listingUrl: listingToSave.listingUrl,
                  status: "active",
                  action: "inserted",
                });
                if (sampleVehicles.length > 300) sampleVehicles.pop();

                const progressInGroup = `${target.currentCount + segmentInserted}/${currentLevel}`;
                const progressInTour = `${roundInserted}/${turIlan}`;
                console.log(
                  `  ✨ [DETAYLI EMSAL] ${listingToSave.brand} ${listingToSave.model} (${listingToSave.year}) | ` +
                  `${photoCount} Fotoğraf + Açıklama + Hasar | ` +
                  `${(listingToSave.price || doc.price || 0).toLocaleString("tr-TR")} TL (${listingToSave.city}) ` +
                  `[Grup: ${progressInGroup} | Tur: ${progressInTour}]`
                );
              } else if (res === "updated") {
                roundUpdated++;
                grandTotalUpdated++;
                if (photoCount > 1) {
                  console.log(
                    `  🔄 [GALERİ GÜNCELLENDİ] ${listingToSave.brand} ${listingToSave.model} (${listingToSave.year}) | ` +
                    `${photoCount} Fotoğraf + Açıklama Eklendi`
                  );
                }
              }

              // Canli denetim kaydini senkronla
              if (Date.now() - lastSyncTime > 4000 || grandTotalInserted % 5 === 0) {
                await syncLog();
                lastSyncTime = Date.now();
              }

              await new Promise((r) => setTimeout(r, 2800 + Math.random() * 1200));
            }

            await new Promise((r) => setTimeout(r, 2000 + Math.random() * 800));
            if (pageNewCount === 0 && listPage.docs.length < 20) break;
          }

          if (segmentInserted >= needCount) break;
        }

        if (segmentInserted >= needCount) {
          console.log(`  🎯 Hedefe ulaşıldı! (${target.brand} ${target.model} ${yearLabel} => ${currentLevel} adet oldu). Sıradakine geçiliyor.`);
          if (RareModelAttempt) {
            const familyKey = target.year
              ? `${target.model.toLowerCase()}::year::${target.year}`
              : target.model.toLowerCase();
            await RareModelAttempt.deleteOne({ brand: target.brand, familyKey }).catch(() => {});
          }
        } else if (segmentInserted > 0) {
          console.log(`  ℹ️  Kısmi artış: +${segmentInserted} yeni ilan eklendi (toplam: ${target.currentCount + segmentInserted}).`);
        } else {
          console.log(`  ⏭️  Kaynakta bu filtreye uygun yeni ilan kalmadı. 14 gün bekleme listesine (timeout) alındı.`);
          if (RareModelAttempt) {
            const familyKey = target.year
              ? `${target.model.toLowerCase()}::year::${target.year}`
              : target.model.toLowerCase();
            await RareModelAttempt.updateOne(
              { brand: target.brand, familyKey },
              {
                $set: {
                  model: target.model,
                  attemptedAt: new Date(),
                  found: 0,
                  retryAfterDays: 14,
                  reason: "exhausted_source",
                  added: 0,
                  before: target.currentCount,
                  after: target.currentCount,
                },
              },
              { upsert: true }
            ).catch(() => {});
            blockedTimeoutKeys.add(`${target.brand.toLowerCase()}::${familyKey.toLowerCase()}`);
          }
        }

        await new Promise((r) => setTimeout(r, 4000 + Math.random() * 1200));
      }
    }

    // TUR BITIS RAPORU
    console.log(`\n====================================================================`);
    console.log(`  🏁 TUR ${currentTour} TAMAMLANDI!`);
    console.log(`  Bu turda eklenen yeni/detaylı ilan : +${roundInserted.toLocaleString("tr-TR")}`);
    console.log(`  Bu turda güncellenen ilan          : ${roundUpdated.toLocaleString("tr-TR")}`);
    console.log(`  Toplam genel eklenen               : +${grandTotalInserted.toLocaleString("tr-TR")}`);
    console.log(`====================================================================\n`);

    await syncLog(
      toplamTur > 0 && currentTour >= toplamTur ? "success" : "partial",
      `Tur ${currentTour} bitti: +${grandTotalInserted.toLocaleString("tr-TR")} yeni kademeli emsal eklendi.`
    );

    if (toplamTur > 0 && currentTour >= toplamTur) {
      console.log(`  Hedeflenen ${toplamTur} tur basariyla tamamlandi. Islem bitti.`);
      break;
    }

    if (isShuttingDown) break;

    // MOLA DONGUSU
    console.log(`  ⏳ Turlar arası mola: ${molaDk} dakika dinleniliyor...`);
    console.log(`  (Istedigin zaman Ctrl+C ile guvenle durdurabilirsin, ilerleme kaydedildi)\n`);
    await sleepWithCountdown(molaDk * 60);

    currentTour++;
  }

  await syncLog("success", `Tarama sonlandi: +${grandTotalInserted.toLocaleString("tr-TR")} yeni detayli ilan eklendi.`);

  console.log("\n====================================================================");
  console.log("                     TARAMA SONLANDI");
  console.log("====================================================================");
  console.log(`  Toplam Eklenen Yeni/Detayli : +${grandTotalInserted.toLocaleString("tr-TR")}`);
  console.log(`  Toplam Guncellenen          : ${grandTotalUpdated.toLocaleString("tr-TR")}`);
  console.log("====================================================================\n");

  process.exit(0);
}

main().catch((err) => {
  console.error("Kritik motor hatasi:", err);
  process.exit(1);
});
