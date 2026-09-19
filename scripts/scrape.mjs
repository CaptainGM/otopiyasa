
import { readFileSync, writeFileSync, unlinkSync, existsSync, appendFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { Agent, setGlobalDispatcher } from "undici";



setGlobalDispatcher(new Agent({ headersTimeout: 0, bodyTimeout: 0 }));

const projectRoot = path.resolve(import.meta.dirname, "..");
const modeNum = process.argv[2] || "1";
const progressFile = path.join(projectRoot, "logs", `scrape-progress-${modeNum}.txt`);
const logFile = path.join(projectRoot, "logs", `scrape-mod${modeNum}.log`);
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
const appUrl = process.env.SCRAPE_TARGET_URL || "http://localhost:3000";
if (!secret) {
  console.error("HATA: .env icinde SCRAPE_RUN_SECRET tanimli degil.");
  process.exit(1);
}

const MODES = {
  1: {
    name: "Hizli guncelleme (8 Kurumsal Kaynak: Otokoç + DOD + VavaCars + Otoplus + Otomerkezi + Carvak + İkinciyeni + Arabam)",
    jobs: [
      { source: "otokoc", limit: 30, label: "Otokoç 2. El taze ilanlar" },
      { source: "dod", limit: 25, label: "DOD Doğuş taze ilanlar" },
      { source: "vavacars", limit: 25, label: "VavaCars taze ilanlar" },
      { source: "otoplus", limit: 25, label: "Otoplus taze ilanlar" },
      { source: "otomerkezi", limit: 25, label: "Otomerkezi taze ilanlar" },
      { source: "carvak", limit: 20, label: "Carvak taze ilanlar" },
      { source: "ikinciyeni", limit: 20, label: "İkinciyeni taze ilanlar" },
      { source: "arabam", query: "otomobil", limit: 25, label: "Arabam taze ilanlar" },
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
  11: {
    name: "TUM ILANLARI DOGRULA VE SENKRONIZE ET (Tumu kontrol edilir, olu ilanlar kaldirilir, fiyat guncellenir)",
    jobs: [
      { mode: "price-refresh-loop", batchSize: 250, label: "Tüm ilan doğrulaması" }
    ],
  },
  12: {
    name: "YALNIZCA YENI ILANLARI CEK (8 Kurumsal Kaynak: Otokoç + DOD + VavaCars + Otoplus + İkinciyeni + Otomerkezi + Carvak + Arabam)",
    jobs: [
      { source: "otokoc", limit: 800, label: "Otokoç 2. El Koç Grubu ilanları" },
      { source: "dod", limit: 500, label: "DOD Doğuş Grubu kurumsal ilanlar" },
      { source: "vavacars", limit: 500, label: "VavaCars kurumsal ilanlar" },
      { source: "otoplus", limit: 400, label: "Otoplus garantili kurumsal ilanlar" },
      { source: "ikinciyeni", limit: 300, label: "İkinciyeni Anadolu Grubu ilanları" },
      { source: "otomerkezi", limit: 300, label: "Otomerkezi kurumsal ilanlar" },
      { source: "carvak", limit: 250, label: "Carvak kurumsal ilanlar" },
      { source: "arabam", query: "otomobil", limit: 12000, label: "Arabam yeni ilanlar (Akıllı atlama)" },
    ],
  },
  13: {
    name: "VAVACARS (Tam kurumsal ekspertizli envanter, ~2-3 dk)",
    jobs: [{ source: "vavacars", limit: 500, label: "VavaCars tam envanter" }],
  },
  14: {
    name: "24 SAAT STEALTH SENKRONIZASYON (Dakikada 10 ilan, 6 sn insansi aralik, 0 blok, sonsuz dongu)",
    jobs: [
      { mode: "price-refresh-loop", batchSize: 200, label: "24 Saat Kesintisiz Stealth Tarama" }
    ],
  },
  15: {
    name: "OTOPLUS (Sahibinden garantili kurumsal envanter, ~2-3 dk)",
    jobs: [{ source: "otoplus", limit: 500, label: "Otoplus tam kurumsal envanter" }],
  },
  16: {
    name: "CARVAK (Uluslararası kurumsal ekspertizli envanter, ~2-3 dk)",
    jobs: [{ source: "carvak", limit: 300, label: "Carvak tam kurumsal envanter" }],
  },
  17: {
    name: "OTOKOC 2. EL (Koç Grubu devasa kurumsal envanter, ~2-3 dk)",
    jobs: [{ source: "otokoc", limit: 1000, label: "Otokoç 2. El tam envanter" }],
  },
  18: {
    name: "DOD (Doğuş Otomotiv kurumsal ekspertizli envanter, ~3-4 dk)",
    jobs: [{ source: "dod", limit: 600, label: "DOD tam kurumsal envanter" }],
  },
  19: {
    name: "IKINCIYENI.COM (Anadolu Grubu / Çelik Motor envanteri, ~2 dk)",
    jobs: [{ source: "ikinciyeni", limit: 400, label: "İkinciyeni tam kurumsal envanter" }],
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

const WARP_CLI = process.platform === "win32"
  ? '"C:\\Program Files\\Cloudflare\\Cloudflare WARP\\warp-cli.exe"'
  : "warp-cli --accept-tos";

async function rotateWarpIP() {
  try {
    const { exec } = await import("node:child_process");
    log("  🔄 [Cloudflare WARP] IP yenileniyor...");
    await new Promise((resolve) => {
      exec(`${WARP_CLI} tunnel rotate-keys`, (err) => {
        if (err) {
          // rotate-keys desteklenmezse disconnect/connect yap
          exec(`${WARP_CLI} disconnect`, () => {
            setTimeout(() => {
              exec(`${WARP_CLI} connect`, () => resolve());
            }, 1000);
          });
        } else {
          resolve();
        }
      });
    });
    await new Promise((r) => setTimeout(r, 2500));
    log("  ✓ [Cloudflare WARP] Yeni temiz IP devrede.");
  } catch {
    // WARP yoksa sessizce geç
  }
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
  const stateFile = path.join(projectRoot, "logs", `sync-state-mod${modeNum}.json`);
  let batchNum = 0;
  let maxBatches = null; // ilk durum sorgusundan sonra hesaplanir

  try {
    if (existsSync(stateFile)) {
      const saved = JSON.parse(readFileSync(stateFile, "utf8"));
      if (saved && typeof saved.offset === "number" && saved.offset > 0) {
        batchNum = Math.floor(saved.offset / job.batchSize);
        log(`Önceki oturum tespit edildi: ~${saved.offset} ilan önceden taranmıştı. Kaldığı yerden (${batchNum + 1}. parti) devam ediliyor...`);
      }
    }
  } catch {
    // state dosyasını okuyamazsa sıfırdan başlar
  }

  while (true) {
    let status;
    try {
      const res = await fetch(`${appUrl}/api/scrape/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-scrape-secret": secret },
        body: JSON.stringify({ mode: "refresh-status" }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        const text = await res.text();
        log(`Durum sorgusu HTTP ${res.status} döndü (${text.slice(0, 150)}), 10 sn sonra tekrar denenecek...`);
        await new Promise((r) => setTimeout(r, 10000));
        continue;
      }
      status = await res.json();
    } catch (error) {
      log(`Durum sorgusu basarisiz (${error.message}), 30 sn sonra tekrar denenecek...`);
      await new Promise((r) => setTimeout(r, 30000));
      continue;
    }

    if (!status || typeof status.total !== "number") {
      log(`Durum sorgusu geçersiz yanıt döndü: ${JSON.stringify(status)}, 10 sn sonra tekrar denenecek...`);
      await new Promise((r) => setTimeout(r, 10000));
      continue;
    }

    if (status.total <= 0) {
      log("Veritabanında kontrol edilecek Arabam ilanı bulunamadı.");
      try { unlinkSync(stateFile); } catch {}
      break;
    }

    // Yalnızca Mod 10 için: parça bazlı hasar verisi eksik kalmadığında durdur.
    // Mod 11 ise genel ilan doğrulama/fiyat yenileme olduğu için tüm total ilan taranana kadar devam eder.
    if (modeNum === "10" && typeof status.missingDamageParts === "number" && status.missingDamageParts <= 0) {
      log(`TAM TUR TAMAMLANDI — ${status.total} Arabam ilaninin tumunde parca bazli hasar verisi mevcut.`);
      try { unlinkSync(stateFile); } catch {}
      break;
    }

    // Sunucu her partide DENENEN tum ilanlarin updatedAt'ini yeniler (basarisiz
    // olsa bile — bkz. run-scrape.ts runPriceRefresh), yani ayni ilan iki kez
    // denenmiyor. Bu sayede TAM BIR TUR = total/batchSize parti garantili
    // bitiyor.
    if (maxBatches === null) {
      maxBatches = Math.ceil(status.total / job.batchSize);
      log(`Toplam ${status.total} ilan, parti boyutu: ${job.batchSize}, toplam parti sayısı: ~${maxBatches}`);
    }
    if (batchNum >= maxBatches) {
      log(
        `TAM TUR TAMAMLANDI (${maxBatches} parti) — Toplam ${status.total} ilanın doğrulanması ve güncellenmesi bitti.`
      );
      try { unlinkSync(stateFile); } catch {}

      if (modeNum === "14") {
        log("🔄 [24 Saatlik Stealth Mod] 1 tur tamamlandı. 3 dakika dinlenip en baştan (yine en eski ilanlardan) kesintisiz devam ediliyor...");
        await new Promise((r) => setTimeout(r, 180000));
        batchNum = 0;
        maxBatches = null;
        continue;
      }
      break;
    }

    batchNum += 1;
    const currentOffset = (batchNum - 1) * job.batchSize;
    const displayOffset = Math.min(currentOffset, status.total);
    const pct = ((displayOffset / status.total) * 100).toFixed(1);
    const remaining = status.total - displayOffset;
    log(`──── Parti ${batchNum}/${maxBatches} ────  %${pct} (${displayOffset}/${status.total}, kalan ${remaining})  ────  ${job.batchSize} ilan kontrol ediliyor...`);

    let success = false;
    let attempts = 0;
    const maxAttempts = 20; // Zırhlı Gece Modu: Gece kendi kendine durmaz, 20 kez dener
    while (!success && attempts < maxAttempts) {
      attempts += 1;
      try {
        const response = await fetch(`${appUrl}/api/scrape/run`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-scrape-secret": secret,
            "x-scrape-mode": modeNum,
            "x-actor-label": `Terminal (Mod ${modeNum})`,
            Connection: "close",
          },
          body: JSON.stringify({
            mode: "price-refresh",
            limit: job.batchSize,
            progressOffset: displayOffset,
            progressTotal: status.total,
          }),
          signal: AbortSignal.timeout(30 * 60 * 1000),
        });
        let data = {};
        let parseOk = true;
        try {
          data = await response.json();
        } catch {
          parseOk = false;
        }
        if (response.ok) {
          const upd = data.updated ?? 0;
          const del = data.deleted ?? 0;
          const ins = data.inserted ?? 0;
          if (!parseOk) {
            log(`  ✓ Parti ${batchNum} tamamlandı (yanıt okunamadı ama sunucu 200 döndü, muhtemelen başarılı).`);
          } else {
            log(`  ✓ Parti ${batchNum} sonuç:  güncellenen=${upd}  kaldırılan=${del}  yeni=${ins}`);
          }
          success = true;
          if (parseOk && upd === 0 && del === 0 && ins === 0) {
            log(`  ℹ Parti ${batchNum}: Hiçbir ilan değişmedi veya geçici engel. Devam ediliyor...`);
          }
          try {
            writeFileSync(stateFile, JSON.stringify({
              offset: displayOffset + job.batchSize,
              updatedAt: new Date().toISOString()
            }, null, 2), "utf8");
          } catch {}

          // ZenRows ve tarayıcı başlıkları sayesinde bağlantıyı koparmadan devam et
        } else {
          log(
            `  ✗ Parti ${batchNum} HATA: HTTP ${response.status} — ${data.error ?? "bilinmeyen"} (Deneme ${attempts}/${maxAttempts})`
          );
          log(`  🔄 [Zırhlı Gece Modu] IP yenileniyor ve 15 sn sonra tekrar deneniyor...`);
          await rotateWarpIP();
          await new Promise((r) => setTimeout(r, 15000));
        }
      } catch (error) {
        log(
          `  ✗ Parti ${batchNum} HATA: ${error.name === "TimeoutError" ? "zaman aşımı" : error.message} (Deneme ${attempts}/${maxAttempts})`
        );
        log(`  🔄 [Zırhlı Gece Modu] Bağlantı yenileniyor, 15 sn sonra tekrar deneniyor...`);
        await rotateWarpIP();
        await new Promise((r) => setTimeout(r, 15000));
      }
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

  log(`Scrape başlıyor: ${job.label || job.source} (limit ${job.limit ?? "-"})`);
  try {
    const response = await fetch(`${appUrl}/api/scrape/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-scrape-secret": secret,
        "x-scrape-mode": modeNum,
        "x-actor-label": `Terminal (Mod ${modeNum})`,
      },
      body: JSON.stringify(job),
      signal: AbortSignal.timeout(12 * 60 * 60 * 1000),
    });
    const data = await response.json().catch(() => ({}));
    process.stdout.write("\n");
    if (response.ok) {
      const del = data.deleted ?? 0;
      log(`  ✓ ${job.label || job.source} tamamlandı:  yeni=${data.inserted ?? 0}  güncellenen=${data.updated ?? 0}  kaldırılan=${del}`);
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
