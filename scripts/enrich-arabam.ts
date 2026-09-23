// ============================================================================
// OtoPiyasa - Arabam Tam Detay, Galeri & Hasar Zenginleştirme Motoru
// ============================================================================
// Arabam session cookie'si, stealth başlıklar ve akıllı kuyruk kullanarak
// tüm fotoğrafları, satıcının gerçek açıklamasını, boya/değişen matrisini
// ve motor özelliklerini çeker; silinmiş ilanları arşivler.
// ============================================================================

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

// 0 blok için stealth ayarları
process.env.SCRAPE_MIN_INTERVAL_MS = process.env.SCRAPE_MIN_INTERVAL_MS || "1200";
const batchLimit = parseInt(process.argv[2] || "35000", 10);
const CONCURRENCY = 2; // 0 blok stealth eşzamanlı kanal sayısı

async function main() {
  console.log("====================================================================");
  console.log("     OTOPIYASA - ARABAM TÜM DETAY, GALERİ & HASAR MOTORU");
  console.log("====================================================================");
  console.log(`  🎯 Hedef Kapsam: ${batchLimit.toLocaleString("tr-TR")} Araç (Tüm Veritabanı)`);
  console.log(`  🛡️ Mod: Cookie'li Doğrulanmış Oturum + Stealth Ritim (0 Blok)`);
  console.log(`  📸 İşlem: TÜM Fotoğraflar, Gerçek Açıklama, Boya/Değişen ve Motor Detayları\n`);

  const { connectDB } = await import("../src/lib/mongodb.js");
  const { Car } = await import("../src/models/Car.js");
  const { ManualScrapeLog } = await import("../src/models/ManualScrapeLog.js");
  await connectDB();

  const { fetchPageHtml, parseArabamDetailHtml, isListingGone } = await import(
    "../src/lib/scraper/browser-scrape.js"
  );

  // Yalnızca detayları tamamlanmamış (tek fotoğraflı) aktif arabam araçlarını getir
  const candidates = await Car.find(
    {
      sourceSite: "arabam",
      status: "active",
      listingUrl: { $exists: true },
      $or: [
        { images: { $size: 0 } },
        { images: { $size: 1 } },
        { images: { $exists: false } },
      ],
    },
    { _id: 1, title: 1, listingUrl: 1, brand: 1, model: 1, year: 1, price: 1, imageUrl: 1 }
  )
    .limit(batchLimit)
    .lean();

  console.log(`  🔍 Detayları Tamamlanacak Araç Sayısı: ${candidates.length.toLocaleString("tr-TR")}\n`);

  if (candidates.length === 0) {
    console.log("  ✅ Tüm araçların galerisi, açıklamaları ve hasar durumları zaten tam!");
    process.exit(0);
  }

  // Yönetim Paneli (Manuel Tarama) için canlı kayıt oluştur
  let logDoc: any = null;
  try {
    logDoc = await ManualScrapeLog.create({
      actor: "Terminal (scrape.bat - Galeri & Detay)",
      source: "arabam",
      label: "Arabam Galeri, Açıklama ve Hasar Zenginleştirmesi",
      scanned: 0,
      inserted: 0,
      updated: 0,
      deleted: 0,
      durationSeconds: 0,
      status: "partial",
      message: `Terminal (scrape.bat) üzerinden zenginleştirme başlatıldı (${candidates.length.toLocaleString("tr-TR")} aday araç).`,
      bySource: {
        arabam: { scanned: 0, updated: 0, deleted: 0 },
      },
      sampleVehicles: [],
    });
    console.log(`  📋 Yönetim Paneli Denetim Kaydı Açıldı (ID: ${logDoc._id})\n`);
  } catch (err: any) {
    console.warn(`  ⚠️ Denetim günlüğü oluşturulamadı: ${err?.message || err}`);
  }

  let enrichedCount = 0;
  let removedCount = 0;
  let errorCount = 0;
  let done = 0;
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

  // Canlı durumu MongoDB ManualScrapeLog'a senkronize et
  async function syncLog(forcedStatus?: "success" | "partial" | "error", customMessage?: string) {
    if (!logDoc?._id) return;
    try {
      const elapsedSec = Math.max(1, Math.round((Date.now() - startTime) / 1000));
      const status = forcedStatus || (done >= candidates.length ? "success" : "partial");
      const msg =
        customMessage ||
        `Terminal (scrape.bat): ${enrichedCount.toLocaleString("tr-TR")} araç tüm HD fotoğrafları, satıcı açıklaması ve hasar matrisiyle zenginleştirildi.${
          removedCount > 0 ? ` ${removedCount} satılmış ilan tespit edilip arşivlendi.` : ""
        }`;

      await ManualScrapeLog.updateOne(
        { _id: logDoc._id },
        {
          $set: {
            scanned: done,
            updated: enrichedCount,
            deleted: removedCount,
            durationSeconds: elapsedSec,
            status,
            message: msg,
            bySource: {
              arabam: {
                scanned: done,
                updated: enrichedCount,
                deleted: removedCount,
              },
            },
            sampleVehicles: sampleVehicles.slice(0, 30),
          },
        }
      );
    } catch {
      // sessiz yut
    }
  }

  // Kullanıcı mola verip Ctrl+C bastığında durumu panele güvenle kaydet
  let isShuttingDown = false;
  const handleGracefulExit = async (signalName: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`\n\n  🛑 [${signalName}] Mola verildi / Tarama durduruldu.`);
    console.log(`  💾 İlerleme (${enrichedCount.toLocaleString("tr-TR")} araç) Yönetim Paneli'ne kaydediliyor...`);
    await syncLog(
      "partial",
      `Kullanıcı mola verdi / durdurdu (${signalName}). Toplam ${enrichedCount.toLocaleString("tr-TR")} araç başarıyla zenginleştirildi.`
    );
    console.log(`  ✅ Kayıt başarıyla güncellendi! Yönetici panelinden (Manuel Tarama) detayları inceleyebilirsin.\n`);
    process.exit(0);
  };

  process.on("SIGINT", () => handleGracefulExit("Ctrl+C"));
  process.on("SIGTERM", () => handleGracefulExit("SIGTERM"));

  async function worker(car: any) {
    try {
      const detail = await fetchPageHtml(car.listingUrl);

      if (detail.status === 429) {
        const waitMs = 25000 + Math.random() * 8000;
        process.stdout.write(`\n  ⏳ [Cloudflare Hız Sınırı] ${Math.round(waitMs / 1000)}sn dinlenme molası (otomatik devam edecek)...`);
        await new Promise((r) => setTimeout(r, waitMs));
        return worker(car);
      }

      if (!detail.ok) {
        if (detail.status === 404 || detail.status === 410) {
          await Car.updateOne({ _id: car._id }, { $set: { status: "removed", removedAt: new Date() } });
          removedCount++;
        } else {
          errorCount++;
        }
        return;
      }

      if (isListingGone(detail.html, detail.finalUrl)) {
        await Car.updateOne({ _id: car._id }, { $set: { status: "removed", removedAt: new Date() } });
        removedCount++;
        return;
      }

      const listing = parseArabamDetailHtml(detail.html, car.listingUrl);
      if (!listing) {
        errorCount++;
        return;
      }

      // MongoDB'ye eksiksiz tüm detayları yaz
      await Car.updateOne(
        { _id: car._id },
        {
          $set: {
            ...(listing.images && listing.images.length > 0
              ? { images: listing.images, imageUrl: listing.imageUrl || listing.images[0] }
              : {}),
            ...(listing.description ? { description: listing.description } : {}),
            ...(listing.damageParts && Object.keys(listing.damageParts).length > 0
              ? { damageParts: listing.damageParts }
              : {}),
            ...(listing.damageFlag !== undefined ? { damageFlag: listing.damageFlag } : {}),
            ...(listing.paintChange ? { paintChange: listing.paintChange } : {}),
            ...(listing.sellerType ? { sellerType: listing.sellerType } : {}),
            ...(listing.listingDate ? { listingDate: listing.listingDate } : {}),
            ...(listing.features?.engineSize ? { "features.engineSize": listing.features.engineSize } : {}),
            ...(listing.features?.horsepower ? { "features.horsepower": listing.features.horsepower } : {}),
            ...(listing.features?.drivetrain ? { "features.drivetrain": listing.features.drivetrain } : {}),
            ...(listing.features?.avgFuelConsumption
              ? { "features.avgFuelConsumption": listing.features.avgFuelConsumption }
              : {}),
            lastVerifiedAt: new Date(),
          },
        }
      );
      enrichedCount++;

      // Örnek araç listesine ekle (Admin panelinde görsel kartlar için)
      if (sampleVehicles.length < 30) {
        sampleVehicles.push({
          _id: String(car._id),
          brand: car.brand || "Bilinmiyor",
          model: car.model || "Bilinmiyor",
          year: car.year || 0,
          price: car.price || 0,
          source: "arabam",
          title: car.title || `${car.brand} ${car.model}`,
          imageUrl: (listing.images && listing.images.length > 0) ? listing.images[0] : (car.imageUrl || ""),
          listingUrl: car.listingUrl,
        });
      }
    } catch {
      errorCount++;
    } finally {
      done++;
      const pct = Math.round((done / candidates.length) * 100);
      const elapsed = Math.max(1, (Date.now() - startTime) / 1000);
      const speed = Math.round((done / elapsed) * 10) / 10;
      process.stdout.write(
        `\r  [${done}/${candidates.length}] (%${pct}) | ✨ Tamamlanan: ${enrichedCount} | 🗑️ Kaldırılan: ${removedCount} | Hata: ${errorCount} | Hız: ${speed} araç/sn`
      );

      // Her 15 araçta veya 8 saniyede bir paneli güncelle
      if (done % 15 === 0 || Date.now() - lastSyncTime > 8000) {
        lastSyncTime = Date.now();
        syncLog().catch(() => {});
      }
    }
  }

  // Stealth kanallarla kontrollü paralel yürüt
  for (let i = 0; i < candidates.length; i += CONCURRENCY) {
    if (isShuttingDown) break;
    const slice = candidates.slice(i, i + CONCURRENCY);
    await Promise.all(slice.map((c) => worker(c)));
  }

  await syncLog(
    "success",
    `Zenginleştirme işlemi başarıyla tamamlandı. Toplam ${enrichedCount.toLocaleString("tr-TR")} araç tüm HD fotoğrafları, satıcı açıklaması ve hasar matrisiyle güncellendi.`
  );

  console.log("\n\n====================================================================");
  console.log(" 🎉 ZENGİNLEŞTİRME İŞLEMİ TAMAMLANDI!");
  console.log("====================================================================");
  console.log(`  📸 Tamamlanan (Tüm Fotoğraflar, Açıklama, Hasar): ${enrichedCount.toLocaleString("tr-TR")}`);
  console.log(`  🗑️ Satılmış/Kaldırılmış Olarak İşaretlenen: ${removedCount.toLocaleString("tr-TR")}`);
  console.log(`  ⏱️ Geçen Süre: ${Math.round(((Date.now() - startTime) / 60000) * 10) / 10} Dakika`);
  console.log(`  📋 Yönetim Paneli Kaydı Güncellendi!`);
  console.log("====================================================================\n");
  process.exit(0);
}

main().catch(console.error);

