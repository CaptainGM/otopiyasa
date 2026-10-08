// Sitemap'ten gelen yeni ilan adaylarının detayını okur (ev IP'si gerekir).
//   npx tsx scripts/arabam-discover.ts [adet]      (varsayılan 200)
// Kuyruğu `npm run arabam-sitemap` (ya da 7/24 motor, günde bir) doldurur.
import { loadEnv } from "./load-env";
import { pauseWatcher } from "./bekci-pause.mjs";

loadEnv();
// Ev bilgisayarında Arabam bekçisi çalışırken aynı internetten ikinci bir istek akışı açılmasın.
pauseWatcher("yeni ilan keşfi");

async function main() {
  const { connectDB } = await import("@/lib/mongodb");
  const { runSitemapDiscovery } = await import("@/lib/scraper/arabam-discovery");
  const { DiscoveryCandidate } = await import("@/models/DiscoveryCandidate");
  const { syncArabamSitemap } = await import("@/lib/scraper/arabam-sitemap");
  const { default: mongoose } = await import("mongoose");

  const total = Math.max(1, Number(process.argv[2]) || 200);
  await connectDB();

  let queued = await DiscoveryCandidate.countDocuments({ source: "arabam" });
  if (queued === 0) {
    console.log("\n🗺️  Kuyruk boş: önce sitemap okunuyor (~2-3 dk)...\n");
    await syncArabamSitemap({ log: (m) => console.log(m) });
    queued = await DiscoveryCandidate.countDocuments({ source: "arabam" });
  }
  console.log(`\n🆕 Yeni ilan adayı (kuyruk): ${queued.toLocaleString("tr-TR")} | bu çalıştırmada en fazla ${total} işlenecek\n`);

  let done = 0;
  let inserted = 0;
  let idle = 0;
  while (done < total) {
    const r = await runSitemapDiscovery(Math.min(25, total - done));
    if (r.picked === 0) break;
    done += r.picked;
    inserted += r.inserted;
    console.log(`   ${r.message}`);
    idle = r.inserted === 0 ? idle + 1 : 0;
    if (idle >= 4) {
      console.log("\n⛔ Art arda 4 parti hiç yeni ilan getirmedi (engel ya da araç olmayan ilanlar); durduruldu.");
      break;
    }
  }
  console.log(`\nBitti: ${done} aday okundu, ${inserted} yeni ilan eklendi.\n`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Keşif hatası:", err);
  process.exit(1);
});
