// Arabam sitemap senkronunu elle çalıştırır (daemon bunu günde bir kez yapar).
//   npx tsx scripts/arabam-sitemap.ts
// Arşiv kararı VERMEZ; yalnızca detay taraması için öncelik işaretleri koyar.
import { loadEnv } from "./load-env";

loadEnv();

async function main() {
  const { connectDB } = await import("@/lib/mongodb");
  const { syncArabamSitemap } = await import("@/lib/scraper/arabam-sitemap");
  const { default: mongoose } = await import("mongoose");

  await connectDB();
  console.log("\n🗺️  Arabam sitemap senkronu başlıyor (32 dosya, ~2-3 dk)...\n");
  const r = await syncArabamSitemap({ log: (m) => console.log(m) });
  console.log(`\nSonuç: ${r.status} (${Math.round(r.durationMs / 1000)} sn)\n`);
  await mongoose.disconnect();
  process.exit(r.status === "ok" ? 0 : 1);
}

main().catch((err) => {
  console.error("Sitemap senkron hatası:", err);
  process.exit(1);
});
