
import { readFileSync, writeFileSync, unlinkSync, existsSync, appendFileSync, mkdirSync, openSync, closeSync, readSync, statSync } from "node:fs";
import { spawn, execSync } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { Agent, setGlobalDispatcher } from "undici";
import { pauseWatcher } from "./bekci-pause.mjs";
pauseWatcher(`tarama modu ${process.argv[2] || "1"}`);



setGlobalDispatcher(new Agent({ headersTimeout: 0, bodyTimeout: 0 }));

const projectRoot = path.resolve(import.meta.dirname, "..");
const modeNum = process.argv[2] || "1";
// Sunucu ilerlemeyi tek dosyaya yazar (bkz. src/lib/scraper/progress.ts); eskiden burada mod numaralı bir ad okunuyordu
// ve ilerleme terminale hiç gelmiyordu.
const progressFile = path.join(projectRoot, "logs", "scrape-progress.txt");
const eventsFile = path.join(projectRoot, "logs", "scrape-olaylar.jsonl");
const serverLogFile = path.join(projectRoot, "logs", "sunucu.log");
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
    name: "Nadir MODEL doldurma (<15 ilanli model ailelerini ~20 ilana tamamlar; bir kez denenen bir daha aranmaz)",
    jobs: [
      { mode: "rare-model", threshold: 15, perModelPages: 1, maxSegments: 150, maxListings: 3000, label: "Nadir modeller" },
    ],
  },
  7: {
    name: "Nadir MODEL - genis (<20 ilanli, 400 model ailesi; bir kez denenen bir daha aranmaz)",
    jobs: [
      { mode: "rare-model", threshold: 20, perModelPages: 1, maxSegments: 400, maxListings: 4000, label: "Nadir modeller (genis)" },
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
  20: {
    name: "Seyrek marka/model/yıl emsallerini tamamla (aykırı değer sonrası 3'ten az ilan)",
    jobs: [
      { mode: "sparse-market-segments", maxSegments: 100, pagesPerYear: 4, maxListings: 500, label: "Seyrek piyasa emsalleri" },
    ],
  },
};

const mode = MODES[process.argv[2]] || MODES[1];


// SUNUCU: tarama sunucu üzerinden çalışır (/api/scrape/run). Kapalıysa burada, bu terminalin arka planında başlatılır
// (çıktısı logs/sunucu.log'a gider; ayrı pencere açılmaz), tarama bitince ya da pencere kapanınca kapatılır. Zamanlı
// modda molalarda da kapatılır: açık sunucu ve ortak Chrome molada bile işlemciyi ve belleği tutuyordu. Zaten açık
// bir sunucu (start.bat ya da paralel mod) varsa ona dokunulmaz.
let ownServer = null;
const nextBin = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");

async function serverUp() {
  const local = /^http:\/\/localhost:(\d+)\/?$/.exec(appUrl);
  if (local) {
    // Geliştirme sunucusunda "/" çağrısı ana sayfayı derletir ve hemen ardından gelen API isteğinin derlemesiyle
    // yarışıp hataya düşebiliyordu; yalnızca bağlantı kurulabiliyor mu diye bakılır.
    return new Promise((resolve) => {
      const socket = net.connect({ port: Number(local[1]), host: "127.0.0.1" });
      const done = (ok) => {
        socket.destroy();
        resolve(ok);
      };
      socket.setTimeout(3000, () => done(false));
      socket.once("connect", () => done(true));
      socket.once("error", () => done(false));
    });
  }
  try {
    await fetch(appUrl, { signal: AbortSignal.timeout(4000) });
    return true;
  } catch {
    return false;
  }
}

function stopServer() {
  if (!ownServer) return;
  const pid = ownServer.pid;
  ownServer = null;
  try {
    if (process.platform === "win32") execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
    else process.kill(pid);
  } catch {
    // zaten kapanmış
  }
}

async function ensureServer() {
  if (await serverUp()) return;
  const local = /^http:\/\/localhost:(\d+)\/?$/.exec(appUrl);
  if (!local) {
    console.error("HATA: Sunucu kapali gorunuyor (" + appUrl + ").");
    process.exit(1);
  }
  mkdirSync(path.join(projectRoot, "logs"), { recursive: true });
  const out = openSync(serverLogFile, "a");
  ownServer = spawn(process.execPath, [nextBin, "dev", "-p", local[1]], { cwd: projectRoot, stdio: ["ignore", out, out], windowsHide: true });
  closeSync(out);
  ownServer.on("exit", () => {
    ownServer = null;
  });
  process.stdout.write("Sunucu arka planda baslatiliyor (ayrinti: logs/sunucu.log)");
  for (let i = 0; i < 120; i++) {
    if (await serverUp()) {
      process.stdout.write(" hazir.\n");
      return;
    }
    process.stdout.write(".");
    await new Promise((r) => setTimeout(r, 2000));
  }
  console.error("\nHATA: Sunucu 4 dakikada hazir olmadi. logs/sunucu.log dosyasina bak.");
  stopServer();
  process.exit(1);
}

process.on("exit", stopServer);
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    stopServer();
    process.exit(130);
  });
}
await ensureServer();

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


// Terminal çıktısı: tek satır (üzerine yazılan) canlı ilerleme + her model/marka bitince bir sonuç satırı:
//   [15:46:18] #257  Ferrari F8: 17 → 18 ilan (+1)       (#257 = bu çalıştırmada eklenen toplam ilan)
let lastProgress = "";
try {
  if (existsSync(progressFile)) lastProgress = readFileSync(progressFile, "utf8").trim(); // önceki çalıştırmadan kalan satır
} catch {
  // yok
}
let eventPos = existsSync(eventsFile) ? statSync(eventsFile).size : 0;
let sessionAdded = 0;
let unitsDone = 0;
const clearLine = () => process.stdout.write("\r" + " ".repeat(Math.max(20, (process.stdout.columns || 120) - 1)) + "\r");

function drainEvents() {
  try {
    if (!existsSync(eventsFile)) return;
    const size = statSync(eventsFile).size;
    if (size < eventPos) eventPos = 0;
    if (size === eventPos) return;
    const fd = openSync(eventsFile, "r");
    const buffer = Buffer.alloc(size - eventPos);
    readSync(fd, buffer, 0, buffer.length, eventPos);
    closeSync(fd);
    eventPos = size;
    for (const line of buffer.toString("utf8").split("\n")) {
      if (!line.trim()) continue;
      let e;
      try {
        e = JSON.parse(line);
      } catch {
        continue;
      }
      unitsDone++;
      if (!(e.added > 0)) continue;
      sessionAdded += e.added;
      const time = new Date(e.t || Date.now()).toLocaleTimeString("tr-TR");
      const counts = e.before != null ? `${e.before} → ${e.after ?? e.before + e.added} ilan (+${e.added})` : `+${e.added} yeni ilan`;
      clearLine();
      console.log(`[${time}] #${sessionAdded}  ${e.label}: ${counts}`);
    }
  } catch {
    // okunamayan satır bir sonraki turda denenir
  }
}

const watcher = setInterval(() => {
  drainEvents();
  try {
    if (!existsSync(progressFile)) return;
    const line = readFileSync(progressFile, "utf8").trim();
    if (line && line !== lastProgress) {
      lastProgress = line;
      const width = (process.stdout.columns || 120) - 1;
      process.stdout.write("\r" + line.slice(0, width).padEnd(width));
    }
  } catch {
    // dosya o an yazılıyorsa bir sonraki saniye okunur
  }
}, 1000);

// ZAMANLI TUR MODU (scrape.bat "Z"): taramayı tur başına N ilanla sınırlar, turlar arasında mola verir ve sen
// durdurana (Ctrl+C) ya da istenen tur sayısı bitene kadar tekrarlar. Cloudflare uzun, kesintisiz taramada
// takıldığı için kısa turlar + uzun mola: ör. 1200 ilan, 60 dk mola. Bekçi, bu süre boyunca (molalar dahil)
// beklemede kalır (bkz. bekci-pause.mjs); komut bitince ya da kapanınca kendiliğinden devam eder.
const flagValue = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? Number(process.argv[i + 1]) : NaN;
};
const roundListings = flagValue("--tur-ilan");
const breakMinutes = Number.isFinite(flagValue("--mola")) ? flagValue("--mola") : 60;
const maxRounds = Number.isFinite(flagValue("--tur")) ? flagValue("--tur") : 0; // 0 = durdurulana kadar
const timed = Number.isFinite(roundListings) && roundListings > 0;

/** Tur başına ilan sınırı: taramanın kendi üst sınırı varsa (limit/maxListings) onunla değiştirilir. */
function limitJob(job) {
  if (!timed) return job;
  const limited = { ...job };
  if ("maxListings" in limited) limited.maxListings = roundListings;
  if ("limit" in limited && limited.mode !== "price-refresh") limited.limit = roundListings;
  return limited;
}

let totalInserted = 0;

async function runJobsOnce() {
  for (const baseJob of mode.jobs) {
      const job = limitJob(baseJob);
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
        totalInserted += data.inserted ?? 0;
        log(`  ✓ ${job.label || job.source} tamamlandı:  yeni=${data.inserted ?? 0}  güncellenen=${data.updated ?? 0}  kaldırılan=${del}`);
      } else {
        log(`HATA (${job.label || job.source}): HTTP ${response.status} — ${data.error ?? "bilinmeyen"}`);
      }
    } catch (error) {
      process.stdout.write("\n");
      log(`HATA (${job.label || job.source}): ${error.name === "TimeoutError" ? "zaman asimi" : error.message}`);
    }
  }
}

console.log(`\n=== ${mode.name} basliyor ===\n`);
if (!timed) {
  await runJobsOnce();
} else {
  log(`Zamanli mod: tur basina ~${roundListings} ilan, turlar arasi ${breakMinutes} dk mola, ${maxRounds ? maxRounds + " tur" : "sen durdurana kadar (Ctrl+C)"}.`);
  let emptyRounds = 0;
  for (let round = 1; !maxRounds || round <= maxRounds; round++) {
    const before = totalInserted;
    const startedAt = Date.now();
    await ensureServer();
    log(`──── TUR ${round}${maxRounds ? "/" + maxRounds : ""} basliyor ────`);
    await runJobsOnce();
    drainEvents();
    const added = totalInserted - before;
    clearLine();
    log(`TUR ${round} bitti: +${added} yeni ilan, ${Math.round((Date.now() - startedAt) / 60000)} dk surdu (toplam +${totalInserted}).`);
    emptyRounds = added === 0 ? emptyRounds + 1 : 0;
    if (emptyRounds >= 2) {
      log("Art arda 2 turda yeni ilan gelmedi: bu tarama icin eklenecek ilan kalmamis ya da Arabam engel veriyor. Durduruluyor.");
      break;
    }
    if (maxRounds && round >= maxRounds) break;
    const until = new Date(Date.now() + breakMinutes * 60000).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
    stopServer(); // molada sunucu ve Chrome kapalı: işlemci/bellek boşta
    log(`Mola: ${breakMinutes} dk (saat ${until}'e kadar; sunucu kapatildi). Durdurmak icin pencereyi kapat ya da Ctrl+C.`);
    for (let left = breakMinutes; left > 0; left--) {
      await new Promise((r) => setTimeout(r, 60000));
      if (left % 10 === 0 && left !== breakMinutes) log(`  mola: ${left} dk kaldi`);
    }
  }
}

clearInterval(watcher);
console.log("\n=== Tarama tamamlandi. Sonuclar admin panelinde ve sitede. ===");
// Açtığımız sunucu (varsa) kapatılır; aksi hâlde alt süreç komutun bitmesini engellerdi.
stopServer();
process.exit(0);
