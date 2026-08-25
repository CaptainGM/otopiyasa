
import { readFileSync, existsSync, appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { Agent, setGlobalDispatcher } from "undici";


setGlobalDispatcher(new Agent({ headersTimeout: 0, bodyTimeout: 0 }));

const projectRoot = path.resolve(import.meta.dirname, "..");
const progressFile = path.join(projectRoot, "logs", "scrape-progress.txt");
const logFile = path.join(projectRoot, "logs", "scheduled-scrape.log");
mkdirSync(path.join(projectRoot, "logs"), { recursive: true });

const env = Object.fromEntries(
  readFileSync(path.join(projectRoot, ".env"), "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    })
);
const secret = env.SCRAPE_RUN_SECRET;
const appUrl = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
if (!secret) {
  console.error("HATA: .env icinde SCRAPE_RUN_SECRET tanimli degil.");
  process.exit(1);
}

const MODES = {
  1: {
    name: "Hizli guncelleme",
    jobs: [
      { source: "arabam", query: "otomobil", limit: 30 },
      { source: "otomerkezi", limit: 60 },
    ],
  },
  2: {
    name: "Genis tarama (Arabam, tum markalar, hedef 10000 - saatler surer)",
    jobs: [{ source: "arabam", query: "otomobil", limit: 10000 }],
  },
  3: {
    name: "Otomerkezi tam envanter (~250 ilan)",
    jobs: [{ source: "otomerkezi", limit: 250 }],
  },
  4: {
    name: "Nadir marka guclendirme (az/hic ilani olan markalari derin tarar)",
    jobs: [{ mode: "rare", threshold: 40, perBrandPages: 12, label: "Nadir markalar" }],
  },
  5: {
    name: "En az olan markalar (yalniz <15 ilanli markalari 20 sayfa DERIN tarar)",
    jobs: [{ mode: "rare", threshold: 15, perBrandPages: 20, label: "En az markalar (derin)" }],
  },
  
  6: {
    name: "Nadir MODEL doldurma (<10 ilanli marka+model segmentlerini tarar)",
    jobs: [
      { mode: "rare-model", threshold: 10, perModelPages: 2, maxSegments: 120, maxListings: 1500, label: "Nadir modeller" },
    ],
  },
  7: {
    name: "Nadir MODEL - genis (<15 ilanli, 300 segment, ~2000 ilan sinir)",
    jobs: [
      { mode: "rare-model", threshold: 15, perModelPages: 3, maxSegments: 300, maxListings: 2500, label: "Nadir modeller (genis)" },
    ],
  },
  // Var olan ilanlari yeniden cekip FIYATLARINI gunceller (kaynak siteyle esitler).
  8: {
    name: "Fiyat taramasi (en bayat 800 ilani yeniden cekip fiyat gunceller)",
    jobs: [{ mode: "price-refresh", limit: 800, label: "Fiyat taramasi" }],
  },
  // Adres alani bos olan ESKI ilanlari yeniden ceker. 22 Temmuz oncesi cekilen
  // 1772 ilanda ilce bilgisi yok; bu yuzden haritada il merkezinde yigiliyorlar.
  9: {
    name: "Adres tamamlama (adressiz eski ilanlari yeniden cekip ilcesini doldurur)",
    jobs: [{ mode: "address-backfill", limit: 2500, label: "Adres tamamlama" }],
  },
  // TUM ilanlari yeniden kontrol eder: Otomerkezi govde tipi (hizli, ~230 ilan)
  // + Arabam parca-bazli hasar/fiyat yenilemesi (yavas, ~16 bin ilan, 10-15 saat).
  // Arabam kismi PARTI PARTI calisir (250'lik gruplar) ve ilerlemeyi
  // "damageParts eksik kalan ilan sayisi" ile takip eder (bkz. run-scrape.ts
  // arabamRefreshStatus) — bu sayac veritabaninda oldugu icin, pencereyi
  // KAPATIP ertesi gun tekrar "10" secince KALDIGI YERDEN devam eder, ayrica
  // bir "checkpoint" dosyasi TUTMAYA gerek yok.
  10: {
    name: "TAM YENILEME - tum ilanlar (hasar bolgesi + fiyat + govde tipi, 10-15 saat, ISTEDIGIN AN kapatip devam edebilirsin)",
    jobs: [
      { source: "otomerkezi", limit: 300, label: "Otomerkezi govde tipi (tum envanter)" },
      { mode: "price-refresh-loop", batchSize: 250, label: "Arabam tam yenileme (hasar + fiyat)" },
    ],
  },
};

const mode = MODES[process.argv[2]] || MODES[1];


try {
  await fetch(appUrl, { signal: AbortSignal.timeout(8000) });
} catch {
  console.error("HATA: Sunucu kapali gorunuyor (" + appUrl + ").");
  console.error("Once start.bat ile projeyi baslat, sonra scrape.bat'i tekrar calistir.");
  process.exit(1);
}

function log(message) {
  const line = `[${new Date().toLocaleString("tr-TR")}] ${message}`;
  console.log(line);
  appendFileSync(logFile, line + "\n", "utf8");
}

/**
 * "TAM YENILEME" partili dongusu (mod 10). Ilerleme veritabanindaki
 * "damageParts eksik Arabam ilani" sayisiyla takip edilir — ayri bir
 * checkpoint dosyasi YOK, pencere kapatilip script tekrar baslatilinca
 * kaldigi yerden (en bayat updatedAt'ten) devam eder. Kullanici istedigi an
 * bu pencereyi kapatabilir; o an calisan parti (en fazla ~15 dk) tamamlanana
 * kadar sunucu tarafinda kaydetmeye devam eder, sonrasi kaybolmaz.
 */
async function runPriceRefreshLoop(job) {
  log(`Basliyor: ${job.label} (parti boyutu ${job.batchSize})`);
  let batchNum = 0;
  let maxBatches = null; // ilk durum sorgusundan sonra hesaplanir

  while (true) {
    let status;
    try {
      const res = await fetch(`${appUrl}/api/scrape/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-scrape-secret": secret },
        body: JSON.stringify({ mode: "refresh-status" }),
        signal: AbortSignal.timeout(15000),
      });
      status = await res.json();
    } catch (error) {
      log(`Durum sorgusu basarisiz (${error.message}), 30 sn sonra tekrar denenecek...`);
      await new Promise((r) => setTimeout(r, 30000));
      continue;
    }

    if (!status.missingDamageParts || status.missingDamageParts <= 0) {
      log(`TAM TUR TAMAMLANDI — ${status.total} Arabam ilaninin tumunde parca bazli hasar verisi mevcut.`);
      break;
    }

    // Sunucu her partide DENENEN tum ilanlarin updatedAt'ini yeniler (basarisiz
    // olsa bile — bkz. run-scrape.ts runPriceRefresh), yani ayni ilan iki kez
    // denenmiyor. Bu sayede TAM BIR TUR = total/batchSize parti garantili
    // bitiyor. Bazi eski ilanlar kaynaktan tamamen kaldirilmis (satilmis)
    // olabilir — bunlarin parca verisi hicbir zaman gelmeyecek, o yuzden
    // "missingDamageParts" 0'a degil bir tabana oturabilir; bu GUVENLIK SINIRI
    // sonsuz donguye girmeden bir tam turda dursun diye var.
    if (maxBatches === null) {
      maxBatches = Math.ceil(status.total / job.batchSize) + 5;
      log(`Tahmini parti sayisi (tek tam tur): ~${maxBatches}`);
    }
    if (batchNum >= maxBatches) {
      log(
        `GUVENLIK SINIRINA ULASILDI (${maxBatches} parti) — kalan ${status.missingDamageParts} ilan ` +
          `muhtemelen kaynaktan kaldirilmis (satilmis) ilanlar, bir daha denenmeyecek. Duruyor.`
      );
      break;
    }

    batchNum += 1;
    const done = status.total - status.missingDamageParts;
    const pct = ((done / status.total) * 100).toFixed(1);
    log(`Parti ${batchNum}/${maxBatches}: %${pct} tamamlandi (${done}/${status.total}), ${status.missingDamageParts} ilan kaldi. Bu parti ${job.batchSize} ilan cekiyor (~10-15 dk)...`);

    try {
      const response = await fetch(`${appUrl}/api/scrape/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-scrape-secret": secret },
        body: JSON.stringify({ mode: "price-refresh", limit: job.batchSize }),
        signal: AbortSignal.timeout(30 * 60 * 1000),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        log(`Parti ${batchNum} bitti: guncellenen ${data.updated}.`);
      } else {
        log(`Parti ${batchNum} HATA: HTTP ${response.status} — ${data.error ?? "bilinmeyen"}`);
      }
    } catch (error) {
      log(`Parti ${batchNum} HATA: ${error.name === "TimeoutError" ? "zaman asimi" : error.message}`);
    }
  }
}


let lastProgress = "";
const watcher = setInterval(() => {
  try {
    if (!existsSync(progressFile)) return;
    const line = readFileSync(progressFile, "utf8").trim();
    if (line && line !== lastProgress) {
      lastProgress = line;
      process.stdout.write(`\r${line}                    `);
    }
  } catch {
   
  }
}, 1000);

console.log(`\n=== ${mode.name} basliyor ===\n`);
for (const job of mode.jobs) {
  if (job.mode === "price-refresh-loop") {
    await runPriceRefreshLoop(job);
    continue;
  }

  log(`Scrape basliyor: ${job.label || job.source} (limit ${job.limit ?? "-"})`);
  try {
    const response = await fetch(`${appUrl}/api/scrape/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-scrape-secret": secret },
      body: JSON.stringify(job),
      signal: AbortSignal.timeout(12 * 60 * 60 * 1000),
    });
    const data = await response.json().catch(() => ({}));
    process.stdout.write("\n");
    if (response.ok) {
      log(`Bitti: ${job.label || job.source} — yeni ${data.inserted}, guncellenen ${data.updated}. ${data.message ?? ""}`);
    } else {
      log(`HATA (${job.label || job.source}): HTTP ${response.status} — ${data.error ?? "bilinmeyen"}`);
    }
  } catch (error) {
    process.stdout.write("\n");
    log(`HATA (${job.label || job.source}): ${error.name === "TimeoutError" ? "zaman asimi" : error.message}`);
  }
}

clearInterval(watcher);
console.log("\n=== Tarama tamamlandi. Sonuclar admin panelinde ve sitede. ===");
