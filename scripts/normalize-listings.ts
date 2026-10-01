// Kayıtlı ilanlarda kaynaklara göre değişen yazımları tek yazıma çevirir:
//   marka/model  "Mercedes" + "- Benz C 180" → "Mercedes-Benz" + "C 180", "Land" + "Rover Range Velar" → "Land Rover" + "Range Rover Velar"
//   yakıt        "Benzin & LPG" → "LPG & Benzin", "Kurşunsuz" → "Benzin"
//   il           "Elaziğ" → "Elazığ", "İSTANBUL" → "İstanbul"
// Yeni ilanlar kaydedilirken aynı dönüşüm zaten uygulanıyor (run-scrape saveListing).
//   npx tsx scripts/normalize-listings.ts           → yalnızca rapor
//   npx tsx scripts/normalize-listings.ts --apply   → yazar
import { loadEnv } from "./load-env";

loadEnv();

async function main() {
  const apply = process.argv.includes("--apply");
  const { connectDB } = await import("@/lib/mongodb");
  const { Car } = await import("@/models/Car");
  const { normalizeFuelType } = await import("@/lib/normalize-fuel");
  const { normalizeCity } = await import("@/lib/normalize-city");
  const { normalizeBrandModel } = await import("@/lib/normalize-brand");
  const { default: mongoose } = await import("mongoose");
  await connectDB();

  const fmt = (n: number) => n.toLocaleString("tr-TR");
  type Op = { updateMany: { filter: Record<string, unknown>; update: { $set: Record<string, string> } } };
  const write = async (ops: Op[]) => {
    for (let i = 0; apply && i < ops.length; i += 500) {
      await Car.bulkWrite(ops.slice(i, i + 500), { ordered: false, timestamps: false });
    }
  };

  // 1) Marka / model
  const pairs = await Car.aggregate<{ _id: { brand?: string; model?: string }; n: number }>([
    { $group: { _id: { brand: "$brand", model: "$model" }, n: { $sum: 1 } } },
  ]);
  const brandOps: Op[] = [];
  const brandChanges = new Map<string, number>();
  let brandTotal = 0;
  for (const { _id, n } of pairs) {
    if (!_id.brand) continue;
    const next = normalizeBrandModel(_id.brand, _id.model || "");
    if (next.brand === _id.brand && next.model === (_id.model || "")) continue;
    brandTotal += n;
    const label = next.brand !== _id.brand ? `${_id.brand} → ${next.brand}` : `${next.brand}: model başındaki marka`;
    brandChanges.set(label, (brandChanges.get(label) || 0) + n);
    brandOps.push({ updateMany: { filter: { brand: _id.brand, model: _id.model }, update: { $set: next } } });
  }
  console.log("Marka / model:");
  for (const [label, n] of [...brandChanges].sort((a, b) => b[1] - a[1])) console.log(`  ${label}: ${fmt(n)} ilan`);
  await write(brandOps);

  // 2) Yakıt ve il
  for (const [field, normalize, title] of [
    ["features.fuelType", normalizeFuelType, "Yakıt"],
    ["city", normalizeCity, "İl"],
  ] as const) {
    const values: Array<string | null> = await Car.distinct(field);
    const ops: Op[] = [];
    console.log(`${title}:`);
    for (const value of values) {
      if (!value) continue;
      const target = normalize(value);
      if (value === target) continue;
      const count = await Car.countDocuments({ [field]: value });
      console.log(`  ${JSON.stringify(value)} → ${JSON.stringify(target)}: ${fmt(count)} ilan`);
      ops.push({ updateMany: { filter: { [field]: value }, update: { $set: { [field]: target } } } });
    }
    await write(ops);
  }

  console.log(apply ? `\nYazıldı (marka/model: ${fmt(brandTotal)} ilan).` : `\nYalnızca rapor; yazmak için --apply (marka/model: ${fmt(brandTotal)} ilan).`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Yazım düzeltme hatası:", err);
  process.exit(1);
});
