// Bir kerelik segment tavanı taraması: model ailesinin normal fiyat düzeyinin çok üstündeki aktif ilanları "segmentSuspect"
// ile işaretler (herkese açık listeden çıkar, silmez, arşive almaz). Varsayılan: yalnızca rapor. --uygula ile yazar; önce
// logs/ altına geri alınabilir yedek bırakır.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadEnv } from "./load-env";

loadEnv();

const APPLY = process.argv.includes("--uygula");
const SAMPLE = 30;

async function main() {
  const { connectDB } = await import("../src/lib/mongodb");
  const { Car } = await import("../src/models/Car");
  const { PUBLIC_LISTING_FILTER } = await import("../src/lib/listing-visibility");
  const { modelFamilyKey } = await import("../src/lib/model-family");
  const { segmentCapFrom, isAboveSegmentCap } = await import("../src/lib/segment-cap");
  await connectDB();

  // Tavan referansı: yayındaki bayraksız ilanlar (PUBLIC_LISTING_FILTER tavanı zaten bayraklı kayıtlardan arındırır).
  const reference = (await Car.find(PUBLIC_LISTING_FILTER, { brand: 1, model: 1, price: 1 }).lean()) as unknown as Array<{ brand: string; model: string; price: number }>;
  const familyPrices = new Map<string, number[]>();
  const brandPrices = new Map<string, number[]>();
  for (const r of reference) {
    const fam = `${r.brand}|${modelFamilyKey(r.model, r.brand)}`;
    if (!familyPrices.has(fam)) familyPrices.set(fam, []);
    familyPrices.get(fam)!.push(r.price);
    if (!brandPrices.has(r.brand)) brandPrices.set(r.brand, []);
    brandPrices.get(r.brand)!.push(r.price);
  }

  const active = (await Car.find({ status: "active" }, { title: 1, brand: 1, model: 1, year: 1, price: 1, sourceSite: 1, segmentSuspect: 1 }).lean()) as any[];
  const flagOn: any[] = [];
  const flagOff: any[] = [];
  const capOf = new Map<string, unknown>();
  for (const doc of active) {
    const fam = `${doc.brand}|${modelFamilyKey(doc.model, doc.brand)}`;
    const cap = segmentCapFrom(familyPrices.get(fam) ?? [], brandPrices.get(doc.brand) ?? []);
    const above = isAboveSegmentCap(doc.price, cap);
    if (above && !doc.segmentSuspect) flagOn.push({ doc, cap });
    if (!above && doc.segmentSuspect) flagOff.push({ doc, cap });
    capOf.set(String(doc._id), cap);
  }

  console.log(`Bayraklanacak (segment tavanı aşan aktif ilan): ${flagOn.length} · bayrağı kalkacak: ${flagOff.length}`);
  for (const { doc, cap } of flagOn.slice(0, SAMPLE)) {
    const c = cap as { cap: number; reference: number; n: number; scope: string } | null;
    console.log(`  ${String(doc._id)} | ${doc.year} ${doc.brand} ${doc.model} | ${doc.price.toLocaleString("tr-TR")} TL | tavan ${c ? Math.round(c.cap).toLocaleString("tr-TR") : "-"} (${c?.scope}, n=${c?.n}) | ${String(doc.title).slice(0, 50)}`);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = path.join(process.cwd(), "logs");
  mkdirSync(dir, { recursive: true });
  const backupPath = path.join(dir, `segment-bayrak-${stamp}.json`);
  writeFileSync(
    backupPath,
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        applied: APPLY,
        flagOn: flagOn.map(({ doc }) => ({ _id: String(doc._id), price: doc.price, title: doc.title })),
        flagOff: flagOff.map(({ doc }) => ({ _id: String(doc._id), price: doc.price, title: doc.title })),
      },
      null,
      2
    )
  );
  console.log(`Yedek: ${backupPath}`);

  if (!APPLY) {
    console.log("Salt rapor. Yazmak için: npx tsx scripts/segment-bayrak.ts --uygula");
    process.exit(0);
  }
  if (flagOn.length) {
    await Car.updateMany({ _id: { $in: flagOn.map(({ doc }) => doc._id) } }, { $set: { segmentSuspect: true } }, { timestamps: false });
  }
  if (flagOff.length) {
    await Car.updateMany({ _id: { $in: flagOff.map(({ doc }) => doc._id) } }, { $set: { segmentSuspect: false } }, { timestamps: false });
  }
  console.log(`Uygulandı: bayraklanan ${flagOn.length}, bayrağı kalkan ${flagOff.length}.`);
  process.exit(0);
}

main().catch((error) => {
  console.error("segment taraması çöktü:", error);
  process.exit(1);
});
