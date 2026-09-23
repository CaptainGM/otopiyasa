import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";
import mongoose from "mongoose";
import { Car } from "../src/models/Car";
import { ManualScrapeLog } from "../src/models/ManualScrapeLog";
import { verifySingleListing } from "../src/lib/scraper/verify-listing";

// 1. Ortam Değişkenlerini Yükle
for (const envName of [".env", ".env.local"]) {
  const envPath = path.join(process.cwd(), envName);
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

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
};

async function promptMenu(): Promise<{ mode: string; limit: number; source: string }> {
  const arg = process.argv[2];
  if (arg) {
    if (arg === "50") return { mode: "batch", limit: 50, source: "all" };
    if (arg === "250") return { mode: "batch", limit: 250, source: "all" };
    if (arg === "loop" || arg === "continuous") return { mode: "loop", limit: 100, source: "all" };
    if (arg === "arabam") return { mode: "batch", limit: 100, source: "arabam" };
    if (arg === "kurumsal") return { mode: "batch", limit: 100, source: "kurumsal" };
  }

  console.log(`\n${colors.bright}${colors.cyan}====================================================================${colors.reset}`);
  console.log(`${colors.bright}          🧹 OTOPIYASA - KALICI ÖLÜ İLAN TEMİZLEME MERKEZİ${colors.reset}`);
  console.log(`${colors.cyan}====================================================================${colors.reset}`);
  console.log(`  ${colors.yellow}1${colors.reset} - Sıradaki 50 En Eski İlanı Süpür      ${colors.dim}(Hızlı Test, ~1 dk)${colors.reset}`);
  console.log(`  ${colors.yellow}2${colors.reset} - Sıradaki 250 En Eski İlanı Süpür     ${colors.dim}(Geniş Temizlik, ~4 dk)${colors.reset}`);
  console.log(`  ${colors.yellow}3${colors.reset} - SÜREKLİ SÜPÜR (Durdurana Kadar)      ${colors.dim}(Tüm veritabanını temizler)${colors.reset}`);
  console.log(`  ${colors.yellow}4${colors.reset} - Yalnızca Arabam İlanlarını Süpür     ${colors.dim}(100 Arabam ilanı)${colors.reset}`);
  console.log(`  ${colors.yellow}5${colors.reset} - Yalnızca Kurumsal Siteleri Süpür     ${colors.dim}(Otokoç, DOD, VavaCars...)${colors.reset}`);
  console.log(`${colors.cyan}====================================================================${colors.reset}`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`\nSeçiminiz (1-5, Varsayılan 1): `, (ans) => {
      rl.close();
      const clean = ans.trim();
      if (clean === "2") resolve({ mode: "batch", limit: 250, source: "all" });
      else if (clean === "3") resolve({ mode: "loop", limit: 100, source: "all" });
      else if (clean === "4") resolve({ mode: "batch", limit: 100, source: "arabam" });
      else if (clean === "5") resolve({ mode: "batch", limit: 100, source: "kurumsal" });
      else resolve({ mode: "batch", limit: 50, source: "all" });
    });
  });
}

async function sweepBatch(limit: number, sourceFilter: string, roundNum?: number) {
  const startTime = Date.now();
  const query: Record<string, any> = {
    status: { $ne: "removed" },
    listingUrl: { $nin: ["", null] },
  };

  if (sourceFilter === "arabam") {
    query.sourceSite = "arabam";
  } else if (sourceFilter === "kurumsal") {
    query.sourceSite = { $ne: "arabam" };
  }

  const candidates = await Car.find(query)
    .sort({ updatedAt: 1 })
    .limit(limit)
    .select("_id title sourceSite listingUrl externalId brand model year price imageUrl")
    .lean();

  if (candidates.length === 0) {
    console.log(`\n${colors.yellow}⚠️ Kontrol edilecek aktif ilan bulunamadı.${colors.reset}`);
    return { checked: 0, archived: 0, active: 0, errors: 0, archivedSamples: [], durationSeconds: 0 };
  }

  console.log(`\n${colors.bright}🚀 ${candidates.length} adet en eski ilan inceleniyor...${colors.reset}\n`);

  let archived = 0;
  let active = 0;
  let errors = 0;
  const archivedSamples: Array<{
    _id?: string;
    brand: string;
    model: string;
    year: number;
    price: number;
    source: string;
    title: string;
    imageUrl?: string;
    listingUrl?: string;
    reason?: string;
    round?: string;
  }> = [];

  for (let i = 0; i < candidates.length; i++) {
    const item: any = candidates[i];
    const num = `[${i + 1}/${candidates.length}]`;
    const site = (item.sourceSite || "bilinmiyor").padEnd(11);
    const shortTitle = (item.title || "").slice(0, 42).padEnd(42);

    try {
      const res = await verifySingleListing(item as any);

      if (res.status === "gone" || res.status === "redirected") {
        await Car.updateOne(
          { _id: item._id },
          {
            $set: {
              status: "removed",
              updatedAt: new Date(),
            },
          }
        );
        archived++;
        archivedSamples.push({
          _id: item._id.toString(),
          brand: item.brand || "Bilinmiyor",
          model: item.model || "Model",
          year: item.year || 0,
          price: item.price || 0,
          source: item.sourceSite || "arabam",
          title: item.title || "",
          imageUrl: item.imageUrl || "",
          listingUrl: item.listingUrl || "",
          reason: res.reason || "Yayından kaldırılmış",
          round: roundNum ? `Tur #${roundNum}` : "Tur #1",
        });
        console.log(
          `${colors.dim}${num}${colors.reset} ${colors.yellow}${site}${colors.reset} ${shortTitle} ➔ ${colors.red}🚫 ÖLÜ${colors.reset} ${colors.dim}(${res.reason})${colors.reset}`
        );
      } else if (res.status === "active") {
        await Car.updateOne(
          { _id: item._id },
          {
            $set: { updatedAt: new Date() },
          }
        );
        active++;
        console.log(
          `${colors.dim}${num}${colors.reset} ${colors.yellow}${site}${colors.reset} ${shortTitle} ➔ ${colors.green}🟢 CANLI${colors.reset}`
        );
      } else {
        // Erişim engeli (403/429) veya bilinmeyen durumda kuyruğun kilitlenmemesi için updatedAt ötelenir
        await Car.updateOne({ _id: item._id }, { $set: { updatedAt: new Date() } });
        errors++;
        console.log(
          `${colors.dim}${num}${colors.reset} ${colors.yellow}${site}${colors.reset} ${shortTitle} ➔ ${colors.yellow}⚠️ ${res.status.toUpperCase()}${colors.reset} ${colors.dim}(${res.reason})${colors.reset}`
        );
      }
    } catch (err: any) {
      await Car.updateOne({ _id: item._id }, { $set: { updatedAt: new Date() } });
      errors++;
      console.log(
        `${colors.dim}${num}${colors.reset} ${colors.yellow}${site}${colors.reset} ${shortTitle} ➔ ${colors.red}⚠️ HATA: ${err.message}${colors.reset}`
      );
    }

    // Kısa insansı aralık (250ms)
    await new Promise((r) => setTimeout(r, 250));
  }

  const durationSeconds = Math.max(1, Math.round((Date.now() - startTime) / 1000));
  return {
    checked: candidates.length,
    archived,
    active,
    errors,
    archivedSamples,
    durationSeconds,
  };
}

async function main() {
  const { mode, limit, source } = await promptMenu();

  console.log(`\n${colors.cyan}MongoDB bağlantısı kuruluyor...${colors.reset}`);
  await mongoose.connect(process.env.MONGODB_URI || "");
  console.log(`${colors.green}✓ Veritabanı bağlandı.${colors.reset}`);

  if (mode === "batch") {
    const stats = await sweepBatch(limit, source);
    try {
      await ManualScrapeLog.create({
        actor: "Yönetici",
        source: source === "all" ? "Eski İlanlar (Ölü Temizliği)" : source,
        label: "temizle-olu-ilan.bat",
        scanned: stats.checked,
        inserted: 0,
        updated: stats.active,
        deleted: stats.archived,
        durationSeconds: stats.durationSeconds,
        status: "success",
        message: `${stats.checked} eski ilan denetlendi: ${stats.archived} ölü ilan Piyasa Arşivi'ne kaldırıldı, ${stats.active} canlı ilan doğrulandı.`,
        bySource: {
          "Tur #1": {
            scanned: stats.checked,
            updated: stats.active,
            deleted: stats.archived,
            saved: stats.active,
            fetched: stats.archived,
          },
        },
        sampleVehicles: stats.archivedSamples,
      });
    } catch {
      // ignore
    }

    console.log(`\n${colors.cyan}====================================================================${colors.reset}`);
    console.log(`${colors.bright}📊 SÜPÜRME RAPORU:${colors.reset}`);
    console.log(`  - Taranan İlan Sayısı:     ${colors.bright}${stats.checked}${colors.reset}`);
    console.log(`  - 🚫 Arşive Kaldırılan Ölü: ${colors.red}${colors.bright}${stats.archived}${colors.reset}`);
    console.log(`  - 🟢 Doğrulanan Canlı İlan: ${colors.green}${colors.bright}${stats.active}${colors.reset}`);
    console.log(`  - ⚠️ Hatalar:               ${colors.yellow}${stats.errors}${colors.reset}`);
    console.log(`${colors.cyan}====================================================================${colors.reset}\n`);
  } else {
    console.log(`\n${colors.bright}${colors.yellow}🔄 SÜREKLİ SÜPÜRME MODU AKTİF!${colors.reset}`);
    console.log(`${colors.dim}Durdurmak için istediğiniz an CTRL + C tuşlarına basabilirsiniz.${colors.reset}\n`);

    let round = 0;
    let totalChecked = 0;
    let totalArchived = 0;
    let totalActive = 0;
    let sessionLogId: mongoose.Types.ObjectId | null = null;
    let sessionStartTime = Date.now();
    const bySourceRounds: Record<string, any> = {};
    const cumulativeSamples: any[] = [];

    // Her yeni çalıştırmada temiz ve bağımsız yeni bir oturum kaydı oluşturulur
    console.log(`${colors.green}✓ Yeni süpürme oturumu başlatıldı. Tur #1 ile en eski ilanlardan taranmaya başlanıyor...${colors.reset}\n`);

    while (true) {
      round++;
      console.log(`\n${colors.bright}---------------- [ TUR #${round} ] ----------------${colors.reset}`);
      const stats = await sweepBatch(limit, source, round);

      totalChecked += stats.checked;
      totalArchived += stats.archived;
      totalActive += stats.active;

      bySourceRounds[`Tur #${round}`] = {
        scanned: stats.checked,
        updated: stats.active,
        deleted: stats.archived,
        saved: stats.active,
        fetched: stats.archived,
        items: stats.archivedSamples,
      };

      for (const sample of stats.archivedSamples) {
        cumulativeSamples.push(sample);
      }

      const totalDuration = Math.max(1, Math.round((Date.now() - sessionStartTime) / 1000));
      const message = `${round} Tur Tamamlandı: ${totalChecked} eski ilan denetlendi. ${totalArchived} ölü ilan Piyasa Arşivi'ne kaldırıldı, ${totalActive} canlı ilan doğrulandı.`;

      // Tek bir oturum kaydını live güncelle (her tur için ayrı ayrı satır basma)
      try {
        if (!sessionLogId) {
          const doc = await ManualScrapeLog.create({
            actor: "Yönetici",
            source: source === "all" ? "Eski İlanlar (Ölü Temizliği)" : source,
            label: "temizle-olu-ilan.bat",
            scanned: totalChecked,
            inserted: 0,
            updated: totalActive,
            deleted: totalArchived,
            durationSeconds: totalDuration,
            status: "success",
            message,
            bySource: bySourceRounds,
            sampleVehicles: cumulativeSamples,
          });
          sessionLogId = doc._id;
        } else {
          await ManualScrapeLog.findByIdAndUpdate(sessionLogId, {
            $set: {
              scanned: totalChecked,
              updated: totalActive,
              deleted: totalArchived,
              durationSeconds: totalDuration,
              message,
              bySource: bySourceRounds,
              sampleVehicles: cumulativeSamples,
            },
          });
        }
      } catch {
        // ignore
      }

      console.log(
        `\n${colors.dim}Tur #${round} bitti. Genel Toplam: ${totalChecked} taranan, ${colors.red}${totalArchived} ölü arşive kaldırıldı${colors.reset}, ${colors.green}${totalActive} canlı doğrulandı.${colors.reset}`
      );

      if (stats.checked === 0) {
        console.log(`\n${colors.green}🎉 Tebrikler! Kontrol edilecek tüm eski ilanlar başarıyla temizlendi.${colors.reset}`);
        break;
      }

      console.log(`${colors.dim}Sonraki parti için 3 saniye bekleniyor...${colors.reset}`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Kritik Hata:", err);
  process.exit(1);
});
