// Kurumsal kaynaklarda (Otokoç, Otoplus) eksik galeri / açıklama / teknik bilgiyi ilan sayfasından tamamlar.
//   npx tsx scripts/enrich-details.ts [adet] [otokoc|otoplus]
// Daemon bunu her turda küçük partilerle zaten yapar; bu betik ilk toplu tamamlama içindir.
import { loadEnv } from "./load-env";

loadEnv();

async function main() {
  const { connectDB } = await import("@/lib/mongodb");
  const { runDetailBackfill, DETAIL_SOURCES } = await import("@/lib/scraper/enrich-detail");
  const { Car } = await import("@/models/Car");
  const { default: mongoose } = await import("mongoose");

  const total = Math.max(1, Number(process.argv[2]) || 5000);
  const only = process.argv[3] as (typeof DETAIL_SOURCES)[number] | undefined;
  if (only && !DETAIL_SOURCES.includes(only)) {
    console.error(`Bilinmeyen kaynak: ${only}. Geçerli: ${DETAIL_SOURCES.join(", ")}`);
    process.exit(1);
  }

  await connectDB();
  const pending = () =>
    Car.countDocuments({
      sourceSite: only ? only : { $in: [...DETAIL_SOURCES] },
      status: "active",
      detailCheckedAt: { $exists: false },
    });
  console.log(`\n🖼️  Detayı tamamlanacak ilan: ${(await pending()).toLocaleString("tr-TR")} (en fazla ${total.toLocaleString("tr-TR")} işlenecek)\n`);

  let done = 0;
  let enriched = 0;
  let images = 0;
  let archived = 0;
  let stalled = 0;
  while (done < total) {
    const r = await runDetailBackfill(Math.min(50, total - done), { source: only, log: (m) => console.log(`   ${m}`) });
    if (r.checked === 0) break;
    done += r.checked;
    enriched += r.enriched;
    images += r.imagesAdded;
    archived += r.archived;
    // Art arda hiç ilan okunamıyorsa (engel/ağ sorunu) döngüyü sonsuza dek sürdürme.
    stalled = r.enriched === 0 && r.archived === 0 ? stalled + 1 : 0;
    if (stalled >= 3) {
      console.log("\n⛔ Art arda 3 parti hiç ilan okuyamadı; durduruldu (ağ/engel olabilir).");
      break;
    }
  }
  console.log(`\nBitti: ${done} ilan kontrol edildi, ${enriched} zenginleştirildi, +${images} fotoğraf eklendi, ${archived} satılmış ilan arşive taşındı.`);
  console.log(`Kalan: ${(await pending()).toLocaleString("tr-TR")}\n`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Detay tamamlama hatası:", err);
  process.exit(1);
});
