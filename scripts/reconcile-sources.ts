// Kurumsal kaynakların tam envanter senkronunu elle çalıştırır.
//   npx tsx scripts/reconcile-sources.ts            → tüm kaynaklar
//   npx tsx scripts/reconcile-sources.ts otokoc     → yalnızca Otokoç
// Normalde bunu 7/24 daemon kendi takvimiyle yapar; bu betik test/ilk kurulum içindir.
import { loadEnv } from "./load-env";

loadEnv();

async function main() {
  const { connectDB } = await import("@/lib/mongodb");
  const { reconcileSource, RECONCILE_SOURCES } = await import("@/lib/scraper/reconcile");
  const { default: mongoose } = await import("mongoose");

  const arg = (process.argv[2] || "").toLowerCase();
  const sources = arg ? RECONCILE_SOURCES.filter((s) => s === arg) : [...RECONCILE_SOURCES];
  if (sources.length === 0) {
    console.error(`Bilinmeyen kaynak: ${arg}. Geçerli: ${RECONCILE_SOURCES.join(", ")}`);
    process.exit(1);
  }

  await connectDB();
  console.log(`\n🔎 Tam envanter senkronu: ${sources.join(", ")}\n`);
  for (const source of sources) {
    const r = await reconcileSource(source, { log: (m) => console.log(m) });
    console.log(
      `   → durum=${r.status} görülen=${r.seen} yeni=${r.inserted} güncellenen=${r.updated} ` +
        `geri_açılan=${r.reactivated} arşivlenen=${r.archived} izlemede=${r.markedMissing} (${Math.round(r.durationMs / 1000)} sn)\n`
    );
  }
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Senkron hatası:", err);
  process.exit(1);
});
