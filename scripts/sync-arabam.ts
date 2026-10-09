// ============================================================================
// OtoPiyasa - Doğrudan Terminal Arabam Doğrulama & Senkronizasyon Motoru
// ============================================================================
// Web sunucusuna (localhost:3000) ve ayrı bir CMD penceresine İHTİYAÇ DUYMADAN
// doğrudan veritabanına bağlanır; tüm Arabam ilanlarının fiyatlarını günceller,
// satılan/ölü ilanları arşivler ve canlı ilerlemeyi tek ekranda gösterir.
//
// ZAMANLI ÇALIŞMA (mod 11): tur başına N ilan doğrulanır, sonra M dakika mola verilir (--tur-ilan, --mola, --tur).
// Kaynak engel verirse (429 / Cloudflare) parti erken bırakılır, 10-20-40-60 dakika kendiliğinden dinlenilir ve devam edilir;
// elle kapatıp açmaya gerek kalmaz. Uzun süre düzelmezse (6 ardışık mola) işlem durur.
// ============================================================================

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./load-env";
import { pauseWatcher } from "./bekci-pause.mjs";
pauseWatcher("Arabam doğrulama");

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

const flagNumber = (name: string): number => {
  const i = process.argv.indexOf(name);
  return i > 0 ? Number(process.argv[i + 1]) : NaN;
};
/** Tur başına doğrulanacak ilan (varsayılan 1200), turlar arası mola dakikası (varsayılan 20), tur sayısı (0 = bitene kadar). */
const roundSize = flagNumber("--tur-ilan") > 0 ? flagNumber("--tur-ilan") : 1200;
const breakMinutes = Number.isFinite(flagNumber("--mola")) && flagNumber("--mola") >= 0 ? flagNumber("--mola") : 20;
const maxRounds = flagNumber("--tur") > 0 ? flagNumber("--tur") : 0;
mkdirSync(path.join(projectRoot, "logs"), { recursive: true });
const stateFile = path.join(projectRoot, "logs", `sync-state-mod${modeArg}.json`);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Dakika dakika bekler; her 5 dakikada bir kalan süreyi yazar. Ctrl+C her an çalışır. */
async function rest(minutes: number, title: string) {
  const until = new Date(Date.now() + minutes * 60_000).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  console.log(`\n   ☕ ${title}: ${minutes} dk (saat ${until}'e kadar). Pencereyi kapatma, kendiliğinden devam eder; durdurmak için Ctrl+C.`);
  for (let left = minutes; left > 0; left--) {
    await sleep(60_000);
    if (left > 1 && (left - 1) % 5 === 0) console.log(`   ⏳ ${left - 1} dk kaldı...`);
  }
}

async function main() {
  console.log("====================================================================");
  console.log("     🚗 OTOPIYASA - ARABAM DOĞRULAMA & FİYAT EŞİTLEME MOTORU");
  console.log("====================================================================");
  console.log(`  🎯 Mod: ${isSingleBatch ? "En Bayat 800 İlan (Tek Seferlik)" : "Tüm İlanları Doğrula ve Senkronize Et (Parti Döngüsü)"}`);
  console.log(`  ⚡ Doğrudan Terminal Modu: Web sunucusu yok, harici popup cmd yok!`);
  console.log(`  🛡️ Ritim: 0 Blok Stealth + Güvenli Oturum`);
  console.log(`  📋 İşlem: Fiyat Eşitleme + Satılanları Arşivleme + Açıklama/Hasar Kontrolü`);
  if (!isSingleBatch) {
    console.log(
      `  ⏱️ Zamanlı: tur başına ${roundSize.toLocaleString("tr-TR")} ilan, turlar arası ${breakMinutes} dk mola${maxRounds ? `, en çok ${maxRounds} tur` : ""}; engel gelirse kendiliğinden dinlenir.`
    );
  }
  console.log("");

  const { connectDB } = await import("../src/lib/mongodb.js").catch(async () => await import("../src/lib/mongodb"));
  const { runPriceRefresh, arabamRefreshStatus } = await import("../src/lib/scraper/run-scrape.js").catch(async () => await import("../src/lib/scraper/run-scrape"));
  const { ManualScrapeLog } = await import("../src/models/ManualScrapeLog.js").catch(async () => await import("../src/models/ManualScrapeLog"));
  const { judgeBatch, MAX_BLOCK_STREAK } = await import("../src/lib/scraper/verify-rhythm");

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

  let blockStreak = 0;
  let roundChecked = 0;
  let roundsDone = 0;
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
          await sleep(10000);
        }
      }
    }

    if (!result) {
      console.log(`   ❌ Bu parti zaman aşımına uğradı, sonraki partiye geçiliyor.`);
    } else {
      const bUpd = result.updated || 0;
      const bDel = result.deleted || 0;
      const bScanned = result.sources?.[0]?.fetched || 0;
      const checked: number = result.checked ?? bScanned + bDel;
      const blocked: number = result.blocked ?? 0;

      totalUpdated += bUpd;
      totalDeleted += bDel;
      totalScanned += bScanned;

      console.log(`   ✅ Parti Tamamlandı: ✨ ${bUpd} İlan Güncellendi | 🔁 ${result.reactivated || 0} Arşivden Geri Alındı | 🗑️ ${bDel} Satılmış İlan Arşivlendi | Toplam Taranan: ${totalScanned}`);
      console.log(`   ℹ️ ${result.message}`);

      // Kuyruk boşsa kalan ilanların hepsi son 6 saatte denenmiş (ör. engellenenler); partinin büyük kısmı engel yüzünden okunamadıysa
      // (ya da art arda engelle yarıda kaldıysa) kendiliğinden dinlenilir. Engellenen ilanlar "blocked" damgası alıp 6 saat sonra yeniden
      // denenir, yarıda kalan partinin kalanına dokunulmamıştır.
      const verdict = judgeBatch({ checked: result.checked, blocked: result.blocked, aborted: result.aborted }, blockStreak);
      blockStreak = verdict.streak;
      if (verdict.kind === "empty") {
        console.log("\n   ℹ️ Sırada kontrol edilecek ilan kalmadı (kalanların hepsi son 6 saatte denendi). Birkaç saat sonra tekrar açabilirsin.");
        batchNum = maxBatches;
        break;
      }
      if (verdict.kind === "give-up") {
        console.log(`\n   ⛔ Arabam ${MAX_BLOCK_STREAK} molaya rağmen engelli kaldı. İşlem durduruldu; ilanlara dokunulmadı. Birkaç saat sonra tekrar aç, kaldığı yerden devam eder.`);
        await syncLogToDB("partial");
        process.exit(1);
      }
      if (verdict.kind === "blocked") {
        console.log(`\n   ⛔ Arabam engel verdi (${blocked}/${checked} ilan okunamadı). Bu parti sayılmadı; dinlenip devam edilecek (${verdict.streak}/${MAX_BLOCK_STREAK}).`);
        batchNum--; // aynı parti numarasıyla devam: engelli ilanlar kuyrukta 6 saat geride kalır, sıradakiler alınır
        await syncLogToDB("partial");
        await rest(verdict.waitMinutes, "Engel molası");
        continue;
      }
      roundChecked += Math.max(0, checked - blocked);

      if (!isSingleBatch) {
        writeFileSync(stateFile, JSON.stringify({ offset: batchNum * batchSize, updatedAt: new Date().toISOString() }));
      }
      await syncLogToDB("partial");
    }

    // Tur doldu: mola ver (Cloudflare uzun, kesintisiz taramada takılıyor); bitmediyse sonraki turla devam.
    if (!isSingleBatch && batchNum < maxBatches && roundChecked >= roundSize) {
      roundsDone++;
      console.log(`\n   🔁 Tur ${roundsDone} bitti: ${roundChecked.toLocaleString("tr-TR")} ilan doğrulandı (toplam ${totalScanned.toLocaleString("tr-TR")}).`);
      roundChecked = 0;
      if (maxRounds && roundsDone >= maxRounds) {
        console.log(`  ✅ İstenen ${maxRounds} tur tamamlandı; kalan ilanlar için scrape.bat 11'i yeniden aç (kaldığı yerden devam eder).`);
        break;
      }
      if (breakMinutes > 0) await rest(breakMinutes, "Tur molası");
    } else if (batchNum < maxBatches) {
      // Kısa bir nefes alma (1 saniye)
      await sleep(1000);
    }
  }

  console.log("\n====================================================================");
  console.log(batchNum >= maxBatches ? "  🎉 TEBRİKLER! SENKRONİZASYON TAMAMLANDI" : "  ⏹️ TUR SAYISI TAMAMLANDI");
  console.log(`  - Toplam Denetlenen: ${totalScanned.toLocaleString("tr-TR")}`);
  console.log(`  - Fiyatı / Bilgisi Güncellenen: ${totalUpdated.toLocaleString("tr-TR")}`);
  console.log(`  - Satıldığı Tespit Edilip Arşivlenen: ${totalDeleted.toLocaleString("tr-TR")}`);
  console.log("====================================================================\n");

  await syncLogToDB(batchNum >= maxBatches ? "success" : "partial");
  if (batchNum >= maxBatches && existsSync(stateFile)) {
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
