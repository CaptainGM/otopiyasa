// ============================================================================
// OtoPiyasa - 7/24 Kesintisiz Otonom Tarama & Eşitleme Servisi (Daemon)
// ============================================================================
// Bu servis bir Linux VPS (Oracle Cloud Always Free vb.) veya yerel bilgisayarda
// PM2 ile 7/24 çalışmak üzere tasarlanmıştır.
//
// 4 AŞAMALI SONSUZ DÖNGÜ:
//   1. Faz: Kurumsal envanter güncelleme (Otomerkezi & VavaCars, ~2-3 dk)
//   2. Faz: Arabam yeni ilan keşfi (En son eklenen ilanlar, akıllı atlama)
//   3. Faz: Arabam eski ilan doğrulama & temizleme (Ölüleri kaldır, fiyat düşüşlerini yakala)
//   4. Faz: 5 dakika dinlenme ve tekrar 1. Faza dönüş
// ============================================================================

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { Agent, setGlobalDispatcher } from "undici";

setGlobalDispatcher(new Agent({ headersTimeout: 0, bodyTimeout: 0 }));

const projectRoot = path.resolve(import.meta.dirname, "..");

function getEnv(key) {
  if (process.env[key]) return process.env[key];
  const envPath = path.join(projectRoot, ".env");
  if (!existsSync(envPath)) return "";
  const match = readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith(key + "="));
  return match ? match.slice(key.length + 1).trim() : "";
}

const secret = getEnv("SCRAPE_RUN_SECRET");
const appUrl = process.env.SCRAPE_TARGET_URL || "http://localhost:3000";

if (!secret) {
  console.error("[DAEMON HATA] .env dosyasında SCRAPE_RUN_SECRET tanımlı değil.");
  process.exit(1);
}

function log(msg) {
  const time = new Date().toLocaleString("tr-TR");
  console.log(`[${time}] ${msg}`);
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function checkServer() {
  while (true) {
    try {
      const res = await fetch(appUrl, { signal: AbortSignal.timeout(5000) });
      if (res.ok) return true;
    } catch {}
    log(`⏳ OtoPiyasa sunucusu henüz hazır değil (${appUrl}). 10 saniye sonra tekrar kontrol edilecek...`);
    await sleep(10000);
  }
}

async function runJob(jobPayload, jobName) {
  log(`🚀 ${jobName} başlatılıyor...`);
  try {
    const res = await fetch(`${appUrl}/api/scrape/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-scrape-secret": secret,
      },
      body: JSON.stringify(jobPayload),
      signal: AbortSignal.timeout(60 * 60 * 1000), // 1 saat üst sınır
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      log(`✅ ${jobName} bitti: Yeni eklenen: ${data.inserted ?? 0}, Güncellenen: ${data.updated ?? 0}, Kaldırılan: ${data.deleted ?? 0}`);
      return true;
    } else {
      log(`⚠️ ${jobName} HTTP ${res.status} döndü: ${data.error ?? "Bilinmeyen hata"}`);
      return false;
    }
  } catch (err) {
    log(`❌ ${jobName} ağ hatası: ${err.message}`);
    return false;
  }
}

async function startDaemon() {
  console.log("===============================================================");
  console.log("  🚗 OtoPiyasa 7/24 Kesintisiz Otonom Tarayıcı (Daemon) Devrede");
  console.log("===============================================================");
  console.log(`Hedef API: ${appUrl}`);
  console.log("Mod: Stealth (İnsansı aralık, 0 blok, sonsuz döngü)\n");

  await checkServer();
  log("Bağlantı doğrulandı, otonom döngü başlıyor.\n");

  let cycleCount = 0;

  while (true) {
    cycleCount++;
    console.log(`\n================== [ TUR #${cycleCount} BAŞLIYOR ] ==================`);

    // FAZ 1: Kurumsal Envanter Eşitleme
    log("📌 [FAZ 1/3] Kurumsal envanter taranıyor (Otomerkezi & VavaCars)...");
    await runJob({ source: "otomerkezi", limit: 300 }, "Otomerkezi Envanteri");
    await sleep(5000);
    await runJob({ source: "vavacars", limit: 500 }, "VavaCars Envanteri");
    await sleep(8000);

    // FAZ 2: Arabam Yeni İlan Keşfi
    log("📌 [FAZ 2/3] Arabam yeni ilanlar taranıyor (Akıllı atlama)...");
    await runJob({ source: "arabam", query: "otomobil", limit: 800 }, "Arabam Yeni İlan Keşfi");
    await sleep(10000);

    // FAZ 3: Arabam Eski İlan Doğrulama & Temizleme
    log("📌 [FAZ 3/3] En eski 250 ilan doğrulanıyor (Fiyat güncelleme & ölü ilan temizliği)...");
    await runJob({ mode: "price-refresh", limit: 250 }, "Arabam İlan Doğrulama & Temizleme");

    // FAZ 4: Tur Tamamlandı, Dinlenme
    log(`🎉 Tur #${cycleCount} başarıyla tamamlandı. Sistem 4 dakika dinleniyor, ardından sonraki tur başlayacak...`);
    await sleep(240000); // 4 dakika bekle
  }
}

startDaemon().catch((err) => {
  console.error("Daemon kritik hata:", err);
  process.exit(1);
});
