// ============================================================================
// OtoPiyasa - Ultra Hızlı Turbo Arabam Scraper (Toplu Sayfa İçe Aktarma)
// ============================================================================
// Arama tablolarındaki 20 aracı tek bir HTTP isteğinde doğrudan ayrıştırır.
// Her araç için ayrı ayrı detay sayfası indirme beklemesini kaldırır.
// Hız: ~25 araç / saniye (~1.500 araç / dakika)
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
pauseWatcher("turbo çekim");

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

const targetCount = parseInt(process.argv[2] || "50000", 10);

/** Kaynağın vasıta kategorileri (yol tabanlı, robots.txt'e uygun). ATV/UTV, deniz/hava ve kiralık kapsam dışı. */
const ALL_CATEGORIES = [
  { slug: "otomobil", label: "Otomobil" },
  { slug: "arazi-suv-pick-up", label: "Arazi, SUV & Pickup" },
  { slug: "minivan-panelvan", label: "Minivan & Panelvan" },
  { slug: "ticari-araclar", label: "Ticari Araçlar" },
  { slug: "motosiklet", label: "Motosiklet" },
  { slug: "karavan", label: "Karavan" },
];

// İkinci argüman: virgülle kategori listesi ("motosiklet,ticari-araclar"); verilmezse hepsi.
// Bayraklar (--detaysiz) kategori sayılmaz: Windows boş argümanı ("") düşürürse bayrak 3. sıraya kayabilir.
const categoryArg = (process.argv.slice(3).find((v) => !v.startsWith("--")) || "").split(",").map((v) => v.trim()).filter(Boolean);
const CATEGORIES = categoryArg.length ? ALL_CATEGORIES.filter((c) => categoryArg.includes(c.slug)) : ALL_CATEGORIES;
// Yalnızca belirli kategoriler istendiyse o kategoriler derin taranır (az ilanlı kategorilerin tamamı).
const CATEGORY_ONLY = categoryArg.length > 0;
// "--detaysiz": yeni ilanların ilan sayfası açılmaz (çok daha hızlı; galeri ve özellikler bekçiyle tamamlanır).
const SKIP_DETAIL = process.argv.includes("--detaysiz");

const ALL_BRANDS = [
  "renault", "fiat", "volkswagen", "ford", "toyota", "opel", "hyundai", "peugeot",
  "honda", "dacia", "skoda", "seat", "nissan", "kia", "citroen", "bmw",
  "mercedes-benz", "audi", "volvo", "chery", "cupra", "togg", "mg", "jeep",
  "suzuki", "subaru", "alfa-romeo", "chevrolet", "mitsubishi", "porsche",
  "mini", "land-rover", "ds-automobiles", "mazda", "ssangyong", "lada", "isuzu", "iveco"
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
  /** Sayfanın gömülü verisinden okunan (tahmin olmayan) özellikler. */
  verifiedKeys: string[];
  /** Kaynağın kategori yolu: araç tipi buradan çıkar. */
  sourceCategory?: string;
}

/**
 * Liste sayfası: tablo yerine sayfanın gömülü verisi okunur (bkz. arabam-list.ts). Tablonun sütun sırası
 * kategoriye göre değişiyor (motosiklet, ticari); gömülü veri her kategoride aynı ve vites/yakıt/renk gerçek.
 */
function parseArabamSearchPage(html: string): ParsedCar[] {
  const out: ParsedCar[] = [];
  for (const d of parseArabamListPage(html).docs) {
    // Fiyatı TL olmayan ya da okunamayan ilan alınmaz.
    if (!d.price) continue;
    const modelFull = d.modelName || d.title || "";
    // "Mercedes - Benz G 400 d", "Land Rover Range Rover Velar": iki kelimelik markalar düzeltilir.
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
      listingUrl: d.url,
      title: d.title || modelFull,
      brand,
      model,
      year: d.year || 0,
      price: d.price,
      mileage: d.mileage || 0,
      city,
      address: d.town ? `${city}, ${d.town}` : city,
      description: d.title || modelFull,
      imageUrl: d.photo || "",
      images: d.photo ? [d.photo] : [],
      // Vites/yakıt/renk yalnızca gömülü veriden; kasa tipi liste verisinde yok (bekçi ya da ilan sayfası doldurur).
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

/** Yeni ilanın kendi sayfası: tüm fotoğraflar, satıcı açıklaması, hasar, kasa tipi ve kesin kategori. */
async function fetchDetailListing(listingUrl: string): Promise<ScrapedListing | "excluded" | null> {
  try {
    const page: any = await Promise.race([
      fetchPageHtml(listingUrl),
      new Promise((resolve) => setTimeout(() => resolve(null), 20000)),
    ]);
    if (!page || !page.ok || !page.html) return null;
    if (isNonCarArabamPage(page.html)) return "excluded";
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

async function fetchPageWithRetry(url: string, maxRetries = 6): Promise<string> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const pageResult = await fetchPageHtml(url);

      if (pageResult.status === 429) {
        const wait = 12000 + Math.random() * 6000;
        console.log(`\n  ⏳ [429 Hız Sınırı] ${Math.round(wait / 1000)}sn mola veriliyor...`);
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
          process.stdout.write(`\n  🌐 [İnternet Kesintisi] Bağlantı bekleniyor... (${attempt}/${maxRetries}) -> ${Math.round(waitTime / 1000)}sn içinde tekrar denenecek`);
        } else {
          process.stdout.write(`\n  ⚠️ İstek hatası: ${err.message} (${attempt}/${maxRetries})`);
        }
        await new Promise((r) => setTimeout(r, waitTime));
      } else {
        console.warn(`\n  ❌ Sayfa indirilemedi (${url}): ${err?.message || err}`);
        return "";
      }
    }
  }
  return "";
}

async function main() {
  console.log("====================================================================");
  console.log("          OTOPIYASA - TURBO ARABAM SERİ VERİ ÇEKİM MOTORU");
  console.log("====================================================================");
  console.log(`  🎯 Hedef Yeni İlan Sayısı: ${targetCount.toLocaleString("tr-TR")}`);
  console.log(`  ⚡ Yöntem: Liste sayfası gömülü verisi (sayfa başına 20 ilan)${SKIP_DETAIL ? "" : " + yeni ilanlarda ilan sayfası"}`);
  console.log(`  📁 Kategoriler: ${CATEGORIES.map((c) => c.label).join(", ")}${CATEGORY_ONLY ? "" : " + 40 marka"}\n`);

  const { connectDB } = await import("../src/lib/mongodb.js").catch(async () => await import("../src/lib/mongodb"));
  await connectDB();
  const { Car } = await import("../src/models/Car.js").catch(async () => await import("../src/models/Car"));
  // Ortam değişkenleri (MONGODB_URI) yüklendikten sonra içe aktarılmalı; statik içe aktarma betiği başlarken çökertir.
  const { saveListing } = await import("../src/lib/scraper/run-scrape");
  const { ManualScrapeLog } = await import("../src/models/ManualScrapeLog.js").catch(async () => await import("../src/models/ManualScrapeLog"));

  const initialActive = await Car.countDocuments({ status: "active" });
  console.log(`  📊 Başlangıç Aktif İlan Sayısı: ${initialActive.toLocaleString("tr-TR")}\n`);

  let totalInserted = 0;
  let totalUpdated = 0;
  let totalScanned = 0;
  const startTime = Date.now();
  let lastSyncTime = Date.now();
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
  }> = [];

  // Yönetim Paneli (Manuel Tarama) için canlı kayıt oluştur
  let logDoc: any = null;
  try {
    logDoc = await ManualScrapeLog.create({
      actor: "Terminal (scrape.bat - Turbo Seri Çekim)",
      source: "arabam",
      label: "Turbo Seri İlan Çekimi (Arabam.com)",
      scanned: 0,
      inserted: 0,
      updated: 0,
      deleted: 0,
      durationSeconds: 0,
      status: "partial",
      message: `Turbo seri çekim başlatıldı (Hedef: ${targetCount.toLocaleString("tr-TR")} yeni ilan).`,
      bySource: {
        arabam: { scanned: 0, inserted: 0, updated: 0 },
      },
      sampleVehicles: [],
    });
    console.log(`  📋 Yönetim Paneli Denetim Kaydı Açıldı (ID: ${logDoc._id})\n`);
  } catch (err: any) {
    console.warn(`  ⚠️ Denetim günlüğü oluşturulamadı: ${err?.message || err}`);
  }

  // Canlı durumu MongoDB ManualScrapeLog'a senkronize et
  async function syncLog(forcedStatus?: "success" | "partial" | "error", customMessage?: string) {
    if (!logDoc?._id) return;
    try {
      const elapsedSec = Math.max(1, Math.round((Date.now() - startTime) / 1000));
      const status = forcedStatus || (totalInserted >= targetCount ? "success" : "partial");
      const msg =
        customMessage ||
        `Terminal (scrape.bat): +${totalInserted.toLocaleString("tr-TR")} yeni ilan eklendi, ~${totalUpdated.toLocaleString("tr-TR")} ilanın fiyatı eşitlendi (Taranan: ${totalScanned.toLocaleString("tr-TR")}).`;

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
            sampleVehicles: sampleVehicles.slice(0, 30),
          },
        }
      );
    } catch {
      // sessiz
    }
  }

  // Kullanıcı mola verip Ctrl+C bastığında durumu panele güvenle kaydet
  let isShuttingDown = false;
  const handleGracefulExit = async (signalName: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`\n\n  🛑 [${signalName}] Mola verildi / Tarama durduruldu.`);
    console.log(`  💾 İlerleme (+${totalInserted.toLocaleString("tr-TR")} yeni, ~${totalUpdated.toLocaleString("tr-TR")} güncel) Yönetim Paneli'ne kaydediliyor...`);
    await syncLog(
      "partial",
      `Kullanıcı mola verdi / durdurdu (${signalName}). +${totalInserted.toLocaleString("tr-TR")} yeni ilan, ~${totalUpdated.toLocaleString("tr-TR")} güncel ilan kaydedildi.`
    );
    console.log(`  ✅ Kayıt başarıyla güncellendi! Yönetici panelinden (Manuel Tarama) inceleyebilirsin.\n`);
    process.exit(0);
  };

  process.on("SIGINT", () => handleGracefulExit("Ctrl+C"));
  process.on("SIGTERM", () => handleGracefulExit("SIGTERM"));

  // Model adresleri ("otomobil/renault-clio"): Arabam'ın kendi verdiği yol; geçerli biçim dışındakiler alınmaz.
  const MODEL_PATH = /^[a-z0-9-]+\/[a-z0-9-]+$/;
  const modelPathFile = path.join(projectRoot, "logs", "turbo-model-paths.json");
  const discoveredModelPaths = new Set<string>();
  try {
    if (existsSync(modelPathFile)) for (const p of JSON.parse(readFileSync(modelPathFile, "utf8")) as string[]) discoveredModelPaths.add(p);
  } catch {
    // bozuk dosya: baştan toplanır
  }
  function saveModelPaths() {
    try {
      mkdirSync(path.dirname(modelPathFile), { recursive: true });
      writeFileSync(modelPathFile, JSON.stringify([...discoveredModelPaths].sort()));
    } catch {
      // yazılamazsa bir sonraki çalışmada yeniden toplanır
    }
  }

  interface TaskQueueItem {
    urlPattern: string;
    maxPages: number;
    label: string;
    category: string;
  }

  const queue: TaskQueueItem[] = [];

  // robots.txt `?sort=` desenini yasaklıyor; sıralama parametresi kullanılmaz, yalnızca `?page=`.
  // 1. Kategori sayfaları (yalnızca kategori istendiyse derin: az ilanlı kategorilerin tamamı gezilir)
  for (const cat of CATEGORIES) {
    queue.push({
      urlPattern: `https://www.arabam.com/ikinci-el/${cat.slug}?page=`,
      maxPages: CATEGORY_ONLY ? 500 : 50,
      label: `[Kategori] ${cat.label}`,
      category: cat.slug,
    });
  }

  // 2. Marka bazlı taramalar (otomobil ve arazi/SUV kategorileri seçiliyse)
  const wantsCar = CATEGORIES.some((c) => c.slug === "otomobil");
  const wantsSuv = CATEGORIES.some((c) => c.slug === "arazi-suv-pick-up");
  for (const brand of wantsCar || wantsSuv ? ALL_BRANDS : []) {
    if (wantsCar) {
      queue.push({
        urlPattern: `https://www.arabam.com/ikinci-el/otomobil/${brand}?page=`,
        maxPages: 25,
        label: `[Marka] ${brand.toUpperCase()} Otomobil`,
        category: "otomobil",
      });
    }
    if (wantsSuv) {
      queue.push({
        urlPattern: `https://www.arabam.com/ikinci-el/arazi-suv-pick-up/${brand}?page=`,
        maxPages: 20,
        label: `[SUV Marka] ${brand.toUpperCase()} SUV`,
        category: "arazi-suv-pick-up",
      });
    }
  }

  console.log(`  📋 Toplam ${queue.length} Arama Rotası Hazırlandı (Dengeli Marka/Model Dağılımı).\n`);

  // DENGELİ ROTASYON (Round-Robin):
  // Tek bir markanın veya kategorinin 50 sayfasını arka arkaya çekip veritabanını tek tipleştirmek yerine,
  // her turda tüm markaların ve kategorilerin 1'er sayfasını (Renault 20, Fiat 20, BMW 20, SUV 20...) çeker.
  // Böylece hedef 1.000 de olsa 5.000 de olsa tüm marka ve modellerden dengeli, homojen bir havuz oluşur.

  /** Verilen rotaları sayfa sayfa (her turda her rotadan 1 sayfa) gezer; hedefe ulaşınca ya da Ctrl+C ile durur. */
  async function crawl(queue: TaskQueueItem[], phaseName: string) {
    const maxGlobalPages = Math.max(0, ...queue.map((t) => t.maxPages));
    const activeTasks = new Set(queue.map((_, i) => i));

    for (let page = 1; page <= maxGlobalPages; page++) {
      if (isShuttingDown || totalInserted >= targetCount || activeTasks.size === 0) break;

      console.log(`\n🌀 [${phaseName} TUR ${page}] Tüm Marka ve Kategorilerden Sayfa ${page} Çekiliyor (Kalan Aktif Rota: ${activeTasks.size})...`);

      for (const qIdx of Array.from(activeTasks)) {
        if (isShuttingDown || totalInserted >= targetCount) break;

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

          // Kapsam dışı ilanlar (ATV/UTV vb.) hiç eklenmez (bkz. vehicle-scope.ts).
          const parsed = parseArabamSearchPage(html);
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
          for (const c of parsed) if (c.sourceCategory && MODEL_PATH.test(c.sourceCategory)) discoveredModelPaths.add(c.sourceCategory);
        totalScanned += cars.length;

          const existingIds = new Set(
            ((await Car.find({ sourceSite: "arabam", externalId: { $in: cars.map((c) => c.externalId) } }, { externalId: 1 }).lean()) as any[]).map(
              (d) => d.externalId
            )
          );

          // Tüm kayıtlar ortak akıştan geçer (saveListing): fiyat geçmişi yalnızca fiyat değişince yazılır, favori
          // bildirimi gider, gerçek özellik tahminle ezilmez, yöneticinin kaldırdığı ilan geri açılmaz.
          let newInThisPage = 0;
          let updatedInThisPage = 0;
          const count = (r: string) => {
            if (r === "inserted") newInThisPage++;
            else if (r === "updated" || r === "reactivated") updatedInThisPage++;
          };
          for (const car of cars.filter((c) => existingIds.has(c.externalId))) {
            // Liste verisinde açıklama yok (başlık var): kayıtlı satıcı açıklaması ezilmesin.
            count(await saveListing({ ...toScrapedListing(car), description: "" }));
          }
          const newCars = cars.filter((c) => !existingIds.has(c.externalId));
          for (let i = 0; i < newCars.length; i += 2) {
            if (isShuttingDown) break;
            const batch = newCars.slice(i, i + 2);
            await Promise.all(
              batch.map(async (car) => {
                const detail = SKIP_DETAIL ? null : await fetchDetailListing(car.listingUrl);
                if (detail === "excluded") return;
                const listing = detail
                  ? { ...detail, sourceCategory: detail.sourceCategory || car.sourceCategory || task.category }
                  : { ...toScrapedListing(car), sourceCategory: car.sourceCategory || task.category };
                count(await saveListing(listing));
              })
            );
          }

          totalInserted += newInThisPage;
          totalUpdated += updatedInThisPage;

          for (const c of cars) {
            if (sampleVehicles.length < 30) {
              sampleVehicles.push({
                brand: c.brand,
                model: c.model,
                year: c.year,
                price: c.price,
                source: "arabam",
                title: c.title,
                imageUrl: c.imageUrl,
                listingUrl: c.listingUrl,
              });
            }
          }

          const elapsedSec = Math.max(1, (Date.now() - startTime) / 1000);
          const speed = Math.round((totalScanned / elapsedSec) * 10) / 10;
          const progressPct = Math.min(100, Math.round((totalInserted / targetCount) * 100));

          process.stdout.write(
            `\r  [${task.label.slice(0, 22)} Sf.${page}] +${newInThisPage} Yeni, ~${updatedInThisPage} Güncel | Toplam Yeni: +${totalInserted.toLocaleString("tr-TR")} / ${targetCount.toLocaleString("tr-TR")} (%${progressPct}) | Hız: ${speed} araç/sn   `
          );

          if (totalScanned % 40 === 0 || Date.now() - lastSyncTime > 8000) {
            lastSyncTime = Date.now();
            syncLog().catch(() => {});
          }

          // Ritim: Arabam'a nazik ve dengeli istek aralığı (0 blok)
          const delay = 600 + Math.random() * 250;
          await new Promise((r) => setTimeout(r, delay));
        } catch (err: any) {
          console.warn(`\n  ⚠️ [${task.label}] Sf.${page} hatası: ${err?.message || err}`);
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
    }

  }

  await crawl(queue, "MARKA");

  // 3. MODEL TURU: Arabam her adres için en fazla 50 sayfa (1.000 ilan) gösterir; marka/kategori adresleriyle ~27 bin
  // ilanda tıkanılır. Her modelin kendi adresi ayrı 1.000'lik pencere verir (bilinen ailelerin kaynaktaki toplamı 180 bin+).
  // Adresler tur sırasında Arabam'ın verdiği model yollarından toplanır, önceki çalışmalardan ve bekçi liste
  // taramasından gelenlerle birleşir (logs/turbo-model-paths.json).
  if (!isShuttingDown && !CATEGORY_ONLY && totalInserted < targetCount) {
    try {
      const { ArabamListSweep } = await import("../src/models/ArabamListSweep");
      for (const doc of (await ArabamListSweep.find({ path: { $ne: null } }).select("path").lean()) as Array<{ path?: string | null }>) {
        if (doc.path) discoveredModelPaths.add(doc.path.replace(/^\/?(ikinci-el\/)?/, ""));
      }
    } catch {
      // bekçi yol listesi okunamazsa kendi topladıklarımızla devam
    }
    const modelQueue: TaskQueueItem[] = [...discoveredModelPaths]
      .filter((p) => MODEL_PATH.test(p))
      .sort()
      .map((p) => ({
        urlPattern: `https://www.arabam.com/ikinci-el/${p}?page=`,
        maxPages: 50,
        label: `[Model] ${p}`,
        category: p.split("/")[0],
      }));
    saveModelPaths();
    console.log(`\n\n  🧭 Marka turu bitti. Model turu: ${modelQueue.length} model adresi (her biri en fazla 50 sayfa).\n`);
    await crawl(modelQueue, "MODEL");
  }

  saveModelPaths();
  await syncLog(
    "success",
    `Turbo seri çekim başarıyla tamamlandı. Toplam +${totalInserted.toLocaleString("tr-TR")} yeni ilan eklendi, ~${totalUpdated.toLocaleString("tr-TR")} güncellendi.`
  );

  const finalActive = await Car.countDocuments({ status: "active" });
  const totalMinutes = Math.round(((Date.now() - startTime) / 60000) * 10) / 10;

  console.log("\n\n====================================================================");
  console.log(" 🎉 TURBO ÇEKİM TAMAMLANDI!");
  console.log("====================================================================");
  console.log(`  ⏱️ Geçen Süre: ${totalMinutes} Dakika`);
  console.log(`  📥 Toplam Taranan Araç: ${totalScanned.toLocaleString("tr-TR")}`);
  console.log(`  ✨ Yeni Eklenen İlan: +${totalInserted.toLocaleString("tr-TR")}`);
  console.log(`  🔄 Fiyatı Doğrulanan: ~${totalUpdated.toLocaleString("tr-TR")}`);
  console.log(`  🚗 Veritabanındaki Güncel Aktif İlan: ${finalActive.toLocaleString("tr-TR")}`);
  console.log("====================================================================\n");
}

main().catch((err) => {
  console.error("Turbo motor kritik hatası:", err);
  process.exit(1);
});

