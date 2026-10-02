// ============================================================================
// OtoPiyasa - Ölü İlan Temizleme (temizle-olu-ilanlari.bat)
// ============================================================================
// Eski sürüm Arabam'da Cloudflare engel sayfasını ve belirsiz 200 yanıtlarını
// "ilan kaldırılmış" sayıyordu; 29.09'daki toplu çalıştırmada canlı ilanlar da
// arşive taşındı (örneklemde arşivde olup yayında görünenlerin tamamı canlıydı).
// Artık tüm kararlar ortak doğrulama motorundan geçer (verify-listing.ts +
// listing-lifecycle.ts): yalnızca kesin kanıt arşive taşır, belirsiz yanıta
// dokunulmaz, bir partide ölü oranı anormal yüksekse arşivleme durur.
// ============================================================================
import readline from "node:readline";
import { loadEnv } from "./load-env";

loadEnv();

const c = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
};

type Choice = { mode: "batch" | "loop" | "reconcile"; limit: number; source: string };

async function promptMenu(): Promise<Choice> {
  const presets: Record<string, Choice> = {
    "1": { mode: "batch", limit: 50, source: "all" },
    "2": { mode: "batch", limit: 250, source: "all" },
    "3": { mode: "loop", limit: 100, source: "all" },
    "4": { mode: "batch", limit: 100, source: "arabam" },
    "5": { mode: "batch", limit: 100, source: "kurumsal" },
    "6": { mode: "reconcile", limit: 0, source: "kurumsal" },
    "50": { mode: "batch", limit: 50, source: "all" },
    "250": { mode: "batch", limit: 250, source: "all" },
    loop: { mode: "loop", limit: 100, source: "all" },
    arabam: { mode: "batch", limit: 100, source: "arabam" },
    kurumsal: { mode: "batch", limit: 100, source: "kurumsal" },
    envanter: { mode: "reconcile", limit: 0, source: "kurumsal" },
  };
  const arg = process.argv[2];
  if (arg && presets[arg]) return presets[arg];

  console.log(`\n${c.bright}${c.cyan}====================================================================${c.reset}`);
  console.log(`${c.bright}          🧹 OTOPIYASA - ÖLÜ İLAN TEMİZLEME${c.reset}`);
  console.log(`${c.cyan}====================================================================${c.reset}`);
  console.log(`  ${c.yellow}1${c.reset} - En uzun süredir doğrulanmayan 50 ilan`);
  console.log(`  ${c.yellow}2${c.reset} - En uzun süredir doğrulanmayan 250 ilan`);
  console.log(`  ${c.yellow}3${c.reset} - SÜREKLİ (sıra bitene ya da Ctrl+C'ye kadar)`);
  console.log(`  ${c.yellow}4${c.reset} - Yalnızca Arabam (100 ilan, gerçek tarayıcıyla)`);
  console.log(`  ${c.yellow}5${c.reset} - Yalnızca kurumsal siteler (100 ilan, ilan sayfasından)`);
  console.log(`  ${c.yellow}6${c.reset} - Kurumsal sitelerin TÜM envanterini senkronla ${c.dim}(önerilen)${c.reset}`);
  console.log(`${c.cyan}====================================================================${c.reset}`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`\nSeçiminiz (1-6, varsayılan 6): `, (ans) => {
      rl.close();
      resolve(presets[ans.trim()] || presets["6"]);
    });
  });
}

async function main() {
  const choice = await promptMenu();
  const { connectDB } = await import("@/lib/mongodb");
  const { sweepAndCleanDeadListings } = await import("@/lib/scraper/verify-listing");
  const { reconcileSource, RECONCILE_SOURCES } = await import("@/lib/scraper/reconcile");
  const { ManualScrapeLog } = await import("@/models/ManualScrapeLog");
  const { default: mongoose } = await import("mongoose");

  console.log(`\n${c.cyan}Veritabanına bağlanılıyor...${c.reset}`);
  await connectDB();
  const started = Date.now();

  if (choice.mode === "reconcile") {
    let archived = 0;
    let reactivated = 0;
    let seen = 0;
    for (const source of RECONCILE_SOURCES) {
      const r = await reconcileSource(source, { log: (m) => console.log(m) });
      archived += r.archived;
      reactivated += r.reactivated;
      seen += r.seen;
    }
    await ManualScrapeLog.create({
      actor: "Terminal (temizle-olu-ilanlari.bat)",
      source: "kurumsal",
      label: "Kurumsal Tam Envanter Senkronu",
      scanned: seen,
      inserted: 0,
      updated: reactivated,
      deleted: archived,
      durationSeconds: Math.round((Date.now() - started) / 1000),
      status: "success",
      message: `${seen} ilan kaynakta görüldü, ${archived} arşive taşındı, ${reactivated} arşivden geri alındı.`,
    }).catch(() => {});
    await mongoose.disconnect();
    process.exit(0);
  }

  const source = choice.source === "kurumsal" ? undefined : choice.source;
  const excludeSource = choice.source === "kurumsal" ? "arabam" : undefined;
  let round = 0;
  let totals = { checked: 0, archived: 0, active: 0, errors: 0 };
  // Art arda engel yiyen kaynak bu çalıştırmada bırakılır: engel varken denemeye devam etmek engeli uzatır.
  const paused = new Set<string>();

  do {
    round++;
    console.log(`\n${c.bright}---------------- [ TUR #${round} ] ----------------${c.reset}`);
    const res = await sweepAndCleanDeadListings({
      limit: choice.limit,
      source,
      excludeSource,
      excludeSources: [...paused],
      concurrency: choice.source === "arabam" ? 1 : 3,
      maxDurationMs: 30 * 60 * 1000,
      onProgress: (done, total, archived) => process.stdout.write(`\r   ${done}/${total} kontrol edildi, ${archived} kaldırılmış`),
    });
    process.stdout.write("\n");
    for (const d of res.details) {
      const color = d.status === "archived" ? c.red : d.status === "active" ? c.green : c.yellow;
      console.log(`   ${c.dim}${d.source.padEnd(10)}${c.reset} ${d.title.slice(0, 40).padEnd(40)} ${color}${d.status.toUpperCase()}${c.reset} ${c.dim}${d.reason}${c.reset}`);
    }
    for (const b of res.breaker) console.log(`   ${c.yellow}⛔ Güvenlik freni: ${b}${c.reset}`);
    for (const s of res.pausedSources) paused.add(s);
    totals = {
      checked: totals.checked + res.checked,
      archived: totals.archived + res.archived,
      active: totals.active + res.active,
      errors: totals.errors + res.errors,
    };
    if (res.checked === 0) {
      console.log(
        paused.size > 0
          ? `\n${c.yellow}Kalan ilanlar engellenen kaynaklardan (${[...paused].join(", ")}). Yaklaşık 30 dakika bekleyip tekrar çalıştır.${c.reset}`
          : `\n${c.green}Sırada kontrol edilecek ilan kalmadı.${c.reset}`
      );
      break;
    }
    if (choice.mode === "loop") await new Promise((r) => setTimeout(r, 3000));
  } while (choice.mode === "loop");

  await ManualScrapeLog.create({
    actor: "Terminal (temizle-olu-ilanlari.bat)",
    source: choice.source,
    label: "Ölü İlan Temizliği",
    scanned: totals.checked,
    inserted: 0,
    updated: totals.active,
    deleted: totals.archived,
    durationSeconds: Math.round((Date.now() - started) / 1000),
    status: "success",
    message: `${totals.checked} ilan kontrol edildi: ${totals.archived} arşive taşındı, ${totals.active} canlı doğrulandı, ${totals.errors} belirsiz (dokunulmadı).`,
  }).catch(() => {});

  console.log(`\n${c.cyan}====================================================================${c.reset}`);
  console.log(`  Kontrol edilen: ${totals.checked} | ${c.red}Arşive taşınan: ${totals.archived}${c.reset} | ${c.green}Canlı: ${totals.active}${c.reset} | Belirsiz: ${totals.errors}`);
  console.log(`${c.cyan}====================================================================${c.reset}\n`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Kritik hata:", err);
  process.exit(1);
});
