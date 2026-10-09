// Kaynağın marka / model kataloğunu yeniler (kategori + marka sayfaları, ~170 istek, 15-25 dk) ve ayrı model listesini üretir.
//   npx tsx scripts/model-catalog.ts [--zorla]      (--zorla: 14 günden yeni kayıtlar da yenilenir)
// Ev bilgisayarı gerekir (Cloudflare). Çalışırken Arabam bekçisi beklemeye alınır.
import { loadEnv } from "./load-env";
import { pauseWatcher } from "./bekci-pause.mjs";

loadEnv();
pauseWatcher("marka/model kataloğu");

async function main() {
  const { connectDB } = await import("@/lib/mongodb");
  const { refreshArabamCatalog } = await import("@/lib/scraper/arabam-catalog");
  const { setArabamPageGap } = await import("@/lib/scraper/verify-listing");
  const { default: mongoose } = await import("mongoose");

  await connectDB();
  setArabamPageGap(4000, 2500);
  const force = process.argv.includes("--zorla");
  console.log("\n📚 Marka/model kataloğu okunuyor (kaynağın kendi model listesi)...\n");
  const result = await refreshArabamCatalog({ maxAgeDays: force ? 0 : 14, log: (m) => console.log(m) });
  console.log(
    `\n${result.blocked ? "⛔ Engel görüldü, yarıda kesildi (tekrar çalıştırınca kaldığı yerden sürer). " : "✅ "}` +
      `${result.brands} marka, ${result.models} model (${result.requests} istek, ${result.skipped} marka yeni olduğu için atlandı).`
  );

  // Ayrı model listesini (model-catalog-data.ts) veritabanındaki katalogdan yeniden üret.
  const { ArabamCatalog } = await import("@/models/ArabamCatalog");
  const { buildModelExtensions, renderModelCatalogData } = await import("@/lib/model-catalog-build");
  const { writeFileSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const docs = await ArabamCatalog.find().select("brand models.name").lean<Array<{ brand: string; models: Array<{ name: string }> }>>();
  const extensions = buildModelExtensions(docs.map((d) => ({ brand: d.brand, names: d.models.map((m) => m.name) })));
  const file = resolve(process.cwd(), "src/lib/model-catalog-data.ts");
  writeFileSync(file, renderModelCatalogData(extensions), "utf8");
  console.log(`📝 ${file}: ${Object.keys(extensions).length} markada ${Object.values(extensions).reduce((n, l) => n + l.length, 0)} ayrı model adı yazıldı.`);

  await mongoose.disconnect();
  process.exit(result.blocked ? 2 : 0);
}

main().catch((err) => {
  console.error("Katalog hatası:", err);
  process.exit(1);
});
