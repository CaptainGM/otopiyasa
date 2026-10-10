// RESMÎ TÜKETİM TAMAMLAMA: tüketimi boş ilanları, aynı marka + model + motor + yakıt grubundaki
// resmî değerlerin medyanıyla doldurur (bkz. src/lib/scraper/backfill-consumption.ts).
//
// Kaynakların bir kısmı "Ort. Yakıt Tüketimi" alanını hiç yayınlamıyor (Otokoç, Otomerkezi,
// Otoplus, VavaCars). Bu betik o ilanlar için yakıt maliyeti kartını tahmin yerine resmî değere
// çevirir; yazılan sayı aynı aracın başka ilanlarındaki KAYNAK değerlerinin medyanıdır.
//
// Varsayılan DENEME modudur (hiçbir şey yazmaz). Yazmak için --apply.
//
//   npx tsx scripts/backfill-consumption.ts                 (deneme, 400 grup)
//   npx tsx scripts/backfill-consumption.ts --apply          (yaz, 400 grup)
//   npx tsx scripts/backfill-consumption.ts --apply 2000     (yaz, 2000 grup)
import mongoose from "mongoose";
import { loadEnv } from "./load-env";
import { backfillConsumption } from "@/lib/scraper/backfill-consumption";

loadEnv(process.cwd());

async function main() {
  const apply = process.argv.includes("--apply");
  const limitArg = process.argv.find((a) => /^\d+$/.test(a));
  const limit = limitArg ? Number(limitArg) : 400;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI tanımlı değil.");
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });

  console.log(`\n📊 RESMÎ TÜKETİM TAMAMLAMA ${apply ? "(YAZILIYOR)" : "(deneme — hiçbir şey yazılmaz)"}\n`);
  const started = Date.now();
  const result = await backfillConsumption({
    limit,
    dryRun: !apply,
    log: (msg) => console.log(`   ${msg}`),
  });

  console.log(
    `\n   baktığı grup: ${result.groups.toLocaleString("tr-TR")} | ` +
      `doldurulabilir kombinasyon: ${result.filled.toLocaleString("tr-TR")} | ` +
      `etkilenecek ilan: ${result.fillable.toLocaleString("tr-TR")}` +
      (apply ? ` | güncellenen: ${result.updated.toLocaleString("tr-TR")}` : "")
  );
  console.log(`   süre: ${((Date.now() - started) / 1000).toFixed(1)} sn`);
  if (!apply) console.log(`\n   Yazmak için: npx tsx scripts/backfill-consumption.ts --apply ${limit}\n`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Tüketim tamamlama hatası:", err);
  process.exit(1);
});
