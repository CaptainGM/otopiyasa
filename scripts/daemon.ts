// ============================================================================
// OtoPiyasa - 7/24 Otonom Veri Motoru (Daemon)
// ============================================================================
// Her tur:
//   1. KEŞİF       Kurumsal kaynakların ilk sayfalarından yeni ilanlar (her tur); yeni
//                  Otokoç/Otoplus ilanları ilan sayfasından tam galeri ve detayla eklenir,
//                  eskiler her turda küçük partilerle tamamlanır (enrich-detail.ts).
//   2. SENKRON     Sırası gelen TEK kaynağın tüm envanteri baştan sona taranır:
//                  fiyat/km/foto güncellenir, satılanlar arşive taşınır, geri
//                  dönenler geri açılır (src/lib/scraper/reconcile.ts).
//   3. SİTEMAP     Günde bir Arabam sitemap'i (yalnızca önceliklendirme).
//   4. ARABAM      Arabam'a erişilebilen makinede (ev/TR IP) detay taraması.
// Arşiv kararları src/lib/scraper/listing-lifecycle.ts kurallarına uyar:
// belirsiz yanıt (engel, zaman aşımı) hiçbir ilanı arşive taşımaz.
// ============================================================================
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./load-env";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadEnv(projectRoot);

process.env.DISABLE_ZENROWS = "true";
process.env.SCRAPE_CONCURRENCY = process.env.SCRAPE_CONCURRENCY || "2";
process.env.SCRAPE_MIN_INTERVAL_MS = process.env.SCRAPE_MIN_INTERVAL_MS || "900";

// Arabam, veri merkezi / yurtdışı IP'lerine Cloudflare doğrulaması gösteriyor.
// Bulut sunucuda kapalı; evdeki makinede EXCLUDE_ARABAM=false ile açılır.
const EXCLUDE_ARABAM = process.env.EXCLUDE_ARABAM !== "false";
// pm2 altında çalışırken (pm_id tanımlı) GitHub'daki yeni kodu kendisi çekip yeniden başlar.
const MANAGED_BY_PM2 = process.env.pm_id !== undefined;
const AUTO_UPDATE = process.env.DAEMON_AUTO_UPDATE ? process.env.DAEMON_AUTO_UPDATE === "true" : MANAGED_BY_PM2;
const HOST_LABEL = process.env.DAEMON_HOST_LABEL || `${os.hostname()} (${os.platform()}${MANAGED_BY_PM2 ? ", pm2" : ""})`;

const REST_SECONDS: Record<Mode, number> = { hybrid: 300, new_only: 180, sweep_only: 180 };
const WATCHDOG_STALL_MS = 30 * 60 * 1000;
const UPDATE_CHECK_MS = 10 * 60 * 1000;
const ARABAM_REFRESH_BATCH = 150;
const DETAIL_BATCH = 20;
const DISCOVERY_BATCH = 30;

type Mode = "hybrid" | "new_only" | "sweep_only";
type DiscoverySource = "dod" | "otokoc" | "otomerkezi" | "vavacars" | "otoplus" | "carvak" | "ikinciyeni" | "arabam";

const liveLogs: string[] = [];
function log(msg: string) {
  const time = new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
  const line = `[${time}] ${msg}`;
  console.log(line);
  liveLogs.push(line);
  if (liveLogs.length > 80) liveLogs.shift();
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// Kod güncelleme. Depo "Initial commit" amend + force-push ile güncellendiği
// için `git pull` geçmişler ayrıştığında hep başarısız oluyordu ve sunucu
// haftalarca eski kodla çalıştı. fetch + reset --hard her durumda çalışır;
// .env ve logs gibi takip edilmeyen dosyalara dokunmaz.
// ---------------------------------------------------------------------------
function git(args: string): string {
  return execSync(`git ${args}`, { cwd: projectRoot, encoding: "utf8", timeout: 60_000 }).trim();
}

function updateCodeFromGit(): { changed: boolean; note: string } {
  try {
    git("fetch origin main");
    const head = git("rev-parse HEAD");
    const remote = git("rev-parse origin/main");
    if (head === remote) return { changed: false, note: "Kod güncel." };
    if (!AUTO_UPDATE) return { changed: false, note: `GitHub'da yeni kod var (${remote.slice(0, 7)}); otomatik güncelleme kapalı.` };
    const depsChanged = (() => {
      try {
        return git(`diff --name-only ${head} ${remote}`).split("\n").some((f) => f === "package.json" || f === "package-lock.json");
      } catch {
        return true;
      }
    })();
    git("reset --hard origin/main");
    if (depsChanged) {
      log("📦 [GÜNCELLEME] Bağımlılıklar değişmiş, npm install çalıştırılıyor...");
      execSync("npm install --no-audit --no-fund", { cwd: projectRoot, stdio: "inherit", timeout: 15 * 60_000 });
    }
    return { changed: true, note: `${head.slice(0, 7)} → ${remote.slice(0, 7)}` };
  } catch (err: any) {
    return { changed: false, note: `Git güncellemesi yapılamadı: ${(err?.message || String(err)).split("\n")[0]}` };
  }
}

async function main() {
  console.log("===============================================================");
  console.log("  🚗 OtoPiyasa 7/24 Otonom Veri Motoru");
  console.log(`  Makine: ${HOST_LABEL} | Arabam: ${EXCLUDE_ARABAM ? "kapalı" : "açık"} | Oto-güncelleme: ${AUTO_UPDATE ? "açık" : "kapalı"}`);
  console.log("===============================================================\n");

  log("Veritabanına bağlanılıyor...");
  const { connectDB } = await import("@/lib/mongodb");
  const { runScrapeJob, runPriceRefresh } = await import("@/lib/scraper/run-scrape");
  const { reconcileSource, pickDueReconcileSource } = await import("@/lib/scraper/reconcile");
  const { syncArabamSitemap, isSitemapSyncDue } = await import("@/lib/scraper/arabam-sitemap");
  const { runDetailBackfill } = await import("@/lib/scraper/enrich-detail");
  const { runSitemapDiscovery } = await import("@/lib/scraper/arabam-discovery");
  const { backfillMissingRand } = await import("@/lib/feed-rand");
  const { getFuelPrices } = await import("@/lib/fuel-prices");
  const { recordHourlyMetric, updateDaemonHeartbeat, getDaemonControl, setDaemonControl, DaemonHeartbeat } = await import(
    "@/models/ScrapeMetric"
  );
  const { setProgressHook } = await import("@/lib/scraper/progress");
  const { default: mongoose } = await import("mongoose");

  for (let attempt = 1; ; attempt++) {
    try {
      await connectDB();
      log("✅ Veritabanı bağlantısı kuruldu.");
      break;
    } catch (connErr: any) {
      log(`⚠️ [MongoDB] Bağlantı denemesi #${attempt} başarısız: ${connErr?.message || connErr}`);
      await sleep(attempt < 5 ? 5000 : 30000);
    }
  }
  mongoose.connection.on("disconnected", () => log("⚠️ [MongoDB] Bağlantı kesildi, yeniden bağlanılacak."));
  mongoose.connection.on("reconnected", () => log("✅ [MongoDB] Yeniden bağlandı."));

  const startupUpdate = updateCodeFromGit();
  log(`🔄 [BAŞLATMA] ${startupUpdate.note}`);
  if (startupUpdate.changed && MANAGED_BY_PM2) {
    log("🔁 Yeni kod alındı; pm2 ile taze başlatılıyor...");
    process.exit(1);
  }

  const initialHb = await DaemonHeartbeat.findOne({ daemonId: "primary-daemon" }).lean();
  let cycle = Number((initialHb as any)?.cycle) || 0;
  let currentPhase = "🚀 Başlatılıyor...";
  let isIdle = false;
  let currentMode: Mode = "hybrid";
  let restartPending = false;
  let lastProgress = Date.now();
  const touch = () => (lastProgress = Date.now());
  const logAndTouch = (msg: string) => {
    touch();
    log(msg);
  };

  async function sendHeartbeat(status: "online" | "idle" = isIdle ? "idle" : "online") {
    try {
      if (mongoose.connection.readyState !== 1) await connectDB();
      const ctrl = await getDaemonControl();
      if (ctrl.mode) currentMode = ctrl.mode;

      if (ctrl.command === "restart" && !restartPending) {
        log("🔄 [PANEL] Yeniden başlatma istendi; kod güncelleniyor...");
        const res = updateCodeFromGit();
        log(`🔄 [PANEL] ${res.note}`);
        await setDaemonControl("run", "🔄 Yeniden başlatılıyor...");
        if (MANAGED_BY_PM2) restartPending = true;
      }
      const stopped = ctrl.command === "stop" || ctrl.status === "stopped";
      await updateDaemonHeartbeat({
        phase: stopped ? "🛑 Durduruldu (Panelden 'Motoru Başlat' ile çalıştırılabilir)" : currentPhase,
        cycle: Math.max(1, cycle),
        status: stopped ? "stopped" : status,
        mode: currentMode,
        recentLogs: [...liveLogs],
        host: HOST_LABEL,
      });
    } catch (err: any) {
      console.warn(`[HEARTBEAT] ${err?.message || err}`);
    }
  }

  // Bekçi: uzun süre ilerleme yoksa pm2 altında süreci yeniden başlat (asılı kalan istek vb.).
  setInterval(() => {
    if (isIdle || Date.now() - lastProgress < WATCHDOG_STALL_MS) return;
    log(`🚨 [BEKÇİ] ${Math.round((Date.now() - lastProgress) / 60000)} dakikadır ilerleme yok.`);
    if (MANAGED_BY_PM2) process.exit(1);
    touch();
  }, 60_000);

  // GitHub'da yeni kod var mı? Varsa tur bitince yeniden başla.
  setInterval(() => {
    if (!AUTO_UPDATE || restartPending) return;
    const res = updateCodeFromGit();
    if (res.changed) {
      log(`📦 [KOD GÜNCELLEMESİ] ${res.note}; tur bitince yeniden başlatılacak.`);
      restartPending = true;
    }
  }, UPDATE_CHECK_MS);

  setInterval(() => void sendHeartbeat(), 15_000);

  setProgressHook((stage, current, total) => {
    touch();
    const pct = total > 0 ? Math.round((current / total) * 100) : 0;
    currentPhase = `⚡ [${stage}] ${current}/${total} (%${pct})`;
  });

  while (true) {
    try {
      if (restartPending) {
        log("🔁 Yeni kodla yeniden başlatılıyor (pm2)...");
        await sendHeartbeat();
        process.exit(1);
      }

      const ctrl = await getDaemonControl();
      if (ctrl.mode) currentMode = ctrl.mode;
      if (ctrl.command === "stop" || ctrl.status === "stopped") {
        isIdle = true;
        currentPhase = "🛑 Durduruldu";
        await sleep(5000);
        continue;
      }

      cycle++;
      isIdle = false;
      touch();
      log(`================ TUR #${cycle} | MOD: ${currentMode} ================`);

      // ---------------------------------------------------------------- 1. KEŞİF
      if (currentMode !== "sweep_only") {
        const targets: Array<{ source: DiscoverySource; limit: number }> = [
          { source: "otokoc", limit: 30 },
          { source: "otomerkezi", limit: 30 },
          { source: "vavacars", limit: 30 },
          { source: "otoplus", limit: 25 },
          { source: "carvak", limit: 25 },
          { source: "ikinciyeni", limit: 25 },
          { source: "dod", limit: 20 },
        ];
        currentPhase = `🚗 Yeni ilan keşfi (${targets.length} kaynak)`;
        const results = await Promise.allSettled(
          targets.map(async (t) => {
            const res = await runScrapeJob({ source: t.source, query: "otomobil", limit: t.limit, pageOffset: 1 });
            await recordHourlyMetric({
              source: t.source,
              scanned: res.sources?.[0]?.fetched || res.inserted + res.updated + (res.unchanged || 0),
              inserted: res.inserted,
              updated: res.updated,
              deleted: 0,
            });
            return { ...t, res };
          })
        );
        touch();
        const parts = results.map((r, i) =>
          r.status === "fulfilled"
            ? `${targets[i].source} +${r.value.res.inserted}/${r.value.res.updated}g`
            : `${targets[i].source} HATA: ${(r.reason as Error)?.message?.slice(0, 60)}`
        );
        log(`🚗 [KEŞİF] ${parts.join(" | ")}`);
      }

      // Eski kodla eklenmiş ilanlar "Keşfet" akışından dışlanmasın (Car.rand eksikse yaz).
      const randFixed = await backfillMissingRand().catch(() => 0);
      if (randFixed > 0) log(`🎲 [AKIŞ] ${randFixed} ilana rastgele akış değeri yazıldı.`);

      // İlan detayındaki km başına yakıt maliyeti için pompa fiyatları (12 saatten eskiyse yenilenir).
      const fuel = await getFuelPrices().catch(() => null);
      if (fuel && Date.now() - new Date(fuel.fetchedAt).getTime() < 60_000) {
        log(`⛽ [YAKIT] Fiyatlar güncellendi (${fuel.source}): benzin ${fuel.average.benzin} ₺, motorin ${fuel.average.dizel} ₺, LPG ${fuel.average.lpg} ₺`);
      }

      // ------------------------------------------------- 1b. DETAY TAMAMLAMA
      // Otokoç/Otoplus: ilan sayfasından galeri, tramer, boya ve teknik bilgi (her turda küçük parti).
      if (currentMode !== "sweep_only") {
        currentPhase = "🖼️ İlan detayları tamamlanıyor";
        await runDetailBackfill(DETAIL_BATCH, { log: logAndTouch });
      }

      // -------------------------------------------------------------- 2. SENKRON
      if (currentMode !== "new_only") {
        const due = await pickDueReconcileSource();
        if (due) {
          currentPhase = `🔎 ${due.toUpperCase()} tam envanter senkronu`;
          const r = await reconcileSource(due, { log: logAndTouch });
          await recordHourlyMetric({
            source: due,
            scanned: r.seen,
            inserted: r.inserted,
            updated: r.updated,
            deleted: r.archived,
          });
        }

        // ------------------------------------------------------------ 3. SİTEMAP
        if (await isSitemapSyncDue()) {
          currentPhase = "🗺️ Arabam sitemap senkronu";
          await syncArabamSitemap({ log: logAndTouch });
        }

        // ------------------------------------------------------ 4. ARABAM DETAY
        if (!EXCLUDE_ARABAM) {
          // Yeni ilanlar: sitemap kuyruğundan (kategori sayfası gezmek robots.txt'e aykırıydı).
          currentPhase = "🆕 Arabam yeni ilanlar (sitemap kuyruğu)";
          const found = await runSitemapDiscovery(DISCOVERY_BATCH);
          if (found.picked > 0) log(`🆕 [ARABAM] ${found.message}`);
          await recordHourlyMetric({ source: "arabam", scanned: found.picked, inserted: found.inserted, updated: 0, deleted: 0 });

          currentPhase = `📊 Arabam detay taraması (${ARABAM_REFRESH_BATCH} ilan)`;
          const res = await runPriceRefresh(ARABAM_REFRESH_BATCH);
          log(`📊 [ARABAM] ${res.message}`);
          await recordHourlyMetric({
            source: "arabam",
            scanned: res.sources?.[0]?.fetched || 0,
            inserted: 0,
            updated: res.updated,
            deleted: res.deleted || 0,
          });
        }
      }

      const rest = REST_SECONDS[currentMode];
      isIdle = true;
      currentPhase = `☕ Dinleniyor (~${Math.round(rest / 60)} dk, sıradaki: Tur #${cycle + 1})`;
      await sendHeartbeat("idle");
      for (let waited = 0; waited < rest && !restartPending; waited += 5) await sleep(5000);
    } catch (cycleError: any) {
      touch();
      log(`⚠️ [TUR HATASI] Tur #${cycle}: ${cycleError?.message || cycleError}`);
      await sleep(15000);
    }
  }
}

process.on("unhandledRejection", (reason) => {
  log(`⚠️ [UNHANDLED REJECTION] ${reason instanceof Error ? reason.stack || reason.message : String(reason)}`);
});
process.on("uncaughtException", (err) => {
  log(`⚠️ [UNCAUGHT EXCEPTION] ${err.stack || err.message}`);
});
process.on("SIGTERM", () => {
  log("🛑 [SIGTERM] Kapatma sinyali alındı.");
  process.exit(0);
});
process.on("SIGINT", () => {
  log("🛑 [SIGINT] Ctrl+C ile durduruldu.");
  process.exit(0);
});

main().catch((err) => {
  console.error("🚨 Daemon başlatılamadı:", err);
  // pm2 altında yeniden denensin diye sıfırdan farklı kodla çık.
  process.exit(1);
});
