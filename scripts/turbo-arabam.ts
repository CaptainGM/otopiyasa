// ============================================================================
// OtoPiyasa - Ultra Hızlı Turbo Arabam Scraper (Toplu Sayfa İçe Aktarma)
// ============================================================================
// Arama tablolarındaki 20 aracı tek bir HTTP isteğinde doğrudan ayrıştırır.
// Her araç için ayrı ayrı detay sayfası indirme beklemesini kaldırır.
// Hız: ~25 araç / saniye (~1.500 araç / dakika)
// ============================================================================

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";

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

const targetCount = parseInt(process.argv[2] || "30000", 10);

const CATEGORIES = [
  { slug: "otomobil", label: "Otomobil (Sedan, HB, vb.)" },
  { slug: "arazi-suv-pick-up", label: "Arazi, SUV & Pick-up" },
  { slug: "minivan-panelvan", label: "Minivan & Panelvan" },
];

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
}

function parseArabamSearchPage(html: string, defaultCategory = "otomobil"): ParsedCar[] {
  const $ = cheerio.load(html);
  const rows = $("tr.listing-list-item");
  const listings: ParsedCar[] = [];

  rows.each((_, el) => {
    const $row = $(el);
    const href = $row.find('a[href*="/ilan/"]').attr("href") || "";
    const extId = href.match(/(\d+)\/?$/)?.[1];
    if (!extId) return;

    let img =
      $row.find("img.listing-image").attr("data-src") ||
      $row.find("img.listing-image").attr("src") ||
      $row.find("img").attr("data-src") ||
      $row.find("img").attr("data-original") ||
      $row.find("img").attr("src") ||
      "";
    if (!img || img.includes("noimage")) {
      const noscriptHtml = $row.find("noscript").html() || "";
      const noscriptMatch = noscriptHtml.match(/src="([^"]+)"/);
      if (noscriptMatch) img = noscriptMatch[1];
    }
    const hdImg = img ? img.replace("_240x180", "_800x600").replace("_160x120", "_800x600") : "";
    const modelFull = $row.find(".listing-modelname").text().replace(/\s+/g, " ").trim();
    const title = $row.find("td.horizontal-half-padder-minus").text().replace(/\s+/g, " ").trim() || modelFull;

    const textCells: string[] = [];
    $row.find("td").each((_, td) => {
      textCells.push($(td).text().replace(/\s+/g, " ").trim());
    });

    const year = parseInt(textCells[3]?.replace(/\D/g, "") || "0", 10);
    const km = parseInt(textCells[4]?.replace(/\D/g, "") || "0", 10);
    const color = textCells[5] || "Belirtilmemiş";
    
    // Güvenli Fiyat Ayrıştırma (Eski + Yeni fiyat bitişik yazılmışsa sonuncusunu al)
    const rawPriceCell = textCells[6] || "";
    const priceCandidates = rawPriceCell.match(/\b\d{1,3}(?:\.\d{3})+\b/g) || rawPriceCell.match(/\d+/g);
    let price = 0;
    if (priceCandidates && priceCandidates.length > 0) {
      const lastStr = priceCandidates[priceCandidates.length - 1].replace(/\D/g, "");
      price = parseInt(lastStr, 10);
    }
    if (price > 150_000_000) {
      const rawDigits = rawPriceCell.replace(/\D/g, "");
      if (rawDigits.length >= 12) {
        price = parseInt(rawDigits.slice(Math.floor(rawDigits.length / 2)), 10);
      }
    }

    const locRaw = textCells[8]?.split("Karşılaştır")[0]?.trim() || "";
    const locParts = locRaw.split(/\s+/);
    const city = locParts[0] || "Türkiye";
    const district = locParts.slice(1).join(" ") || "";

    const firstWord = modelFull.split(" ")[0] || "Bilinmiyor";
    const rest = modelFull.split(" ").slice(1).join(" ") || modelFull;

    const checkText = (modelFull + " " + title).toLowerCase();
    let fuelType = "Benzin";
    if (/elektrik|electric|\bev\b|taycan|eqs|eqe|eqc|ioniq 5|t10x/.test(checkText)) fuelType = "Elektrik";
    else if (/hibrit|hybrid|phev|mhev|e-power/.test(checkText)) fuelType = "Hibrit";
    else if (/dizel|diesel|multijet|tdci|dci|tdi|hdi|crdi|cdti|d-4d|bluehdi/.test(checkText)) fuelType = "Dizel";
    else if (/lpg|otogaz|eco/.test(checkText)) fuelType = "Benzin & LPG";

    let transmission = "Manuel";
    if (/otomatik|auto|edc|dsg|eat[68]|dct|powershift|cvt|s-tronic|tiptronic|steptronic|xtronic|7g-tronic|9g-tronic/.test(checkText)) {
      transmission = "Otomatik";
    } else if (/yarı otomatik|dualtronic|easytronic|mmt/.test(checkText)) {
      transmission = "Yarı Otomatik";
    }

    let bodyType = "Sedan";
    if (defaultCategory === "arazi-suv-pick-up" || /suv|cross|stepway|qashqai|duster|tucson|sportage|tiguan|3008|2008|c-hr|kuga|kadjar|captur|mokka|x[135]|gl[ace]/.test(checkText)) {
      bodyType = "SUV";
    } else if (defaultCategory === "minivan-panelvan" || /doblo|courier|fiorino|caddy|kangoo|partner|berlingo|transporter|vito|custom|combo/.test(checkText)) {
      bodyType = "Minivan / Van";
    } else if (/clio|i20|polo|corsa|fiesta|golf|yaris|c3|208|fabia|ibiza|leon|a3|116i|118i|hatchback|\bhb\b/.test(checkText)) {
      bodyType = "Hatchback";
    } else if (/coupe|cabrio|roadster/.test(checkText)) {
      bodyType = "Coupe";
    } else if (/station wagon|\bsw\b|variant|touring|avant/.test(checkText)) {
      bodyType = "Station Wagon";
    }

    listings.push({
      externalId: `arabam-${extId}`,
      sourceSite: "arabam",
      listingUrl: `https://www.arabam.com${href}`,
      title,
      brand: firstWord,
      model: rest,
      year,
      price,
      mileage: km,
      city,
      address: district ? `${city}, ${district}` : city,
      description: title,
      imageUrl: hdImg,
      images: [hdImg].filter(Boolean),
      features: {
        fuelType,
        transmission,
        bodyType,
        color,
      },
    });
  });

  return listings;
}

/**
 * Yeni ilanlar için tüm galeri fotoğraflarını (10-25 HD fotoğraf),
 * satıcının gerçek detaylı açıklamasını ve hasar matrisini çeker.
 */
async function enrichCarDetails(listingUrl: string): Promise<{
  images: string[];
  description?: string;
  damageParts?: Record<string, string>;
}> {
  try {
    const res = await fetch(listingUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
        "Cache-Control": "no-cache",
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) return { images: [] };
    const html = await res.text();
    const $ = cheerio.load(html);

    const allImages: string[] = [];
    $("img").each((_, el) => {
      const src = $(el).attr("src") || $(el).attr("data-src") || "";
      if (src.includes("ilanfotograflari")) allImages.push(src);
    });
    $("a[href*='ilanfotograflari']").each((_, el) => {
      const href = $(el).attr("href") || "";
      if (href) allImages.push(href);
    });
    $("script").each((_, el) => {
      const txt = $(el).text();
      const matches = txt.match(/https?:\/\/[^"'\s]+ilanfotograflari[^"'\s]+/g);
      if (matches) allImages.push(...matches);
    });

    const uniqueImages = Array.from(
      new Set(
        allImages
          .map((u) => u.replace(/_\d+x\d+\./, "_800x600.").split("?")[0])
          .filter((u) => u.startsWith("http"))
      )
    );

    let description = $("#tab-description")
      .text()
      .replace(/^Açıklama\s*/i, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!description || description.length < 10) {
      $('script[type="application/ld+json"]').each((_, el) => {
        if (description) return;
        try {
          const parsed = JSON.parse($(el).text());
          const list = Array.isArray(parsed) ? parsed : [parsed];
          for (const item of list) {
            if (item["@type"] === "Vehicle" || item["@type"] === "Car") {
              if (item.description && typeof item.description === "string") {
                description = item.description.trim();
                break;
              }
            }
          }
        } catch {}
      });
    }

    const damageParts: Record<string, string> = {};
    $("path[uib-tooltip], [data-part-name]").each((_, el) => {
      const partName = $(el).find("title").text().trim() || $(el).attr("data-part-name") || "";
      const status = $(el).attr("uib-tooltip") || $(el).attr("data-status") || "";
      if (partName && status) damageParts[partName] = status;
    });

    return {
      images: uniqueImages,
      description: description || undefined,
      damageParts: Object.keys(damageParts).length > 0 ? damageParts : undefined,
    };
  } catch {
    return { images: [] };
  }
}

async function fetchPageWithRetry(url: string, maxRetries = 6): Promise<string> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
          "Cache-Control": "no-cache",
        },
      });

      if (res.status === 429) {
        const wait = 12000 + Math.random() * 6000;
        console.log(`\n  ⏳ [429 Hız Sınırı] ${Math.round(wait / 1000)}sn mola veriliyor...`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      return await res.text();
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
  console.log(`  ⚡ Yöntem: Toplu Arama Tablosu Ayrıştırma (Sayfa Başına 20 Araç)`);
  console.log(`  📁 Kapsam: 3 Ana Kategori (Otomobil, SUV, Ticari) + 40 Farklı Marka\n`);

  const { connectDB } = await import("../src/lib/mongodb.js").catch(async () => await import("../src/lib/mongodb"));
  await connectDB();
  const { Car } = await import("../src/models/Car.js").catch(async () => await import("../src/models/Car"));
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

  interface TaskQueueItem {
    urlPattern: string;
    maxPages: number;
    label: string;
    category: string;
  }

  const queue: TaskQueueItem[] = [];

  // 1. Kategori bazlı en yeniler ve model yılları
  for (const cat of CATEGORIES) {
    queue.push({
      urlPattern: `https://www.arabam.com/ikinci-el/${cat.slug}?sort=date_desc&page=`,
      maxPages: 50,
      label: `[Genel En Yeniler] ${cat.label}`,
      category: cat.slug,
    });
    queue.push({
      urlPattern: `https://www.arabam.com/ikinci-el/${cat.slug}?sort=year_desc&page=`,
      maxPages: 30,
      label: `[Taze Model Yılı] ${cat.label}`,
      category: cat.slug,
    });
  }

  // 2. Marka bazlı taramalar (Geniş Türkiye Filosu)
  for (const brand of ALL_BRANDS) {
    queue.push({
      urlPattern: `https://www.arabam.com/ikinci-el/otomobil/${brand}?sort=date_desc&page=`,
      maxPages: 25,
      label: `[Marka] ${brand.toUpperCase()} Otomobil`,
      category: "otomobil",
    });
    queue.push({
      urlPattern: `https://www.arabam.com/ikinci-el/arazi-suv-pick-up/${brand}?sort=date_desc&page=`,
      maxPages: 20,
      label: `[SUV Marka] ${brand.toUpperCase()} SUV`,
      category: "arazi-suv-pick-up",
    });
  }

  // 3. Fiyat segmentleri (Uygun fiyatlı & Lüks vitrin çeşitliliği)
  queue.push({
    urlPattern: `https://www.arabam.com/ikinci-el/otomobil?sort=price_asc&page=`,
    maxPages: 30,
    label: `[Ekonomik Araçlar] Fiyata Göre Artan`,
    category: "otomobil",
  });
  queue.push({
    urlPattern: `https://www.arabam.com/ikinci-el/otomobil?sort=price_desc&page=`,
    maxPages: 30,
    label: `[Lüks & Üst Segment] Fiyata Göre Azalan`,
    category: "otomobil",
  });

  console.log(`  📋 Toplam ${queue.length} Arama Rotası Hazırlandı.\n`);

  for (let qIdx = 0; qIdx < queue.length; qIdx++) {
    if (isShuttingDown || totalInserted >= targetCount) break;

    const task = queue[qIdx];
    console.log(`\n➡️  (${qIdx + 1}/${queue.length}) ${task.label} başlatılıyor...`);
    let consecutiveZeros = 0;

    for (let page = 1; page <= task.maxPages; page++) {
      if (isShuttingDown || totalInserted >= targetCount) break;

      const pageUrl = `${task.urlPattern}${page}`;
      try {
        const html = await fetchPageWithRetry(pageUrl);
        if (!html) break;

        const cars = parseArabamSearchPage(html, task.category);
        if (cars.length === 0) {
          consecutiveZeros++;
          if (consecutiveZeros >= 2) break;
          continue;
        }

        totalScanned += cars.length;

        // Hangi araçların yeni olduğunu tespit et
        const extIds = cars.map((c) => c.externalId);
        const existingDocs = await Car.find({ externalId: { $in: extIds } }, { externalId: 1 }).lean();
        const existingSet = new Set((existingDocs as any[]).map((d) => d.externalId));
        const newCars = cars.filter((c) => !existingSet.has(c.externalId));

        // Yeni araçları 4'lü paralel havuzla tüm galerisi ve satıcı açıklamasıyla zenginleştir
        if (newCars.length > 0) {
          for (let i = 0; i < newCars.length; i += 4) {
            const batch = newCars.slice(i, i + 4);
            await Promise.all(
              batch.map(async (car) => {
                const enriched = await enrichCarDetails(car.listingUrl);
                if (enriched.images.length > 0) {
                  car.images = enriched.images;
                  car.imageUrl = enriched.images[0];
                }
                if (enriched.description) {
                  car.description = enriched.description;
                }
                if (enriched.damageParts) {
                  (car as any).damageParts = enriched.damageParts;
                }
              })
            );
          }
        }

        // MongoDB Toplu İşlem (BulkWrite)
        const ops = cars.map((car) => ({
          updateOne: {
            filter: { externalId: car.externalId },
            update: {
              $setOnInsert: {
                title: car.title,
                brand: car.brand,
                model: car.model,
                year: car.year,
                mileage: car.mileage,
                city: car.city,
                address: car.address,
                description: car.description,
                imageUrl: car.imageUrl,
                images: car.images,
                damageParts: (car as any).damageParts,
                features: car.features,
                source: "arabam",
                sourceSite: "arabam",
                listingUrl: car.listingUrl,
                externalId: car.externalId,
                createdAt: new Date(),
              },
              $set: {
                price: car.price,
                status: "active",
                lastVerifiedAt: new Date(),
                ...(car.images.length > 1 ? { images: car.images, imageUrl: car.images[0] } : {}),
                ...(car.description && car.description !== car.title ? { description: car.description } : {}),
                ...((car as any).damageParts ? { damageParts: (car as any).damageParts } : {}),
              },
              $push: {
                priceHistory: {
                  $each: [{ price: car.price, recordedAt: new Date() }],
                  $slice: -20,
                },
              },
            },
            upsert: true,
          },
        }));

        const bulkRes = await Car.bulkWrite(ops as any, { ordered: false });
        const newInThisPage = bulkRes.upsertedCount || 0;
        const updatedInThisPage = bulkRes.modifiedCount || 0;

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
          `\r  [Sf.${page}] +${newInThisPage} Yeni, ~${updatedInThisPage} Güncel | Toplam Yeni: +${totalInserted.toLocaleString("tr-TR")} / ${targetCount.toLocaleString("tr-TR")} (%${progressPct}) | Hız: ${speed} araç/sn`
        );

        if (page % 2 === 0 || Date.now() - lastSyncTime > 8000) {
          lastSyncTime = Date.now();
          syncLog().catch(() => {});
        }

        if (newInThisPage === 0) {
          consecutiveZeros++;
          if (consecutiveZeros >= 4) {
            console.log(`\n  ℹ️ Bu rotadaki mevcut ilanların sınırına gelindi, sıradakine geçiliyor.`);
            break;
          }
        } else {
          consecutiveZeros = 0;
        }

        const delay = 850 + Math.random() * 250;
        await new Promise((r) => setTimeout(r, delay));
      } catch (err: any) {
        console.warn(`\n  ⚠️ Sf.${page} hatası: ${err?.message || err}`);
        await new Promise((r) => setTimeout(r, 2500));
      }
    }
  }

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

