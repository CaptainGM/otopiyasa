// ============================================================================
// OtoPiyasa - 2020 ve Sonrası Arabam Veri Çekim Motoru (Seçenek 24)
// ============================================================================
// Doğrudan https://www.arabam.com/ikinci-el?minYear=2020 ve kategori/marka
// rotaları üzerinden 2020+ güncel ilanları seri ve kesintisiz çeker.
// Her ilanın detay sayfasına girerek tüm fotoğraflarını, satıcı açıklamasını,
// boya/değişen hasar matrisini ve kasa tipini eksiksiz çeker.
// ============================================================================

import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchPageHtml, isNonCarArabamPage, parseArabamDetailHtml } from "../src/lib/scraper/browser-scrape";
import type { ScrapedListing } from "../src/lib/scraper/types";
import { normalizeBrandModel } from "../src/lib/normalize-brand";
import { normalizeCity } from "../src/lib/normalize-city";
import { parseArabamListPage } from "../src/lib/scraper/arabam-list";
import { outOfScopeReason } from "../src/lib/vehicle-scope";
import { pauseWatcher } from "./bekci-pause.mjs";

pauseWatcher("2020+ arabam çekim");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

// 1. Ortam Değişkenlerini Yükle
for (const envName of [".env", ".env.local"]) {
  const envPath = path.join(projectRoot, envName);
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const idx = line.indexOf("=");
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

// Argümanları Ayrıştır
const args = process.argv.slice(2);
let targetCount = 25000;
let turIlan = 0; // 0 = sınırsız (hedefe kadar tek tur)
let molaDk = 60;
let toplamTur = 0; // 0 = kullanıcı durdurana kadar

let filterDays = 0; // 0 = tümü, 1 = son 24 saat, 3 = son 3 gün
let minYear = 2020; // 0 = tüm yıllar, 2020 = 2020+
let sortParam = ""; // örn: price.desc

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--hedef" && args[i + 1]) {
    targetCount = parseInt(args[++i], 10) || targetCount;
  } else if (arg === "--tur-ilan" && args[i + 1]) {
    turIlan = parseInt(args[++i], 10) || 0;
  } else if (arg === "--mola" && args[i + 1]) {
    molaDk = parseInt(args[++i], 10) || 60;
  } else if (arg === "--tur" && args[i + 1]) {
    toplamTur = parseInt(args[++i], 10) || 0;
  } else if ((arg === "--days" || arg === "--gun") && args[i + 1]) {
    filterDays = parseInt(args[++i], 10) || 0;
  } else if ((arg === "--minYear" || arg === "--yil") && args[i + 1]) {
    minYear = parseInt(args[++i], 10);
  } else if (arg === "--sort" && args[i + 1]) {
    sortParam = args[++i];
  } else if (!arg.startsWith("--") && /^\d+$/.test(arg)) {
    targetCount = parseInt(arg, 10) || targetCount;
  }
}

const ALL_BRANDS = [
  "renault", "fiat", "volkswagen", "ford", "toyota", "opel", "hyundai", "peugeot",
  "honda", "dacia", "skoda", "seat", "nissan", "kia", "citroen", "bmw",
  "mercedes-benz", "audi", "volvo", "chery", "cupra", "togg", "mg", "jeep",
  "suzuki", "subaru", "alfa-romeo", "chevrolet", "mitsubishi", "porsche",
  "mini", "land-rover", "ds-automobiles", "mazda", "ssangyong", "lada", "isuzu", "iveco"
];

const SUV_BRANDS = [
  "dacia", "peugeot", "hyundai", "nissan", "volkswagen", "chery", "toyota",
  "renault", "kia", "skoda", "fiat", "opel", "seat", "cupra", "citroen",
  "ford", "bmw", "mercedes-benz", "audi", "volvo", "jeep", "land-rover", "suzuki", "mg"
];

interface ParsedCar {
  externalId: string;
  sourceSite: string;
  listingUrl: string;
  title: string;
  brand: string;
  model: string;
  year: number;
  price: number;
  mileage: number;
  city: string;
  address: string;
  description: string;
  imageUrl: string;
  images: string[];
  features: {
    fuelType: string;
    transmission: string;
    bodyType: string;
    color: string;
  };
  verifiedKeys: string[];
  sourceCategory?: string;
}

function parseArabam2020SearchPage(html: string): ParsedCar[] {
  const out: ParsedCar[] = [];
  for (const d of parseArabamListPage(html).docs) {
    if (!d.price) continue;
    // Yıl filtresi (minYear > 0 ise geçerli)
    if (minYear > 0 && (!d.year || d.year < minYear)) continue;

    const modelFull = d.modelName || d.title || "";
    const { brand, model } = normalizeBrandModel(
      modelFull.split(" ")[0] || "Bilinmiyor",
      modelFull.split(" ").slice(1).join(" ") || modelFull
    );
    const city = normalizeCity(d.city || "Türkiye");
    const verifiedKeys: string[] = [];
    if (d.transmission) verifiedKeys.push("transmission");
    if (d.fuelType) verifiedKeys.push("fuelType");
    if (d.color) verifiedKeys.push("color");

    out.push({
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
        bodyType: "Belirtilmemiş",
        color: d.color || "Belirtilmemiş",
      },
      verifiedKeys,
      sourceCategory: d.modelPath || d.categoryPath || undefined,
    });
  }
  return out;
}

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

function toScrapedListing(car: ParsedCar): ScrapedListing {
  return {
    externalId: car.externalId,
    sourceSite: "arabam",
    listingUrl: car.listingUrl,
    title: car.title,
    brand: car.brand,
    model: car.model,
    year: car.year,
    price: car.price,
    mileage: car.mileage,
    city: car.city,
    address: car.address,
    description: car.description,
    imageUrl: car.imageUrl,
    images: car.images,
    features: car.features,
    confirmedFeatures: car.verifiedKeys as ScrapedListing["confirmedFeatures"],
    sourceCategory: car.sourceCategory,
  };
}

async function fetchPageWithRetry(url: string, maxRetries = 5): Promise<string> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const pageResult = await fetchPageHtml(url);

      if (pageResult.status === 429) {
        const wait = 15000 + Math.random() * 8000;
        process.stdout.write(`\n  ⏳ [429 Hız Sınırı] ${Math.round(wait / 1000)}sn bekleniyor... `);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }

      if (!pageResult.ok || !pageResult.html || pageResult.html.length < 500) {
        throw new Error(`HTTP ${pageResult?.status || "Hata"}`);
      }

      return pageResult.html;
    } catch (err: any) {
      const isNetErr = !err?.message || /fetch failed|ENOTFOUND|ECONNRESET|ETIMEDOUT|EAI_AGAIN/i.test(err.message);
      const waitTime = Math.min(25000, attempt * 4000);
      if (attempt < maxRetries) {
        if (isNetErr) {
          process.stdout.write(`\n  🌐 [Ağ Beklemesi] ${Math.round(waitTime / 1000)}sn sonra tekrar denenecek (${attempt}/${maxRetries})`);
        }
        await new Promise((r) => setTimeout(r, waitTime));
      } else {
        return "";
      }
    }
  }
  return "";
}

interface TaskQueueItem {
  urlPattern: string;
  maxPages: number;
  label: string;
  category: string;
}

const stateFile = path.join(projectRoot, "logs", "scrape-2020-state.json");

interface ScrapeState {
  lastPage: number;
  totalInserted: number;
  totalUpdated: number;
  discoveredModelPaths: string[];
}

function loadState(): ScrapeState {
  try {
    if (existsSync(stateFile)) {
      return JSON.parse(readFileSync(stateFile, "utf8"));
    }
  } catch {}
  return {
    lastPage: 1,
    totalInserted: 0,
    totalUpdated: 0,
    discoveredModelPaths: [],
  };
}

function saveState(state: ScrapeState) {
  try {
    mkdirSync(path.dirname(stateFile), { recursive: true });
    writeFileSync(stateFile, JSON.stringify(state, null, 2));
  } catch {}
}

async function main() {
  const filterSummary = [
    minYear > 0 ? `${minYear} ve sonrası` : "Tüm yıllar",
    filterDays > 0 ? `Son ${filterDays} gün (days=${filterDays})` : "Tüm zamanlar",
    sortParam ? `Sıralama: ${sortParam}` : "",
  ].filter(Boolean).join(" | ");

  console.log("====================================================================");
  console.log("    OTOPIYASA - 2020+ ARABAM TAM DETAYLI VERİ ÇEKİM MOTORU");
  console.log("====================================================================");
  console.log(`  🎯 Filtre: ${filterSummary}`);
  console.log(`  🌐 Örnek URL: ${buildArabamUrl("otomobil")}1`);
  console.log(`  📊 Hedef: ${turIlan > 0 ? `Tur başına ${turIlan} ilan (Mola: ${molaDk} dk)` : `${targetCount.toLocaleString("tr-TR")} yeni ilan`}`);
  console.log(`  ⚡ Yöntem: Liste Taraması + Detay Sayfası Ziyareti (Tüm Galeri, Açıklama, Hasar Matrisi)`);
  console.log("====================================================================\n");

  const { connectDB } = await import("../src/lib/mongodb.js").catch(async () => await import("../src/lib/mongodb"));
  await connectDB();
  const { Car } = await import("../src/models/Car.js").catch(async () => await import("../src/models/Car"));
  const { saveListing } = await import("../src/lib/scraper/run-scrape");
  const { ManualScrapeLog } = await import("../src/models/ManualScrapeLog.js").catch(async () => await import("../src/models/ManualScrapeLog"));

  const yearThreshold = minYear > 0 ? minYear : 2020;
  const initialActiveYear = await Car.countDocuments({ status: "active", year: { $gte: yearThreshold } });
  const totalActive = await Car.countDocuments({ status: "active" });
  console.log(`  🚗 Veritabanındaki Mevcut ${yearThreshold}+ İlan Sayısı : ${initialActiveYear.toLocaleString("tr-TR")}`);
  console.log(`  📦 Toplam Aktif İlan Sayısı                  : ${totalActive.toLocaleString("tr-TR")}\n`);

  const savedState = loadState();
  const discoveredPaths = new Set<string>(savedState.discoveredModelPaths || []);

  // ArabamListSweep'ten bilinen model yollarını da yükle
  try {
    const { ArabamListSweep } = await import("../src/models/ArabamListSweep");
    for (const doc of (await ArabamListSweep.find({ path: { $ne: null } }).select("path").lean()) as Array<{ path?: string | null }>) {
      if (doc.path) discoveredPaths.add(doc.path.replace(/^\/?(ikinci-el\/)?/, ""));
    }
  } catch {}

  function buildArabamUrl(subPath = ""): string {
    const params: string[] = [];
    if (minYear > 0) params.push(`minYear=${minYear}`);
    if (filterDays > 0) params.push(`days=${filterDays}`);
    if (sortParam) params.push(`sort=${sortParam}`);
    const base = subPath ? `https://www.arabam.com/ikinci-el/${subPath}` : `https://www.arabam.com/ikinci-el`;
    const qs = params.length ? `?${params.join("&")}&page=` : `?page=`;
    return `${base}${qs}`;
  }

  const dayTag = filterDays > 0 ? ` (Son ${filterDays} Gün)` : "";
  const yearTag = minYear > 0 ? `${minYear}+` : "Tüm Yıllar";

  // Arama Rotası Kuyruğunu Oluştur
  const queue: TaskQueueItem[] = [];

  // 1. Genel Havuz
  queue.push({
    urlPattern: buildArabamUrl(""),
    maxPages: 50,
    label: `[Genel] ${yearTag}${dayTag}`,
    category: "otomobil",
  });

  // 2. Ana Kategoriler
  queue.push(
    {
      urlPattern: buildArabamUrl("otomobil"),
      maxPages: 50,
      label: `[Kategori] Otomobil${dayTag}`,
      category: "otomobil",
    },
    {
      urlPattern: buildArabamUrl("arazi-suv-pick-up"),
      maxPages: 50,
      label: `[Kategori] SUV & Pickup${dayTag}`,
      category: "arazi-suv-pick-up",
    },
    {
      urlPattern: buildArabamUrl("ticari-araclar"),
      maxPages: 50,
      label: `[Kategori] Ticari Araçlar${dayTag}`,
      category: "ticari-araclar",
    },
    {
      urlPattern: buildArabamUrl("minivan-panelvan"),
      maxPages: 50,
      label: `[Kategori] Minivan & Panelvan${dayTag}`,
      category: "minivan-panelvan",
    }
  );

  // 3. 38 Otomobil Markası
  for (const brand of ALL_BRANDS) {
    queue.push({
      urlPattern: buildArabamUrl(`otomobil/${brand}`),
      maxPages: 50,
      label: `[Oto] ${brand.toUpperCase()}${dayTag}`,
      category: "otomobil",
    });
  }

  // 4. SUV Markaları
  for (const brand of SUV_BRANDS) {
    queue.push({
      urlPattern: buildArabamUrl(`arazi-suv-pick-up/${brand}`),
      maxPages: 30,
      label: `[SUV] ${brand.toUpperCase()}${dayTag}`,
      category: "arazi-suv-pick-up",
    });
  }

  // 5. Bilinen Model Yolları
  for (const p of discoveredPaths) {
    if (/^[a-z0-9-]+\/[a-z0-9-]+$/.test(p)) {
      queue.push({
        urlPattern: buildArabamUrl(p),
        maxPages: 50,
        label: `[Model] ${p}${dayTag}`,
        category: p.split("/")[0],
      });
    }
  }

  console.log(`  📋 Toplam ${queue.length} Arama Rotası Hazırlandı (${filterSummary}).\n`);

  let totalInserted = 0;
  let totalUpdated = 0;
  let totalScanned = 0;
  let currentRound = 1;
  let roundInserted = 0;
  const startTime = Date.now();
  let lastSyncTime = Date.now();
  let isShuttingDown = false;

  const sampleVehicles: Array<{
    _id?: string;
    brand: string;
    model: string;
    year: number;
    price: number;
    source: string;
    title?: string;
    imageUrl?: string;
    listingUrl?: string;
    status?: string;
    action?: "inserted" | "updated" | "deleted";
  }> = [];

  // Yönetim Paneli için kayıt aç
  let logDoc: any = null;
  try {
    logDoc = await ManualScrapeLog.create({
      actor: "Terminal (scrape.bat - 24 Yeni Nesil 2020+)",
      source: "arabam",
      label: "2020+ Arabam Tam Detaylı Çekim (minYear=2020)",
      scanned: 0,
      inserted: 0,
      updated: 0,
      deleted: 0,
      durationSeconds: 0,
      status: "partial",
      message: `2020+ Arabam tam detaylı çekim başlatıldı (Hedef: ${turIlan > 0 ? `Tur başına ${turIlan}` : targetCount.toLocaleString("tr-TR")} ilan).`,
      bySource: {
        arabam: { scanned: 0, inserted: 0, updated: 0 },
      },
      sampleVehicles: [],
    });
    console.log(`  📋 Yönetim Paneli Denetim Kaydı Açıldı (ID: ${logDoc._id})\n`);
  } catch {}

  async function syncLog(forcedStatus?: "success" | "partial" | "error", customMessage?: string) {
    if (!logDoc?._id) return;
    try {
      const elapsedSec = Math.max(1, Math.round((Date.now() - startTime) / 1000));
      const status = forcedStatus || (turIlan === 0 && totalInserted >= targetCount ? "success" : "partial");
      const msg =
        customMessage ||
        `Terminal (scrape.bat - 24): +${totalInserted.toLocaleString("tr-TR")} yeni 2020+ tam detaylı ilan (tüm galeriler, açıklama, hasar), ~${totalUpdated.toLocaleString("tr-TR")} güncellendi (Taranan: ${totalScanned.toLocaleString("tr-TR")}).`;

      await ManualScrapeLog.updateOne(
        { _id: logDoc._id },
        {
          $set: {
            scanned: totalScanned,
            inserted: totalInserted,
            updated: totalUpdated,
            durationSeconds: elapsedSec,
            status,
            message: msg,
            bySource: {
              arabam: {
                scanned: totalScanned,
                inserted: totalInserted,
                updated: totalUpdated,
              },
            },
            sampleVehicles: sampleVehicles.slice(0, 500),
          },
        }
      );
    } catch {}
  }

  const handleExit = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`\n\n  🛑 Tarama durduruldu. Yönetim Paneli ve yerel durum güncelleniyor...`);
    await syncLog("partial", `Kullanıcı durdurdu (Ctrl+C). +${totalInserted.toLocaleString("tr-TR")} yeni 2020+ tam detaylı ilan kaydedildi.`);
    saveState({
      lastPage: 1,
      totalInserted: savedState.totalInserted + totalInserted,
      totalUpdated: savedState.totalUpdated + totalUpdated,
      discoveredModelPaths: Array.from(discoveredPaths).slice(0, 1000),
    });
    console.log(`  💾 Durum logs/scrape-2020-state.json dosyasına ve Yönetim Paneli'ne kaydedildi.`);
    console.log(`  ✨ Bu oturumda: +${totalInserted} yeni 2020+ tam detaylı ilan eklendi, ~${totalUpdated} güncellendi.\n`);
    process.exit(0);
  };

  process.on("SIGINT", handleExit);
  process.on("SIGTERM", handleExit);

  // Round-Robin Döngüsü: Her turda her rotadan 1 sayfa çekerek homojen marka dağılımı sağlar
  const maxGlobalPages = Math.max(...queue.map((q) => q.maxPages));

  while (!isShuttingDown) {
    if (toplamTur > 0 && currentRound > toplamTur) {
      console.log(`\n  🏁 Belirlenen ${toplamTur} tur tamamlandı.`);
      break;
    }
    if (turIlan === 0 && totalInserted >= targetCount) {
      console.log(`\n  🎯 Hedeflenen ${targetCount.toLocaleString("tr-TR")} yeni 2020+ ilana ulaşıldı!`);
      break;
    }

    roundInserted = 0;
    console.log(`\n====================================================================`);
    console.log(` 🌀 [TUR ${currentRound}] 2020+ İlan Taraması Başlıyor...`);
    console.log(`====================================================================\n`);

    const activeTasks = new Set(queue.map((_, i) => i));

    for (let page = 1; page <= maxGlobalPages; page++) {
      if (isShuttingDown) break;
      if (turIlan > 0 && roundInserted >= turIlan) break;
      if (turIlan === 0 && totalInserted >= targetCount) break;
      if (activeTasks.size === 0) break;

      for (const qIdx of Array.from(activeTasks)) {
        if (isShuttingDown) break;
        if (turIlan > 0 && roundInserted >= turIlan) break;
        if (turIlan === 0 && totalInserted >= targetCount) break;

        const task = queue[qIdx];
        if (page > task.maxPages) {
          activeTasks.delete(qIdx);
          continue;
        }

        const pageUrl = `${task.urlPattern}${page}`;

        try {
          const html = await fetchPageWithRetry(pageUrl);
          if (!html) {
            activeTasks.delete(qIdx);
            continue;
          }

          const parsed = parseArabam2020SearchPage(html);
          if (parsed.length === 0) {
            activeTasks.delete(qIdx);
            continue;
          }

          const cars = parsed.filter(
            (c) =>
              !outOfScopeReason({
                brand: c.brand,
                model: c.model,
                title: c.title,
                bodyType: c.features.bodyType,
                sourceCategory: c.sourceCategory || task.category,
              })
          );

          // Yeni keşfedilen model yollarını rotaya ekle
          for (const c of parsed) {
            if (c.sourceCategory && /^[a-z0-9-]+\/[a-z0-9-]+$/.test(c.sourceCategory)) {
              if (!discoveredPaths.has(c.sourceCategory)) {
                discoveredPaths.add(c.sourceCategory);
              }
            }
          }

          totalScanned += cars.length;

          // Var olanları tek sorguyla bul ve detay durumunu kontrol et
          const existingDocs = (await Car.find(
            { sourceSite: "arabam", externalId: { $in: cars.map((c) => c.externalId) } },
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

          let newInThisPage = 0;
          let updatedInThisPage = 0;

          // 1. Zaten veritabanında olan ve detayları tam olanlar (>1 fotoğraf ve açıklaması olan):
          // Sadece hızlı fiyat ve km kontrolü yapılır (detay sayfası açılmaz, zaman kaybettirmez)
          for (const car of cars.filter((c) => {
            const ex = existingMap.get(c.externalId);
            return ex && ex.imageCount > 1 && ex.hasDesc;
          })) {
            const res = await saveListing({ ...toScrapedListing(car), description: "" });
            if (res === "updated" || res === "reactivated") updatedInThisPage++;
          }

          // 2. YENİ olan araçlar VEYA veritabanında tek fotoğrafla/açıklamasız kalmış eksik araçlar:
          // Her birinin detay sayfasına girilir, tüm galerisi (15-35+ fotoğraf),
          // satıcı açıklaması, hasar matrisi eksiksiz çekilerek veritabanına işlenir!
          const carsToProcess = cars.filter((c) => {
            const ex = existingMap.get(c.externalId);
            return !ex || ex.imageCount <= 1 || !ex.hasDesc;
          });

          for (const car of carsToProcess) {
            if (isShuttingDown) break;
            if (turIlan > 0 && roundInserted >= turIlan) break;
            if (turIlan === 0 && totalInserted >= targetCount) break;

            const isBrandNew = !existingMap.has(car.externalId);
            let listingToSave: ScrapedListing;
            let photoCount = 1;

            const detail = await fetchDetailListing(car.listingUrl);
            if (detail) {
              listingToSave = {
                ...detail,
                sourceCategory: detail.sourceCategory || car.sourceCategory || task.category,
              };
              photoCount = detail.images?.length || 1;
            } else {
              listingToSave = toScrapedListing(car);
            }

            const res = await saveListing(listingToSave);
            let createdId = "";
            try {
              const doc = (await Car.findOne({ sourceSite: "arabam", externalId: car.externalId }, { _id: 1 }).lean()) as any;
              if (doc?._id) createdId = String(doc._id);
            } catch {}

            if (res === "inserted") {
              newInThisPage++;
              roundInserted++;
              totalInserted++;

              sampleVehicles.unshift({
                _id: createdId,
                brand: listingToSave.brand,
                model: listingToSave.model,
                year: listingToSave.year,
                price: listingToSave.price,
                source: "arabam",
                title: listingToSave.title,
                imageUrl: listingToSave.imageUrl || listingToSave.images?.[0] || "",
                listingUrl: listingToSave.listingUrl,
                status: "active",
                action: "inserted",
              });
              if (sampleVehicles.length > 500) sampleVehicles.pop();

              const targetStr = turIlan > 0 ? `${roundInserted}/${turIlan} (Tur ${currentRound})` : `${totalInserted.toLocaleString("tr-TR")}/${targetCount.toLocaleString("tr-TR")}`;
              console.log(
                `  ✨ [YENİ 2020+] ${car.brand} ${car.model} (${car.year}) | ${photoCount} Fotoğraf + Açıklama + Hasar | ${(listingToSave.price || car.price).toLocaleString("tr-TR")} TL (${car.city}) [Yeni: ${targetStr}]`
              );
            } else if (res === "updated" || res === "reactivated") {
              updatedInThisPage++;
              sampleVehicles.unshift({
                _id: createdId,
                brand: listingToSave.brand,
                model: listingToSave.model,
                year: listingToSave.year,
                price: listingToSave.price,
                source: "arabam",
                title: listingToSave.title,
                imageUrl: listingToSave.imageUrl || listingToSave.images?.[0] || "",
                listingUrl: listingToSave.listingUrl,
                status: "active",
                action: "updated",
              });
              if (sampleVehicles.length > 500) sampleVehicles.pop();

              if (!isBrandNew && photoCount > 1) {
                console.log(
                  `  📸 [GALERİ & DETAY ZENGİNLEŞTİ] ${car.brand} ${car.model} (${car.year}) | ${photoCount} Fotoğraf + Açıklama Eklendi | ${(listingToSave.price || car.price).toLocaleString("tr-TR")} TL (${car.city})`
                );
              }
            }

            if (Date.now() - lastSyncTime > 5000 || totalInserted % 5 === 0) {
              lastSyncTime = Date.now();
              syncLog().catch(() => {});
            }

            // Cloudflare bot algılamasını tetiklemeyen insansı nazik bekleme (1.5 - 2.5 sn)
            await new Promise((r) => setTimeout(r, 1600 + Math.random() * 800));
          }

          totalUpdated += updatedInThisPage;

          const elapsedSec = Math.max(1, (Date.now() - startTime) / 1000);
          const speed = Math.round((totalScanned / elapsedSec) * 10) / 10;
          const targetStr = turIlan > 0 ? `${roundInserted}/${turIlan} (Tur ${currentRound})` : `${totalInserted.toLocaleString("tr-TR")}/${targetCount.toLocaleString("tr-TR")}`;

          if (newInThisPage === 0) {
            process.stdout.write(
              `\r  ${task.label.padEnd(20).slice(0, 20)} [Sf.${page}] +${newInThisPage} Yeni, ~${updatedInThisPage} Güncel | 2020+ Yeni: ${targetStr} | Hız: ${speed} araç/sn   `
            );
          }

          // Polite delay: Cloudflare'i tetiklemez (1.2 - 2.0 saniye)
          const delay = 1200 + Math.random() * 800;
          await new Promise((r) => setTimeout(r, delay));
        } catch (err: any) {
          process.stdout.write(`\n  ⚠️ [${task.label}] Sf.${page} geçildi: ${err?.message || err}\n`);
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
    }

    // Durumu periyodik kaydet
    saveState({
      lastPage: 1,
      totalInserted: savedState.totalInserted + totalInserted,
      totalUpdated: savedState.totalUpdated + totalUpdated,
      discoveredModelPaths: Array.from(discoveredPaths).slice(0, 1000),
    });

    if (turIlan > 0 && !isShuttingDown) {
      console.log(`\n\n--------------------------------------------------------------------`);
      console.log(` ☕ Tur ${currentRound} tamamlandı (+${roundInserted} yeni 2020+ tam detaylı ilan).`);
      console.log(`    Yönetim Paneli güncellendi (Kayıtları Yenile diyerek inceleyebilirsin).`);
      console.log(`    ${molaDk} dakika mola veriliyor (Cloudflare IP sağlığı için).`);
      console.log(`    İstediğin zaman Ctrl+C ile durdurabilirsin; kaldığın yer kaydolur.`);
      console.log(`--------------------------------------------------------------------\n`);

      await syncLog("partial", `Tur ${currentRound} tamamlandı (+${roundInserted} yeni ilan). ${molaDk} dk mola veriliyor...`);
      currentRound++;
      if (toplamTur > 0 && currentRound > toplamTur) break;

      const molaSec = molaDk * 60;
      for (let s = molaSec; s > 0; s--) {
        if (isShuttingDown) break;
        const dk = Math.floor(s / 60);
        const sn = s % 60;
        process.stdout.write(`\r  ⏳ Kalan mola süresi: ${dk}:${sn < 10 ? "0" : ""}${sn} (Yönetim Panelinden inceleyebilirsin) ... `);
        await new Promise((r) => setTimeout(r, 1000));
      }
      console.log("\n  ▶️ Mola bitti! Yeni tur başlıyor...\n");
    }
  }

  await syncLog("success", `2020+ tam detaylı çekim tamamlandı. Toplam +${totalInserted.toLocaleString("tr-TR")} yeni ilan eklendi.`);
  handleExit();
}

main().catch((err) => {
  console.error("2020+ Scraper kritik hata:", err);
  process.exit(1);
});
