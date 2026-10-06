// ============================================================================
// OtoPiyasa - Arabam Bekçisi (evdeki bilgisayarda arka planda çalışır)
// ============================================================================
// Arabam'ın ilanları Cloudflare yüzünden sunucudan değil, yalnızca Türkiye'deki ev internetinden gerçek
// bir tarayıcıyla doğrulanabiliyor. Bu betik bilgisayar açıkken sürekli çalışır: sıradaki ilanı (önce hiç
// doğrulanmamışlar, sonra en eskiler) ~10 saniyede bir kendi sayfasından kontrol eder. Canlı çıkanın "son
// kontrol" tarihi yenilenir; kaldırılmış olduğu KESİN anlaşılanlar arşive taşınır (karar kuralları ve
// güvenlik freni temizle-olu-ilanlari.bat ile aynı: verify-listing.ts + listing-lifecycle.ts).
//
// Cloudflare'a takılmamak için: ilanlar arası ~10 sn (±%25), art arda engelde 15 dk → 30 → 60 → 120 dk mola
// (bkz. arabam-pacing.ts), engel gidince kendiliğinden devam. Tek kopya çalışır (kilit dosyası).
//
//   npx tsx scripts/arabam-bekci.ts                 → sürekli çalış (Görev Zamanlayıcı bunu başlatır)
//   npx tsx scripts/arabam-bekci.ts --tek-tur        → yalnızca bir parti (varsayılan 20 ilan) kontrol edip çık
//   npx tsx scripts/arabam-bekci.ts --adet=10        → parti büyüklüğü
//   ARABAM_BEKCI_ARALIK=15 ...                       → ilanlar arası saniye (varsayılan 10)
// Günlük: logs/arabam-bekci.log
// ============================================================================
import fs from "node:fs";
import path from "node:path";
import { loadEnv } from "./load-env";

loadEnv();

const ROOT = path.resolve(__dirname, "..");
const LOG_DIR = path.join(ROOT, "logs");
const LOG_FILE = path.join(LOG_DIR, "arabam-bekci.log");
const LOCK_FILE = path.join(LOG_DIR, "arabam-bekci.lock");
const MAX_LOG_BYTES = 2 * 1024 * 1024;

const args = process.argv.slice(2);
const singleRound = args.includes("--tek-tur");
const batchSize = Math.min(Math.max(Number(args.find((a) => a.startsWith("--adet="))?.split("=")[1]) || 20, 1), 100);
const configuredGap = Number(process.env.ARABAM_BEKCI_ARALIK);

/** Yönetim ekranındaki mini konsol için son satırlar (kalp atışıyla veritabanına gider). */
const recentLines: string[] = [];

function log(message: string) {
  const line = `[${new Date().toLocaleString("tr-TR")}] ${message}`;
  recentLines.push(line);
  if (recentLines.length > 30) recentLines.shift();
  // Arka planda (Görev Zamanlayıcı) konsol yok; yalnızca günlük dosyasına yazılır.
  if (process.stdout.isTTY) console.log(line);
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    if (fs.existsSync(LOG_FILE) && fs.statSync(LOG_FILE).size > MAX_LOG_BYTES) {
      fs.renameSync(LOG_FILE, `${LOG_FILE}.1`);
    }
    fs.appendFileSync(LOG_FILE, `${line}\n`);
  } catch {
    // günlük yazılamazsa çalışmayı bozma
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

/** Aynı anda iki kopya çalışmasın: ikisi de Arabam'a istek atar ve hız sınırını katlar. */
function acquireLock(): boolean {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  try {
    const existing = JSON.parse(fs.readFileSync(LOCK_FILE, "utf8")) as { pid?: number };
    if (existing.pid && existing.pid !== process.pid && isProcessAlive(existing.pid)) return false;
  } catch {
    // kilit yok ya da bozuk: devral
  }
  fs.writeFileSync(LOCK_FILE, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
  return true;
}

function releaseLock() {
  try {
    const existing = JSON.parse(fs.readFileSync(LOCK_FILE, "utf8")) as { pid?: number };
    if (existing.pid === process.pid) fs.unlinkSync(LOCK_FILE);
  } catch {
    // zaten yok
  }
}

async function main() {
  if (!acquireLock()) {
    log("Arabam bekçisi zaten çalışıyor, bu kopya kapanıyor.");
    // 2 = başka kopya çalışıyor: başlatıcı (arabam-bekci-gizli.vbs) yeniden denemeyi bırakır.
    process.exit(2);
  }
  const { connectDB } = await import("@/lib/mongodb");
  const { Car } = await import("@/models/Car");
  const { recordWatcherBatch, recordWatcherDiscovery, updateWatcherState } = await import("@/models/HomeWatcher");
  const os = await import("node:os");

  // Yönetim ekranı için kalp atışı: durum, ne yaptığı, son satırlar. Dakikada bir ve her olayda yazılır.
  const startedAt = new Date();
  let beat: { status: "running" | "paused" | "stopped"; phase: string; gapSeconds: number; pausedUntil: Date | null } = {
    status: "running",
    phase: "Başlıyor",
    gapSeconds: 0,
    pausedUntil: null,
  };
  const heartbeat = (extra: { lastBatchAt?: Date } = {}) =>
    connectDB()
      .then(() =>
        updateWatcherState({
          host: os.hostname(),
          startedAt,
          recentLogs: recentLines,
          ...beat,
          ...extra,
        })
      )
      .catch(() => {});
  const setBeat = (status: "running" | "paused", phase: string, gapSeconds: number, pausedUntil: Date | null = null, extra: { lastBatchAt?: Date } = {}) => {
    beat = { status, phase, gapSeconds, pausedUntil };
    return heartbeat(extra);
  };
  const quit = () => {
    releaseLock();
    beat = { ...beat, status: "stopped", phase: "Kapatıldı" };
    // Çıkmadan önce "durdu" yazmayı dene (en fazla 2 sn bekle).
    Promise.race([heartbeat(), sleep(2000)]).finally(() => process.exit(0));
  };
  process.on("SIGINT", quit);
  process.on("SIGTERM", quit);
  process.on("exit", releaseLock);
  const { sweepAndCleanDeadListings, setArabamPageGap } = await import("@/lib/scraper/verify-listing");
  const { closeSharedBrowser } = await import("@/lib/scraper/browser-scrape");
  const { PACING, planNextStep } = await import("@/lib/scraper/arabam-pacing");
  const { runSitemapDiscovery } = await import("@/lib/scraper/arabam-discovery");
  const { isSitemapSyncDue, syncArabamSitemap } = await import("@/lib/scraper/arabam-sitemap");
  const { SleepMeter } = await import("@/lib/scraper/sleep-meter");
  // Bilgisayar uykuya girdiğinde geçen süre "çalışma süresi"ne yazılmasın (bkz. sleep-meter.ts).
  const sleepMeter = new SleepMeter();
  sleepMeter.start();

  const baseGap = Number.isFinite(configuredGap) && configuredGap >= 3 ? configuredGap : PACING.baseGapSeconds;
  const maxDiscoveryCreditMs = PACING.maxGapSeconds * 2_000;
  let state = { gapSeconds: baseGap, pauseMinutes: 0 };
  let rounds = 0;
  let todayChecked = 0;
  let todayArchived = 0;
  let sessionInserted = 0;
  let discoveryCreditMs = 0;
  let day = new Date().toDateString();

  log(`Arabam bekçisi başladı (parti ${batchSize} ilan, ilanlar arası ~${baseGap} sn).`);
  await setBeat("running", "Başladı", baseGap);
  // Uzun beklemelerde (engel molası, sırada ilan yok) de "yaşıyorum" sinyali gitsin.
  const timer = setInterval(() => void heartbeat(), 60 * 1000);
  timer.unref();

  for (;;) {
    try {
      await connectDB();
      if (day !== new Date().toDateString()) {
        day = new Date().toDateString();
        todayChecked = 0;
        todayArchived = 0;
      }

      // Aralık ±%25 oynar: sabit ritim bot izi bırakır.
      setArabamPageGap(state.gapSeconds * 750, state.gapSeconds * 500);
      await setBeat("running", `Doğrulanıyor (${batchSize} ilanlık parti, ilanlar arası ~${Math.round(state.gapSeconds)} sn)`, state.gapSeconds);
      const batchStarted = Date.now();
      const sleptBefore = sleepMeter.total();
      const res = await sweepAndCleanDeadListings({
        source: "arabam",
        limit: batchSize,
        concurrency: 1,
        maxDurationMs: 10 * 60 * 1000,
      });
      rounds++;
      const sleptMs = sleepMeter.total() - sleptBefore;
      const batchActiveMs = Math.max(0, Date.now() - batchStarted - sleptMs);
      if (sleptMs > 60_000) log(`  bilgisayar bu partide ~${Math.round(sleptMs / 60_000)} dk uykuda kaldı; süre çalışma süresine katılmadı.`);
      todayChecked += res.checked;
      todayArchived += res.archived;

      const blocked = res.details.filter((d) => d.status === "blocked").length;
      const plan = planNextStep(state, {
        checked: res.checked,
        blocked,
        errors: res.errors - blocked,
        paused: res.pausedSources.includes("arabam"),
      });

      if (res.checked > 0) {
        const unverified = rounds % 5 === 1
          ? await Car.countDocuments({ sourceSite: "arabam", status: "active", lastVerifiedAt: { $exists: false } }).catch(() => -1)
          : -1;
        log(
          `${res.checked} ilan: ${res.active} canlı, ${res.archived} arşive, ${res.errors} belirsiz (${blocked} engel) | ` +
            `bugün ${todayChecked} kontrol, ${todayArchived} arşiv | aralık ${plan.gapSeconds} sn` +
            (unverified >= 0 ? ` | hiç doğrulanmamış kalan: ${unverified.toLocaleString("tr-TR")}` : "")
        );
      }
      for (const b of res.breaker) log(`  güvenlik freni: ${b}`);
      if (plan.reason === "blocked-pause") log(`  Arabam engel verdi, ${plan.sleepMinutes} dk mola (ısrar edilmez).`);
      else if (plan.reason === "errors") log(`  parti çoğunlukla hata verdi (internet/tarayıcı?), ${plan.sleepMinutes} dk bekleniyor.`);
      else if (plan.reason === "idle") log(`  sırada kontrol edilecek ilan yok (hepsi yakın zamanda denendi), ${plan.sleepMinutes} dk bekleniyor.`);
      else if (plan.reason === "slow-down") log(`  engel görüldü, aralık ${plan.gapSeconds} sn'ye uzatıldı.`);

      state = { gapSeconds: plan.gapSeconds, pauseMinutes: plan.pauseMinutes };

      // Yönetim ekranı için saatlik kayıt: parti iki saate yayıldıysa orta noktasındaki saate yazılır.
      if (res.checked > 0 || plan.reason === "blocked-pause") {
        await recordWatcherBatch(
          {
            checked: res.checked,
            alive: res.active,
            archived: res.archived,
            blocked,
            uncertain: Math.max(0, res.errors - blocked),
            pauseMinutes: plan.reason === "blocked-pause" ? plan.sleepMinutes : 0,
            activeSeconds: batchActiveMs / 1000,
          },
          new Date()
        );
      }
      if (singleRound) break;

      // Ayırılan aktif süre 90/10: yeni detay sayfaları kontrol sayfalarıyla aynı kapı ve aralığı kullanır.
      // Bilgisayarın kapalı/uykuda olduğu ve Cloudflare molası verilen zaman bütçeye girmez.
      if (res.checked > 0) {
        discoveryCreditMs = Math.min(
          maxDiscoveryCreditMs,
          discoveryCreditMs + (batchActiveMs * 0.1) / 0.9
        );
      }
      const safeToDiscover = blocked === 0 && res.errors === 0 && (plan.sleepMinutes === 0 || plan.reason === "idle");
      if (safeToDiscover && discoveryCreditMs >= state.gapSeconds * 1000) {
        if (await isSitemapSyncDue()) {
          await setBeat("running", "Yeni ilan adayları için sitemap yenileniyor", state.gapSeconds);
          const sitemap = await syncArabamSitemap({ log });
          if (sitemap.status !== "ok") log(`Sitemap aday listesi yenilenemedi: ${sitemap.message}`);
        }

        let discoveredPages = 0;
        while (discoveryCreditMs >= state.gapSeconds * 1000 && discoveredPages < 3) {
          await setBeat("running", "Yeni ilan detayı güvenli aralıkla çekiliyor", state.gapSeconds);
          const discoveryStarted = Date.now();
          const found = await runSitemapDiscovery(1, { safeForWatcher: true });
          const discoveryDuration = Math.max(1, Date.now() - discoveryStarted);
          discoveryCreditMs = Math.max(0, discoveryCreditMs - discoveryDuration);

          if (found.blocked) {
            const slower = planNextStep(state, { checked: 1, blocked: 1, errors: 0, paused: false });
            state = { gapSeconds: slower.gapSeconds, pauseMinutes: slower.pauseMinutes };
            log(`${found.message} Yeni istek aralığı ${state.gapSeconds} sn oldu.`);
            await setBeat("running", "Yeni ilan çekiminde engel görüldü; hız azaltıldı", state.gapSeconds);
            break;
          }
          if (found.failed) {
            log(found.message);
            break;
          }
          if (found.picked === 0) {
            if (found.message !== "Keşif kuyruğu boş.") log(found.message);
            break;
          }

          discoveredPages += found.picked;
          sessionInserted += found.inserted;
          await recordWatcherDiscovery(found.inserted);
          log(`${found.message} | bu çalıştırmada ${sessionInserted} yeni ilan eklendi.`);
        }
      }

      // Tarayıcı günlerce açık kalınca şişer: ~2.000 sayfada bir yenilenir.
      if (rounds % 100 === 0) await closeSharedBrowser();
      if (plan.sleepMinutes > 0) {
        await closeSharedBrowser(); // molada tarayıcı boşuna bellek tutmasın
        const until = new Date(Date.now() + plan.sleepMinutes * 60 * 1000);
        const untilText = until.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
        const reasonText =
          plan.reason === "blocked-pause"
            ? `Cloudflare engel verdi: ${plan.sleepMinutes} dk mola (${untilText}'e kadar)`
            : plan.reason === "errors"
              ? `İnternet ya da tarayıcı sorunu: ${plan.sleepMinutes} dk bekleniyor (${untilText}'e kadar)`
              : `Sırada kontrol edilecek ilan yok: ${plan.sleepMinutes} dk bekleniyor (${untilText}'e kadar)`;
        await setBeat(plan.reason === "blocked-pause" ? "paused" : "running", reasonText, plan.gapSeconds, plan.reason === "blocked-pause" ? until : null, {
          lastBatchAt: new Date(),
        });
        await sleep(plan.sleepMinutes * 60 * 1000);
      } else {
        await heartbeat({ lastBatchAt: new Date() });
      }
    } catch (err) {
      log(`Beklenmeyen hata: ${err instanceof Error ? err.message : err} (5 dk sonra yeniden denenecek)`);
      if (singleRound) break;
      await closeSharedBrowser().catch(() => {});
      await sleep(5 * 60 * 1000);
    }
  }

  clearInterval(timer);
  await closeSharedBrowser();
  beat = { ...beat, status: "stopped", phase: "Tek tur bitti" };
  await heartbeat();
  const { default: mongoose } = await import("mongoose");
  await mongoose.disconnect().catch(() => {});
  releaseLock();
  log(`Tek tur bitti: ${todayChecked} ilan kontrol edildi.`);
  process.exit(0);
}

main().catch((err) => {
  log(`Kritik hata: ${err instanceof Error ? err.stack || err.message : err}`);
  releaseLock();
  process.exit(1);
});
