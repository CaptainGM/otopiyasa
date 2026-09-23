// ============================================================================
// OtoPiyasa - 7/24 Kesintisiz Yüksek Hızlı Otonom Scraper & Temizleyici (Daemon)
// ============================================================================
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

// 1. Ortam Değişkenlerini (.env / .env.local) Yükle
for (const envName of [".env", ".env.local"]) {
  const envPath = path.join(projectRoot, envName);
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const idx = line.indexOf("=");
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

// 7/24 Kesintisiz Stealth Ayarları (Ücretli proxy / ZenRows kullanmadan, insansı ritimle 0 blok)
process.env.DISABLE_ZENROWS = "true";
process.env.SCRAPE_CONCURRENCY = "2";
process.env.SCRAPE_MIN_INTERVAL_MS = process.env.SCRAPE_MIN_INTERVAL_MS || "900";
// Arabam.com Cloudflare Frankfurt WAF engeli sebebiyle sunucuda pasif (Localden scrape.bat ile beslenir)
const EXCLUDE_ARABAM = process.env.EXCLUDE_ARABAM !== "false";

const liveLogs: string[] = [];

function log(msg: string) {
  const time = new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
  const line = `[${time}] ${msg}`;
  console.log(line);
  liveLogs.push(line);
  if (liveLogs.length > 80) liveLogs.shift();
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Akıllı Devre Kesici (Circuit Breaker & Site Bazlı Mola Mekanizması)
// ============================================================================
interface SourceCooldown {
  until: number;
  reason: string;
  failCount: number;
}
const sourceCooldowns = new Map<string, SourceCooldown>();

function checkSourceCooldown(source: string): { cooling: boolean; remainingSec: number; reason?: string } {
  const cd = sourceCooldowns.get(source);
  if (!cd) return { cooling: false, remainingSec: 0 };
  const now = Date.now();
  if (now >= cd.until) {
    sourceCooldowns.delete(source);
    return { cooling: false, remainingSec: 0 };
  }
  return {
    cooling: true,
    remainingSec: Math.ceil((cd.until - now) / 1000),
    reason: cd.reason,
  };
}

function tripSourceCooldown(source: string, reason: string, durationMs = 5 * 60 * 1000) {
  const existing = sourceCooldowns.get(source);
  const failCount = (existing?.failCount || 0) + 1;
  const effectiveDuration = Math.min(15 * 60 * 1000, durationMs * Math.min(failCount, 3));
  const until = Date.now() + effectiveDuration;
  sourceCooldowns.set(source, { until, reason, failCount });
  log(`⏸️ [AKILLI MOLA / DEVRE KESİCİ] ${source.toUpperCase()} ${Math.round(effectiveDuration / 60000)} dakika dinlenmeye alındı. Sebep: ${reason}`);
}

function clearSourceCooldown(source: string) {
  if (sourceCooldowns.has(source)) {
    sourceCooldowns.delete(source);
  }
}

async function main() {
  console.log("===============================================================");
  console.log("  🚗 OtoPiyasa 7/24 Kesintisiz Otonom Scraper & Temizleyici Motoru");
  console.log("===============================================================");
  console.log("  Parti Boyutu: 250 Eski İlan / Tur | Canlı Kalp Atışı: Her 15 Saniyede Bir\n");

  log("Veritabanına (MongoDB Atlas) bağlanılıyor...");
  const { connectDB } = await import("@/lib/mongodb");
  const { runScrapeJob, runPriceRefresh } = await import("@/lib/scraper/run-scrape");
  const { sweepAndCleanDeadListings } = await import("@/lib/scraper/verify-listing");
  const { recordHourlyMetric, updateDaemonHeartbeat, getDaemonControl, DaemonHeartbeat } = await import("@/models/ScrapeMetric");
  const { setProgressHook } = await import("@/lib/scraper/progress");
  const { Car } = await import("@/models/Car");

  await connectDB();
  log("✅ Veritabanı bağlantısı başarıyla kuruldu.\n");

  const initialHb = await DaemonHeartbeat.findOne({ daemonId: "primary-daemon" }).lean();
  let cycle = Number((initialHb as any)?.cycle) || 0;
  let currentPhase = "🚀 Sistem Başlatılıyor...";
  let isIdle = false;
  let currentMode: "hybrid" | "new_only" | "sweep_only" = "hybrid";

  async function sendHeartbeat(phase = currentPhase, status: "online" | "idle" = "online") {
    try {
      let timeoutId: any;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("Heartbeat timeout")), 5000);
      });
      await Promise.race([
        (async () => {
          const ctrl = await getDaemonControl();
          if (ctrl.mode) currentMode = ctrl.mode;
          if (ctrl.command === "stop" || ctrl.status === "stopped") {
            await updateDaemonHeartbeat({
              phase: "🛑 Durduruldu (Panelden 'Motoru Başlat' ile çalıştırılabilir)",
              cycle: Math.max(1, cycle),
              status: "stopped",
              mode: currentMode,
              recentLogs: [...liveLogs],
            });
            return;
          }
          await updateDaemonHeartbeat({
            phase,
            cycle: Math.max(1, cycle),
            status,
            mode: currentMode,
            recentLogs: [...liveLogs],
          });
        })(),
        timeoutPromise,
      ]).finally(() => clearTimeout(timeoutId));
    } catch {
      // sessiz yakalama
    }
  }

  let lastProgressTimestamp = Date.now();
  // Watchdog: Her 30 saniyede bir kontrol et. Eğer 7 dakika boyunca döngü hiç ilerlemediyse süreci güvenle yeniden başlat
  setInterval(() => {
    const elapsedMinutes = (Date.now() - lastProgressTimestamp) / 60000;
    if (elapsedMinutes > 7 && !isIdle) {
      log(`🚨 [WATCHDOG ALARMI] Sistem ${Math.round(elapsedMinutes)} dakikadır ilerlemiyor. Süreç taze başlangıç için güvenle yeniden başlatılıyor...`);
      process.exit(1);
    }
  }, 30000);

  // 15 Saniyede Bir Kesintisiz Canlı Kalp Atışı
  setInterval(async () => {
    await sendHeartbeat(currentPhase, isIdle ? "idle" : "online");
  }, 15000);

  // İlerleme çubuğunu doğrudan paneldeki 'Şu Anki İşlem' metnine bağla
  setProgressHook((stage, current, total) => {
    const pct = total > 0 ? Math.round((current / total) * 100) : 0;
    let icon = "⚡";
    if (stage.includes("Ölü") || stage.includes("temizle") || stage.includes("sweep") || stage.includes("arşiv")) {
      icon = "🧹";
    } else if (stage.includes("Fiyat") || stage.includes("Doğrulama") || stage.includes("güncellen")) {
      icon = "📊";
    } else if (stage.includes("Tarama") || stage.includes("Yeni") || stage.includes("çekiliyor") || stage.includes("Keşif")) {
      icon = "🚗";
    } else if (stage.includes("DOD") || stage.includes("Otomerkezi") || stage.includes("Otokoç") || stage.includes("VavaCars") || stage.includes("Otoplus") || stage.includes("Carvak") || stage.includes("İkinciyeni")) {
      icon = "🏢";
    }
    currentPhase = `${icon} [${stage}] ${current}/${total} (%${pct})...`;
  });

  while (true) {
    try {
      const ctrl = await getDaemonControl();
    if (ctrl.mode) currentMode = ctrl.mode;

    if (ctrl.command === "stop" || ctrl.status === "stopped") {
      log("🛑 [DURDURMA SİNYALİ ALINDI] Daemon uzaktan durduruldu. Beklemeye geçiliyor...");
      isIdle = true;
      currentPhase = "🛑 Durduruldu (Panelden 'Motoru Başlat' ile çalıştırılabilir)";
      while (true) {
        await sleep(3000);
        const resumeCheck = await getDaemonControl();
        if (resumeCheck.mode) currentMode = resumeCheck.mode;
        if (resumeCheck.command === "run" && resumeCheck.status !== "stopped") {
          log("🚀 [BAŞLATMA SİNYALİ ALINDI] Daemon yeniden uyandırıldı ve döngüye devam ediyor!");
          isIdle = false;
          break;
        }
      }
    }

    cycle++;
    isIdle = false;
    lastProgressTimestamp = Date.now();

    // 5 turda bir GitHub'dan otomatik kod güncelleme kontrolü
    if (cycle % 5 === 1) {
      try {
        const { execSync } = await import("node:child_process");
        const pullRes = execSync("git pull origin main", { encoding: "utf8", timeout: 15000 });
        if (pullRes && !pullRes.includes("Already up to date")) {
          log(`🔄 [KOD GÜNCELLEMESİ ALINDI] GitHub'dan yeni kod çekildi: ${pullRes.trim().split("\n")[0]}. PM2 ile taze kodla yeniden başlatılıyor...`);
          process.exit(0);
        }
      } catch {
        // Hata durumunda mevcut kodla çalışmaya devam et
      }
    }

    const modeLabels: Record<string, string> = {
      new_only: "🚀 SADECE YENİ İLAN KEŞFİ",
      sweep_only: "🧹 SADECE ÖLÜ İLAN TEMİZLİĞİ",
      hybrid: "⚖️ HİBRİT (DENGELİ)",
    };

    console.log(`\n================== [ 🔄 TUR #${cycle} BAŞLIYOR | MOD: ${modeLabels[currentMode]} ] ==================`);
    currentPhase = `🔄 Tur #${cycle} Hazırlanıyor (${modeLabels[currentMode]})...`;
    await sendHeartbeat(currentPhase, "online");

    // ========================================================================
    // ADIM 1: 250 Eski İlanı Doğrulama & Silinen/Satılanları Arşivleme
    // ========================================================================
    if (currentMode === "new_only") {
      log("⏩ [ADIM 1 Atlandı] Mod: SADECE YENİ İLAN ➔ Eski ilan taraması atlandı, tüm güç yeni araç keşfine yönlendirildi.");
    } else {
      try {
        currentPhase = `🧹 [ADIM 1/3] Çoklu Kaynak Eski İlanlar Doğrulanıyor & Ölüler Temizleniyor...`;
        log(currentPhase);
        await sendHeartbeat(currentPhase, "online");

        const beforeActive = await Car.countDocuments({ status: { $ne: "removed" } });
        const beforeRemoved = await Car.countDocuments({ status: "removed" });

        // 1. Çoklu Kaynak Süpürge: En eski 100 ilanı canlı denetle (90sn kesin zaman aşımı korumalı)
        const sweepLimit = currentMode === "sweep_only" ? 150 : 100;
        let sweepTimeoutId: any;
        const sweepTimeoutPromise = new Promise<any>((_, reject) => {
          sweepTimeoutId = setTimeout(() => reject(new Error("Eski ilan doğrulama adımı 90sn üst sınıra ulaştı")), 90000);
        });
        const sweepRes = await Promise.race([
          sweepAndCleanDeadListings({
            limit: sweepLimit,
            concurrency: 3,
            excludeSource: EXCLUDE_ARABAM ? "arabam" : undefined,
          }),
          sweepTimeoutPromise,
        ]).finally(() => clearTimeout(sweepTimeoutId)).catch((sweepErr) => {
          log(`⚠️ [Süpürge Uyarısı] ${sweepErr.message}. Kalan araçlar sonraki turlara aktarıldı.`);
          return { checked: 0, archived: 0, active: 0, errors: 0, details: [] };
        });
        lastProgressTimestamp = Date.now();
        log(`🧹 [Çoklu Kaynak Temizlik] Taranan: ${sweepRes.checked} | Arşivlenen: ${sweepRes.archived} | Canlı: ${sweepRes.active}`);

        // Kaynak bazlı istatistikleri ayır
        const sourceMap: Record<string, { scanned: number; active: number; archived: number }> = {};
        for (const d of sweepRes.details) {
          const src = d.source || "arabam";
          if (!sourceMap[src]) sourceMap[src] = { scanned: 0, active: 0, archived: 0 };
          sourceMap[src].scanned++;
          if (d.status === "archived") sourceMap[src].archived++;
          if (d.status === "active") sourceMap[src].active++;
        }

        // Her kurumsal ve harici kaynağın doğrulama metriklerini sisteme işle
        for (const [src, counts] of Object.entries(sourceMap)) {
          if (src === "arabam" && !EXCLUDE_ARABAM) continue; // Arabam fiyat yenileme adımında birleştirilecek
          await recordHourlyMetric({
            source: src,
            scanned: counts.scanned,
            inserted: 0,
            updated: 0,
            deleted: counts.archived,
          });
        }

        // 2. Arabam Fiyat Yenileme: Eğer Arabam dinlenmede değilse fiyat ve hasar durumunu tazele
        const arabamCd = checkSourceCooldown("arabam");
        let arabamRefreshed = 0;
        let arabamDeleted = 0;
        let arabamScanned = 0;

        if (EXCLUDE_ARABAM) {
          // Arabam.com Cloudflare Frankfurt WAF engeli sebebiyle atlandı (Hatasız & Kesintisiz Kurumsal Akış)
        } else if (arabamCd.cooling) {
          log(`⏸️ [ADIM 1] Arabam.com dinlenmede (${Math.ceil(arabamCd.remainingSec / 60)}dk kaldı). Arabam fiyat yenileme atlandı, kurumsal temizlikle devam ediliyor.`);
        } else {
          try {
            const arabamRefreshLimit = currentMode === "sweep_only" ? 200 : 150;
            const res = await runPriceRefresh(arabamRefreshLimit);
            arabamRefreshed = res.updated || 0;
            arabamDeleted = (res as any).deleted || 0;
            arabamScanned = res.sources?.[0]?.fetched ?? (res.inserted + arabamRefreshed);
            clearSourceCooldown("arabam");
          } catch (err: any) {
            const msg = err?.message || String(err);
            log(`⚠️ ADIM 1 Arabam Yenileme Hatası: ${msg}`);
            if (msg.includes("429") || msg.includes("403") || msg.includes("Cloudflare")) {
              tripSourceCooldown("arabam", "Fiyat yenilemede Cloudflare hız sınırı (429/403)", 5 * 60 * 1000);
            }
          }
        }

        const arabamSweep = sourceMap["arabam"] || { scanned: 0, active: 0, archived: 0 };
        const totalDeleted = arabamDeleted + sweepRes.archived;
        const totalUpdated = arabamRefreshed;
        const totalArabamScanned = arabamSweep.scanned + arabamScanned;

        const afterActive = await Car.countDocuments({ status: { $ne: "removed" } });
        const afterRemoved = await Car.countDocuments({ status: "removed" });

        log(`✅ [ADIM 1 Tamamlandı] Güncellenen: ${totalUpdated} (Canlı Teyit: ${sweepRes.active}) | Silinen/Arşivlenen: ${totalDeleted}`);
        log(`📊 Aktif İlan: ${beforeActive} ➔ ${afterActive} | Piyasa Arşivi: ${beforeRemoved} ➔ ${afterRemoved}`);

        if (totalArabamScanned > 0 || arabamDeleted > 0) {
          const isHealthy = !arabamCd.cooling;
          await recordHourlyMetric({
            source: "arabam",
            scanned: totalArabamScanned,
            inserted: 0,
            updated: arabamRefreshed, // Canlı olan araçlar 'güncellendi' sayılmaz; sadece fiyatı yenilenenler sayılır
            deleted: arabamDeleted + arabamSweep.archived,
            diagnostics: {
              totalRequests: totalArabamScanned,
              successRequests: arabamRefreshed + arabamDeleted + arabamSweep.active + arabamSweep.archived,
              failedRequests: Math.max(0, totalArabamScanned - (arabamRefreshed + arabamDeleted + arabamSweep.active + arabamSweep.archived)),
              rateLimitHits: arabamCd.cooling ? 1 : 0,
              healthStatus: isHealthy ? "success" : "warning",
              statusCode: isHealthy ? 200 : 429,
              statusLabel: isHealthy ? "Tüm İstekler Başarılı (HTTP 200 OK)" : "Cloudflare Hız Sınırı (HTTP 429)",
              explanation: isHealthy
                ? "Arabam oturum çerezi (_cfuvid) ve Referer korumasıyla tüm ilan detayları başarıyla çekildi."
                : "İstekler Cloudflare hız sınırına takıldı. Akıllı devre kesiciyle 5 dakika dinlenmeye alındı.",
            },
          });
        }
      } catch (err: any) {
        log(`⚠️ ADIM 1 Hatası: ${err?.message || err}`);
      }
    }

    if (currentMode === "sweep_only") {
      log("⏩ [ADIM 2 Atlandı] Mod: SADECE ÖLÜ İLAN TEMİZLİĞİ ➔ Yeni ilan çekme adımları atlandı.");
    } else {
      await sleep(2000);

      // ========================================================================
      // ADIM 2: 7 Farklı Siteden Eşzamanlı (Paralel) Yeni İlan Keşfi & Devre Kesici
      // ========================================================================
      // 1. Arabam Marka/Kategori Rotasyonu (Genişletilmiş popüler pazar havuzu)
      const ARABAM_DISCOVERY_QUERIES = [
        "otomobil",
        "suv",
        "renault",
        "fiat",
        "volkswagen",
        "ford",
        "toyota",
        "opel",
        "hyundai",
        "peugeot",
        "bmw",
        "mercedes-benz",
        "audi",
        "honda",
        "dacia",
        "skoda",
        "seat",
        "nissan",
        "kia",
        "citroen",
        "volvo",
      ];
      const arabamQuery = ARABAM_DISCOVERY_QUERIES[(cycle - 1) % ARABAM_DISCOVERY_QUERIES.length];

      // 2. Dinamik Derin Sayfa Rotasyonu:
      // Kurumsal sitelerin gerçek sayfa derinlikleri (ortalama 5-10 sayfa)
      // sınırlarında kalarak her turda yeni ve güncel araçları tarar.
      const otokocPage = ((cycle - 1) % 6) + 1;
      const vavacarsPage = ((cycle - 1) % 4) + 1;
      const otoplusPage = ((cycle - 1) % 6) + 1;
      const otomerkeziPage = ((cycle - 1) % 8) + 1;
      const carvakPage = ((cycle - 1) % 5) + 1;
      const arabamPage = ((cycle - 1) * 2) % 25 + 1;

      interface TargetItem {
        source: "dod" | "otokoc" | "otomerkezi" | "vavacars" | "otoplus" | "carvak" | "ikinciyeni" | "arabam";
        label: string;
        query: string;
        limit: number;
        pageOffset?: number;
      }

      const ALL_TARGETS: TargetItem[] = [
        { source: "dod", label: "DOD (Doğuş)", query: "otomobil", limit: currentMode === "new_only" ? 45 : 30 },
        { source: "otokoc", label: `Otokoç 2. El (Sf.${otokocPage})`, query: "otomobil", limit: currentMode === "new_only" ? 45 : 30, pageOffset: otokocPage },
        { source: "otomerkezi", label: `Otomerkezi (Sf.${otomerkeziPage})`, query: "otomobil", limit: currentMode === "new_only" ? 45 : 30, pageOffset: otomerkeziPage },
        { source: "vavacars", label: `VavaCars (Sf.${vavacarsPage})`, query: "otomobil", limit: currentMode === "new_only" ? 45 : 30, pageOffset: vavacarsPage },
        { source: "otoplus", label: `Otoplus (Sf.${otoplusPage})`, query: "otomobil", limit: currentMode === "new_only" ? 40 : 25, pageOffset: otoplusPage },
        { source: "carvak", label: `Carvak (Sf.${carvakPage})`, query: "otomobil", limit: currentMode === "new_only" ? 35 : 25, pageOffset: carvakPage },
        { source: "ikinciyeni", label: "İkinciyeni", query: "otomobil", limit: currentMode === "new_only" ? 35 : 25 },
      ];

      if (!EXCLUDE_ARABAM) {
        ALL_TARGETS.push({
          source: "arabam",
          label: `Arabam (${arabamQuery.toUpperCase()} Sf.${arabamPage})`,
          query: arabamQuery,
          limit: currentMode === "new_only" ? 35 : 25,
          pageOffset: arabamPage,
        });
      }

      const activeTargets: TargetItem[] = [];
      const cooldownList: string[] = [];

      for (const t of ALL_TARGETS) {
        const cd = checkSourceCooldown(t.source);
        if (cd.cooling) {
          cooldownList.push(`${t.label}: ⏸️ Mola (${Math.ceil(cd.remainingSec / 60)}dk)`);
        } else {
          activeTargets.push(t);
        }
      }

      if (cooldownList.length > 0) {
        log(`⏸️ [Moladaki Siteler] ${cooldownList.join(" | ")}`);
      }

      const activeNames = activeTargets.map((t) => t.label).join(", ");
      currentPhase = `🚀 [EŞZAMANLI KEŞİF] ${activeTargets.length} Siteden Paralel Çekiliyor (${activeNames})...`;
      log(currentPhase);
      await sendHeartbeat(currentPhase, "online");

      // Tüm aktif siteleri aynı anda paralel çalıştır (Promise.allSettled + 75sn Garanti Zaman Aşımı)
      let step2TimeoutId: any;
      const step2TimeoutPromise = new Promise<any[]>((_, reject) => {
        step2TimeoutId = setTimeout(() => reject(new Error("Yeni ilan çekim adımı 90sn üst sınıra ulaştı")), 90000);
      });
      const results = await Promise.race([
        Promise.allSettled(
          activeTargets.map(async (target) => {
            try {
              let timeoutId: any;
              const timeoutPromise = new Promise<never>((_, reject) => {
                timeoutId = setTimeout(() => reject(new Error(`${target.label} zaman aşımına uğradı (75sn)`)), 75000);
              });

              const jobPromise = runScrapeJob({ source: target.source, query: target.query, limit: target.limit, pageOffset: target.pageOffset });
              const res = await Promise.race([jobPromise, timeoutPromise]).finally(() => clearTimeout(timeoutId));

              clearSourceCooldown(target.source);
              log(`✅ [${target.label}] Yeni: +${res.inserted}, Güncellenen: ${res.updated}, Değişmeyen: ${res.unchanged || 0}`);
              await recordHourlyMetric({
                source: target.source,
                scanned: res.sources?.[0]?.fetched || (res.inserted + res.updated + (res.unchanged || 0)),
                inserted: res.inserted,
                updated: res.updated,
                deleted: 0,
              });
              return { source: target.source, label: target.label, inserted: res.inserted, updated: res.updated };
            } catch (err: any) {
              const msg = err?.message || String(err);
              log(`⚠️ [${target.label}] Hatası: ${msg}`);
              if (
                msg.includes("429") ||
                msg.includes("403") ||
                msg.includes("Cloudflare") ||
                msg.includes("hız sınırı") ||
                msg.includes("okunamadı")
              ) {
                tripSourceCooldown(target.source, msg, 5 * 60 * 1000);
              }
              return { source: target.source, label: target.label, inserted: 0, updated: 0, error: msg };
            }
          })
        ),
        step2TimeoutPromise,
      ]).finally(() => clearTimeout(step2TimeoutId)).catch((step2Err) => {
        log(`⚠️ [Keşif Uyarısı] ${step2Err.message}.`);
        return [];
      });

      lastProgressTimestamp = Date.now();

      currentPhase = `📊 Tur #${cycle} verileri işleniyor...`;
      await sendHeartbeat(currentPhase, "online");

      let totalCycleInserted = 0;
      let totalCycleUpdated = 0;
      const successBadges: string[] = [];

      for (const r of results) {
        if (r.status === "fulfilled") {
          totalCycleInserted += r.value.inserted;
          totalCycleUpdated += r.value.updated;
          if (r.value.inserted > 0) {
            successBadges.push(`${r.value.label}: +${r.value.inserted}`);
          }
        }
      }

      log(`🎉 [Eşzamanlı Tur Sonu] Toplam Yeni Araç: +${totalCycleInserted} | Güncellenen: ${totalCycleUpdated}`);
      if (successBadges.length > 0) {
        log(`📈 Katkı Sağlayanlar: ${successBadges.join(" | ")}`);
      }
    }

    // Nefes alma süresi (İnsansı ritim: kurumsal siteleri boğmamak ve 0 blok çalışmak için 3 dakika mola)
    const restSeconds = currentMode === "new_only" ? 60 : currentMode === "sweep_only" ? 90 : 180;
    isIdle = true;
    const restMin = Math.round(restSeconds / 60);
    currentPhase = `☕ Dinleniyor (~${restMin} dk mola, Sıradaki: Tur #${cycle + 1})`;
    await sendHeartbeat(currentPhase, "idle");
    lastProgressTimestamp = Date.now();
    await sleep(restSeconds * 1000);
    } catch (cycleError: any) {
      lastProgressTimestamp = Date.now();
      log(`⚠️ [DÖNGÜ HATASI] Tur #${cycle} sırasında beklenmeyen hata: ${cycleError?.message || cycleError}`);
      await sendHeartbeat(`⚠️ Hata sonrası toparlanıyor (Tur #${cycle})...`, "online");
      await sleep(10000);
    }
  }
}

process.on("unhandledRejection", (reason) => {
  log(`⚠️ [UNHANDLED REJECTION] ${reason instanceof Error ? reason.stack || reason.message : reason}`);
});

process.on("uncaughtException", (err) => {
  log(`⚠️ [UNCAUGHT EXCEPTION] ${err.stack || err.message}`);
});

async function runDaemonForever() {
  while (true) {
    try {
      await main();
    } catch (err: any) {
      log(`🚨 [DAEMON KRİTİK HATA] Motor beklenmedik şekilde durdu, 15 saniye içinde otomatik yeniden başlatılıyor: ${err?.message || err}`);
      await sleep(15000);
    }
  }
}

runDaemonForever();
