// Mevcut tüm ilanlara "Keşfet" akışı için rastgele sayı (rand) yazar. Güvenle tekrar çalıştırılabilir.
//   npx tsx scripts/backfill-rand.ts
import { loadEnv } from "./load-env";

loadEnv();

async function main() {
  const { connectDB } = await import("@/lib/mongodb");
  const { backfillMissingRand } = await import("@/lib/feed-rand");
  const { Car } = await import("@/models/Car");
  const { default: mongoose } = await import("mongoose");

  await connectDB();
  await Car.init(); // indeksleri (status, rand dahil) oluştur
  const before = await Car.countDocuments({ rand: { $exists: false } });
  console.log(`rand alanı eksik ilan: ${before.toLocaleString("tr-TR")}`);
  const changed = await backfillMissingRand();
  console.log(`güncellenen: ${changed.toLocaleString("tr-TR")} | kalan eksik: ${(await Car.countDocuments({ rand: { $exists: false } })).toLocaleString("tr-TR")}`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Hata:", err);
  process.exit(1);
});
