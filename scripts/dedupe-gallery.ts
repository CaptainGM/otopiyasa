// Kayıtlı galerilerdeki tekrarları temizler: aynı fotoğrafın farklı boyut varyantları,
// benzer ilanların fotoğrafları, "noImage" yer tutucuları ve bozuk adresler.
//   npx tsx scripts/dedupe-gallery.ts           → yalnızca rapor
//   npx tsx scripts/dedupe-gallery.ts --apply   → yazar
//   --backup=<dosya>  değişen ilanların eski listesini JSONL olarak saklar (geri almak için)
// Güncelleme, fotoğraf listesi okunduğu andan beri değişmediyse yapılır; aynı anda çalışan
// bir tarayıcının yazdığı yeni galeri ezilmez.
import { createWriteStream } from "fs";
import { loadEnv } from "./load-env";

loadEnv();

async function main() {
  const apply = process.argv.includes("--apply");
  const backupPath = process.argv.find((a) => a.startsWith("--backup="))?.slice("--backup=".length);
  const backup = backupPath ? createWriteStream(backupPath, { flags: "a" }) : null;
  const { connectDB } = await import("@/lib/mongodb");
  const { Car } = await import("@/models/Car");
  const { normalizeArabamGallery } = await import("@/lib/scraper/browser-scrape");
  const { default: mongoose } = await import("mongoose");
  await connectDB();

  const cursor = Car.find({ sourceSite: "arabam", "images.1": { $exists: true } })
    .select("_id externalId images imageUrl")
    .lean<{ _id: unknown; externalId?: string; images: string[]; imageUrl?: string }>()
    .cursor({ batchSize: 500 });

  let scanned = 0;
  let changed = 0;
  let written = 0;
  let before = 0;
  let after = 0;
  let bytesSaved = 0;
  let ops: any[] = [];

  const flush = async () => {
    if (!apply || ops.length === 0) return;
    const res = await Car.bulkWrite(ops, { ordered: false, timestamps: false });
    written += res.modifiedCount || 0;
    ops = [];
  };

  for await (const doc of cursor) {
    scanned++;
    const listingId = String(doc.externalId || "").replace(/^arabam-/, "") || undefined;
    const next = normalizeArabamGallery(doc.images, listingId);
    before += doc.images.length;
    if (next.length === 0 || (next.length === doc.images.length && next.every((u, i) => u === doc.images[i]))) {
      after += doc.images.length;
      continue;
    }
    after += next.length;
    changed++;
    bytesSaved += doc.images.join("").length - next.join("").length;
    const imageUrl = doc.imageUrl && next.includes(doc.imageUrl) ? doc.imageUrl : next[0];
    backup?.write(JSON.stringify({ _id: String(doc._id), images: doc.images, imageUrl: doc.imageUrl }) + "\n");
    ops.push({
      updateOne: {
        filter: { _id: doc._id, images: doc.images },
        update: { $set: { images: next, imageUrl } },
      },
    });
    if (ops.length >= 500) await flush();
    if (scanned % 5000 === 0) console.log(`  ${scanned.toLocaleString("tr-TR")} ilan tarandı...`);
  }
  await flush();
  if (backup) await new Promise((r) => backup.end(r));

  console.log(`\nTaranan: ${scanned.toLocaleString("tr-TR")} ilan`);
  console.log(`Tekrarlı galeri: ${changed.toLocaleString("tr-TR")} ilan`);
  console.log(`Fotoğraf adresi: ${before.toLocaleString("tr-TR")} → ${after.toLocaleString("tr-TR")}`);
  console.log(`Yaklaşık kazanç: ${(bytesSaved / 1e6).toFixed(1)} MB (sıkıştırılmamış)`);
  console.log(apply ? `Yazılan: ${written.toLocaleString("tr-TR")} ilan` : "Yalnızca rapor; yazmak için --apply ekleyin.");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Galeri temizleme hatası:", err);
  process.exit(1);
});
