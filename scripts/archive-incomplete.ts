// Galerisi tamamlanamayan kurumsal ilanları (Carvak, DOD, Otomerkezi) arşive taşır. Silmez:
// fiyat geçmişi piyasa ortalaması için kalır; envanter senkronu da bunları geri açmaz.
//   npx tsx scripts/archive-incomplete.ts           → yalnızca rapor
//   npx tsx scripts/archive-incomplete.ts --apply   → arşive taşır
// Eksik detay taraması (scrape.bat D) sonunda bunu zaten yapar; bu betik tek başına çalıştırmak içindir.
import { loadEnv } from "./load-env";

loadEnv();

async function main() {
  const apply = process.argv.includes("--apply");
  const { connectDB } = await import("@/lib/mongodb");
  const { archiveIncompleteGalleries } = await import("@/lib/scraper/listing-quality");
  const { default: mongoose } = await import("mongoose");
  await connectDB();

  const report = await archiveIncompleteGalleries({ apply });
  for (const [source, n] of Object.entries(report.bySource)) console.log(`  ${source.padEnd(12)} ${n.toLocaleString("tr-TR")} ilan`);
  console.log(
    apply
      ? `\nArşive taşınan: ${report.archived.toLocaleString("tr-TR")} / ${report.total.toLocaleString("tr-TR")} ilan.`
      : `\nToplam: ${report.total.toLocaleString("tr-TR")} ilan (arşive taşımak için --apply).`
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Eksik ilan arşivleme hatası:", err);
  process.exit(1);
});
