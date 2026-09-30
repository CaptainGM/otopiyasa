// ============================================================================
// OtoPiyasa - Doğrudan Terminal Arabam Doğrulama & Senkronizasyon Motoru
// ============================================================================
// Web sunucusuna (localhost:3000) ve ayrı bir CMD penceresine İHTİYAÇ DUYMADAN
// doğrudan veritabanına bağlanır; tüm Arabam ilanlarının fiyatlarını günceller,
// satılan/ölü ilanları arşivler ve canlı ilerlemeyi tek ekranda gösterir.
// ============================================================================

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./load-env";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

// 1. Ortam Değişkenlerini Yükle (.env / .env.local, tırnaklar temizlenir)
loadEnv(projectRoot);

// Stealth ayarları
process.env.SCRAPE_MIN_INTERVAL_MS = process.env.SCRAPE_MIN_INTERVAL_MS || "1200";

const modeArg = process.argv[2] || "11";
const isSingleBatch = modeArg === "8" || modeArg === "800";
const batchSize = isSingleBatch ? 800 : 250;

mkdirSync(path.join(projectRoot, "logs"), { recursive: true });
const stateFile = path.join(projectRoot, "logs", `sync-state-mod${modeArg}.json`);

async function main() {
  console.log("====================================================================");
  console.log("     🚗 OTOPIYASA - ARABAM DOĞRULAMA & FİYAT EŞİTLEME MOTORU");
  console.log("====================================================================");
  console.log(`  🎯 Mod: ${isSingleBatch ? "En Bayat 800 İlan (Tek Seferlik)" : "Tüm İlanları Doğrula ve Senkronize Et (Parti Döngüsü)"}`);
  console.log(`  ⚡ Doğrudan Terminal Modu: Web sunucusu yok, harici popup cmd yok!`);
  console.log(`  🛡️ Ritim: 0 Blok Stealth + Güvenli Oturum`);
  console.log(`  📋 İşlem: Fiyat Eşitleme + Satılanları Arşivleme + Açıklama/Hasar Kontrolü\n`);

  const { connectDB } = await import("../src/lib/mongodb.js").catch(async () => await import("../src/lib/mongodb"));
  const { runPriceRefresh, arabamRefreshStatus } = await import("../src/lib/scraper/run-scrape.js").catch(async () => await import("../src/lib/scraper/run-scrape"));
  const { ManualScrapeLog } = await import("../src/models/ManualScrapeLog.js").catch(async () => await import("../src/models/ManualScrapeLog"));

  console.log("  ⏳ Veritabanına (MongoDB Atlas) bağlanılıyor...");
  await connectDB();
  console.log("  ✅ Veritabanı bağlantısı kuruldu.\n");

  // Tam doğrulamadan önce günde bir sitemap senkronu: arşivde olup hâlâ yayında
  // görünen ilanları ve sitemap'ten düşenleri kuyruğun başına alır.
  if (!isSingleBatch) {
    const { syncArabamSitemap, isSitemapSyncDue } = await import("../src/lib/scraper/arabam-sitemap");
    if (await isSitemapSyncDue()) {
      console.log("  🗺️ Arabam sitemap senkronu (öncelik sırası için, ~2-3 dk)...");
      await syncArabamSitemap({ log: (m) => console.log(`  ${m}`) });
      console.log("");
    }
  }

  const status = await arabamRefreshStatus();
  const totalListings = status.total || 0;
  console.log(`  📊 Kontrol Edilecek Toplam Aktif Arabam İlanı: ${totalListings.toLocaleString("tr-TR")}`);
  console.log(`  🔁 Arşivde olup yeniden kontrol bekleyen: ${status.needsRecheck.toLocaleString("tr-TR")}`);
  console.log(`  🆕 Hiç doğrulanmamış aktif ilan: ${status.neverVerified.toLocaleString("tr-TR")}`);

  if (totalListings === 0) {
    console.log("  ⚠️ Veritabanında aktif Arabam ilanı bulunamadı.");
    process.exit(0);
  }

  const maxBatches = isSingleBatch ? 1 : Math.ceil(totalListings / batchSize);
  let batchNum = 0;

  // Önceki durum varsa oku
  if (!isSingleBatch && existsSync(stateFile)) {
    try {
      const saved = JSON.parse(readFileSync(stateFile, "utf8"));
      if (saved && typeof saved.offset === "number" && saved.offset > 0) {
        batchNum = Math.floor(saved.offset / batchSize);
        console.log(`  🔄 Önceki oturum tespit edildi: ~${saved.offset} ilan taranmıştı. Kaldığı yerden (${batchNum + 1}. parti) devam ediliyor...`);
      }
    } catch {
      // yok say
    }
  }

  // Yönetici Paneli için canlı log kaydı aç
  let logDoc: any = null;
  try {
    logDoc = await ManualScrapeLog.create({
      actor: `Terminal (scrape.bat - Mod ${modeArg})`,
      source: "arabam",
      label: isSingleBatch ? "Arabam Fiyat Taraması (800 İlan)" : "Arabam Tüm İlanları Doğrulama ve Senkronizasyon",
      scanned: 0,
      inserted: 0,
      updated: 0,
      deleted: 0,
      durationSeconds: 0,
      status: "partial",
      message: `Doğrudan terminal üzerinden senkronizasyon başlatıldı (${totalListings.toLocaleString("tr-TR")} ilan).`,
      bySource: {
        arabam: { scanned: 0, updated: 0, deleted: 0 },
      },
      sampleVehicles: [],
    });
    console.log(`  📋 Yönetim Paneli Denetim Kaydı Açıldı (ID: ${logDoc._id})\n`);
  } catch (err: any) {
    console.warn(`  ⚠️ Denetim kaydı oluşturulamadı: ${err?.message || err}`);
  }

  let totalUpdated = 0;
  let totalDeleted = 0;
  let totalScanned = 0;
  const startTime = Date.now();

  const syncLogToDB = async (forcedStatus?: "success" | "partial") => {
    if (!logDoc?._id) return;
    try {
      const elapsedSec = Math.max(1, Math.round((Date.now() - startTime) / 1000));
      await ManualScrapeLog.updateOne(
        { _id: logDoc._id },
        {
          $set: {
            scanned: totalScanned,
            updated: totalUpdated,
            deleted: totalDeleted,
            durationSeconds: elapsedSec,
            status: forcedStatus || (batchNum >= maxBatches ? "success" : "partial"),
            message: `Terminal (scrape.bat): ${totalScanned.toLocaleString("tr-TR")} ilan denetlendi. ${totalUpdated.toLocaleString("tr-TR")} güncellendi, ${totalDeleted.toLocaleString("tr-TR")} satılmış/ölü ilan arşive kaldırıldı.`,
            bySource: {
              arabam: {
                scanned: totalScanned,
                updated: totalUpdated,
                deleted: totalDeleted,
              },
            },
          },
        }
      );
    } catch {
      // sessiz yut
    }
  };

  const handleExit = async (sig: string) => {
    console.log(`\n\n  🛑 [${sig}] İşlem kullanıcı tarafından durduruldu.`);
    if (!isSingleBatch) {
      const currentOffset = batchNum * batchSize;
      writeFileSync(stateFile, JSON.stringify({ offset: currentOffset, updatedAt: new Date().toISOString() }));
      console.log(`  💾 İlerleme (~${currentOffset.toLocaleString("tr-TR")}. ilan) kaydedildi. Tekrar açtığında buradan devam edecek.`);
    }
    await syncLogToDB("partial");
    console.log(`  ✅ Durum veritabanına işlendi. Terminal kapatılabilir.\n`);
    process.exit(0);
  };

  process.on("SIGINT", () => handleExit("Ctrl+C"));
  process.on("SIGTERM", () => handleExit("SIGTERM"));

  console.log("--------------------------------------------------------------------");
  console.log("  TARAMA BAŞLATILIYOR (İstediğin an Ctrl+C ile güvenle durdurabilirsin)");
  console.log("--------------------------------------------------------------------\n");

  let blockedBatches = 0;
  while (batchNum < maxBatches) {
    batchNum++;
    const currentOffset = (batchNum - 1) * batchSize;
    const pct = ((currentOffset / totalListings) * 100).toFixed(1);
    const remaining = Math.max(0, totalListings - currentOffset);

    console.log(`\n▶️ [Parti ${batchNum}/${maxBatches}] %${pct} (~${currentOffset.toLocaleString("tr-TR")}/${totalListings.toLocaleString("tr-TR")}, Kalan: ~${remaining.toLocaleString("tr-TR")})`);
    console.log(`   ⏳ ${batchSize} adet ilan kaynakla doğrulanıyor...`);

    let result: any = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        result = await runPriceRefresh(batchSize, currentOffset, totalListings);
        break;
      } catch (err: any) {
        console.warn(`   ⚠️ [Hata / Deneme ${attempt}/3] ${err?.message || err}`);
        if (attempt < 3) {
          console.log("   🔄 10 saniye beklenip tekrar deneniyor...");
          await new Promise((r) => setTimeout(r, 10000));
        }
      }
    }

    if (result) {
      const bUpd = result.updated || 0;
      const bDel = result.deleted || 0;
      const bScanned = result.sources?.[0]?.fetched || 0;

      totalUpdated += bUpd;
      totalDeleted += bDel;
      totalScanned += bScanned;

      console.log(`   ✅ Parti Tamamlandı: ✨ ${bUpd} İlan Güncellendi | 🔁 ${result.reactivated || 0} Arşivden Geri Alındı | 🗑️ ${bDel} Satılmış İlan Arşivlendi | Toplam Taranan: ${totalScanned}`);
      console.log(`   ℹ️ ${result.message}`);

      // Parti hiçbir ilanı okuyamadıysa büyük ihtimalle Cloudflare engeli var.
      if (bScanned === 0 && bDel === 0) {
        blockedBatches++;
        if (blockedBatches >= 2) {
          console.log("\n   ⛔ Art arda iki parti hiçbir ilan okuyamadı (Cloudflare/ağ engeli). İşlem durduruldu; ilanlara dokunulmadı.");
          await syncLogToDB("partial");
          process.exit(1);
        }
      } else {
        blockedBatches = 0;
      }

      if (!isSingleBatch) {
        writeFileSync(stateFile, JSON.stringify({ offset: batchNum * batchSize, updatedAt: new Date().toISOString() }));
      }
      await syncLogToDB("partial");
    } else {
      console.log(`   ❌ Bu parti zaman aşımına uğradı, sonraki partiye geçiliyor.`);
    }

    // Kısa bir nefes alma (1 saniye)
    if (batchNum < maxBatches) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  console.log("\n====================================================================");
  console.log("  🎉 TEBRİKLER! SENKRONİZASYON TAMAMLANDI");
  console.log(`  - Toplam Denetlenen: ${totalScanned.toLocaleString("tr-TR")}`);
  console.log(`  - Fiyatı / Bilgisi Güncellenen: ${totalUpdated.toLocaleString("tr-TR")}`);
  console.log(`  - Satıldığı Tespit Edilip Arşivlenen: ${totalDeleted.toLocaleString("tr-TR")}`);
  console.log("====================================================================\n");

  await syncLogToDB("success");
  if (existsSync(stateFile)) {
    try {
      const fs = await import("node:fs");
      fs.unlinkSync(stateFile);
    } catch {}
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("\n🚨 [KRİTİK HATA]:", err?.message || err);
  process.exit(1);
});
