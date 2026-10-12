// Bir kerelik veri temizliği: aykırı fiyatları bayraklar (yazım hatası gibi görünenler herkese açık listeden çıkar),
// scooter/motosikletin otomobil olarak kaydedildiği ilanları düzeltir ve marka alanına düşmüş satıcı türlerini onarır.
// Varsayılan: yalnızca rapor. --uygula ile yazar; yazmadan önce logs/ altına geri alınabilir yedek JSON bırakır.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadEnv } from "./load-env";

loadEnv();

const APPLY = process.argv.includes("--uygula");
const SAMPLE = 25;
const RATIO_LIMIT = 8;
const MIN_GROUP = 5;

const fmt = (n: number) => n.toLocaleString("tr-TR");
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

async function main() {
  const { connectDB } = await import("../src/lib/mongodb");
  const { Car } = await import("../src/models/Car");
  const { isPlausibleListingPrice, MAX_PLAUSIBLE_PRICE, minPlausiblePrice } = await import("../src/lib/price-plausibility");
  const { normalizeBrandModel } = await import("../src/lib/normalize-brand");
  await connectDB();

  const activeBase = { status: "active", moderationStatus: { $nin: ["pending", "rejected"] } };
  const projection = { title: 1, price: 1, brand: 1, model: 1, year: 1, status: 1, sourceSite: 1, vehicleClass: 1, priceSuspect: 1 };

  // 1) Oran tabanlı aykırılar: aynı marka+model+yıl grubunda (en az 5 aktif ilan) medyanın 8 katından pahalı.
  const groups = (await Car.aggregate([
    { $match: { ...activeBase, price: { $gt: 0 } } },
    { $group: { _id: { brand: "$brand", model: "$model", year: "$year" }, prices: { $push: "$price" }, n: { $sum: 1 } } },
    { $match: { n: { $gte: MIN_GROUP } } },
  ])) as Array<{ _id: { brand: string; model: string; year: number }; prices: number[] }>;
  const medians = new Map(groups.map((g) => [JSON.stringify(g._id), median(g.prices)]));
  const ratioCandidates = (await Car.find({ ...activeBase, price: { $gt: 1_000_000, $lte: MAX_PLAUSIBLE_PRICE } }, projection).lean()) as any[];
  const ratioRows = ratioCandidates
    .map((r) => ({ r, med: medians.get(JSON.stringify({ brand: r.brand, model: r.model, year: r.year })) }))
    .filter((x) => x.med && x.r.price > RATIO_LIMIT * x.med);
  const ratioIds = new Set(ratioRows.map((x) => String(x.r._id)));

  // 2) Scooter/motosiklet yeniden sınıflandırması: başlıktaki "Elektrikli Araçlar Scooter|Motosiklet" alt kategorisi.
  const scooterRows = (await Car.find(
    {
      vehicleClass: { $in: ["otomobil", null] },
      // "Elektrikli Araçlar Scooter..." alt kategorisi ya da başlığın başındaki "Motorsiklet"/"Scooter" (araç ilanında geçen kelime sayılmaz).
      $or: [{ title: /elektrikli araçlar\s+(scooter|motosiklet)/i }, { title: /^\s*(sahibinden|galeriden)?\s*(motosiklet|motorsiklet|scooter)\b/i }],
    },
    projection
  ).lean()) as any[];
  const reclass = new Map(scooterRows.map((r) => [String(r._id), "motosiklet"]));

  // 3) Bayrak hedefleri: son araç tipine göre fiyat kuralı + oran aykırıları. Aday küme küçük tutulur (aralık dışı fiyat veya bayraklı).
  const candidates = (await Car.find(
    {
      $or: [
        { price: { $lt: 50_000 } },
        { price: { $gt: MAX_PLAUSIBLE_PRICE } },
        { priceSuspect: true },
        { _id: { $in: [...ratioIds] } },
        { _id: { $in: scooterRows.map((r) => r._id) } },
      ],
    },
    projection
  ).lean()) as any[];
  const flagOn: any[] = [];
  const flagOff: any[] = [];
  for (const r of candidates) {
    const id = String(r._id);
    const effectiveClass = reclass.get(id) ?? r.vehicleClass;
    const suspect = ratioIds.has(id) || !isPlausibleListingPrice(r.price, effectiveClass);
    if (suspect && !r.priceSuspect) flagOn.push(r);
    if (!suspect && r.priceSuspect) flagOff.push(r);
  }

  // 4) Marka düzeltmesi: satıcı türü marka alanına düşmüş kayıtlar.
  const dirty = (await Car.find(
    { brand: { $in: [/^galeriden$/i, /^sahibinden$/i, /^bireysel$/i, /^kurumsal$/i] } },
    projection
  ).lean()) as any[];
  const brandPlans = dirty
    .map((r) => ({ _id: r._id, title: r.title, from: r.brand, to: normalizeBrandModel(r.brand, r.model).brand, model: r.model, status: r.status }))
    .filter((p) => p.to !== p.from);

  console.log(`\n[1] Oran tabanlı aykırı (medyanın ${RATIO_LIMIT} katı, grup ≥ ${MIN_GROUP}): ${ratioRows.length}`);
  for (const { r, med } of ratioRows.slice(0, SAMPLE)) {
    console.log(`    ${String(r._id)} | ${r.year} ${r.brand} ${r.model} | ${fmt(r.price)} TL (medyan ${fmt(Math.round(med ?? 0))})`);
  }
  console.log(`\n[2] Araç tipi düzeltmesi (otomobil → motosiklet): ${reclass.size}`);
  for (const r of scooterRows.slice(0, SAMPLE)) {
    console.log(`    ${String(r._id)} | ${r.status} | ${fmt(r.price)} TL | ${String(r.title).slice(0, 70)}`);
  }
  console.log(`\n[3] Bayraklanacak (yeni): ${flagOn.length} · bayrağı kalkacak: ${flagOff.length}`);
  for (const r of flagOn.slice(0, SAMPLE)) {
    const cls = reclass.get(String(r._id)) ?? r.vehicleClass ?? "(boş)";
    console.log(`    ${String(r._id)} | ${r.status} | ${r.sourceSite} | ${r.year} ${r.brand} ${r.model} | ${fmt(r.price)} TL | tip ${cls} (alt sınır ${fmt(minPlausiblePrice(cls))})`);
  }
  console.log(`\n[4] Marka düzeltmesi: ${brandPlans.length} / ${dirty.length} kayıt`);
  for (const p of brandPlans.slice(0, SAMPLE)) {
    console.log(`    ${String(p._id)} | ${p.status} | "${p.from}" → "${p.to}" | model "${p.model}"`);
  }

  // Yedek: uygulanmasa bile rapor dosyası bırakılır (geri alma ve inceleme için).
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = path.join(process.cwd(), "logs");
  mkdirSync(dir, { recursive: true });
  const backupPath = path.join(dir, `veri-temizligi-${stamp}.json`);
  const backup = {
    createdAt: new Date().toISOString(),
    applied: APPLY,
    ratioOutliers: ratioRows.map((x) => ({ _id: String(x.r._id), price: x.r.price, median: x.med, brand: x.r.brand, model: x.r.model, year: x.r.year })),
    reclass: scooterRows.map((r) => ({ _id: String(r._id), from: r.vehicleClass ?? null, to: "motosiklet", title: r.title })),
    flagOn: flagOn.map((r) => ({ _id: String(r._id), price: r.price, status: r.status, sourceSite: r.sourceSite, title: r.title })),
    flagOff: flagOff.map((r) => ({ _id: String(r._id), price: r.price, status: r.status, title: r.title })),
    brandPlans: brandPlans.map((p) => ({ _id: String(p._id), from: p.from, to: p.to, model: p.model, title: p.title })),
  };
  writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log(`\nYedek: ${backupPath}`);

  if (!APPLY) {
    console.log("\nSalt rapor. Yazmak için: npx tsx scripts/veri-temizligi.ts --uygula");
    process.exit(0);
  }

  if (scooterRows.length) {
    await Car.bulkWrite(
      scooterRows.map((r) => ({ updateOne: { filter: { _id: r._id }, update: { $set: { vehicleClass: "motosiklet" } }, timestamps: false } })),
      { ordered: false }
    );
  }
  if (flagOn.length) {
    await Car.updateMany({ _id: { $in: flagOn.map((r) => r._id) } }, { $set: { priceSuspect: true } }, { timestamps: false });
  }
  if (flagOff.length) {
    await Car.updateMany({ _id: { $in: flagOff.map((r) => r._id) } }, { $set: { priceSuspect: false } }, { timestamps: false });
  }
  if (brandPlans.length) {
    await Car.bulkWrite(
      brandPlans.map((p) => ({ updateOne: { filter: { _id: p._id }, update: { $set: { brand: p.to } }, timestamps: false } })),
      { ordered: false }
    );
  }
  console.log(`\nUygulandı: araç tipi ${reclass.size}, bayraklanan ${flagOn.length}, bayrağı kalkan ${flagOff.length}, marka düzeltilen ${brandPlans.length}.`);
  process.exit(0);
}

main().catch((error) => {
  console.error("temizlik çöktü:", error);
  process.exit(1);
});
