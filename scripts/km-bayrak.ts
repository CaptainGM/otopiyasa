// Bir kerelik kilometre temizliği: 1 milyon km üstü kayıtları "mileageSuspect" ile işaretler (herkese açık listeden çıkar,
// silmez, arşive almaz). Varsayılan: yalnızca rapor. --uygula ile yazar; yazmadan önce logs/ altına geri alınabilir yedek bırakır.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadEnv } from "./load-env";

loadEnv();

const APPLY = process.argv.includes("--uygula");
const SAMPLE = 25;

async function main() {
  const { connectDB } = await import("../src/lib/mongodb");
  const { Car } = await import("../src/models/Car");
  const { MAX_PLAUSIBLE_MILEAGE, MAX_PLAUSIBLE_COMMERCIAL_MILEAGE, isPlausibleMileage } = await import("../src/lib/price-plausibility");
  await connectDB();

  const projection = { title: 1, year: 1, mileage: 1, price: 1, status: 1, sourceSite: 1, mileageSuspect: 1 };
  // Ticari araçta üst sınır ayrı (3 milyon); diğer tiplerde 1 milyon.
  const overLimit = {
    $or: [
      { vehicleClass: { $ne: "ticari" }, mileage: { $gt: MAX_PLAUSIBLE_MILEAGE } },
      { vehicleClass: "ticari", mileage: { $gt: MAX_PLAUSIBLE_COMMERCIAL_MILEAGE } },
    ],
  };
  const flagOn = (await Car.find({ ...overLimit, mileageSuspect: { $ne: true } }, projection).lean()) as any[];
  const flagOffCandidates = (await Car.find({ mileageSuspect: true }, projection).lean()) as any[];
  const flagOff = flagOffCandidates.filter((r) => isPlausibleMileage(r.mileage, r.vehicleClass));

  console.log(`Bayraklanacak (binek/motosiklet > ${MAX_PLAUSIBLE_MILEAGE.toLocaleString("tr-TR")}, ticari > ${MAX_PLAUSIBLE_COMMERCIAL_MILEAGE.toLocaleString("tr-TR")}): ${flagOn.length} (aktif ${flagOn.filter((r) => r.status === "active").length})`);
  for (const r of flagOn.slice(0, SAMPLE)) {
    console.log(`  ${String(r._id)} | ${r.status} | ${r.sourceSite} | ${r.year} | ${r.mileage.toLocaleString("tr-TR")} km | ${r.price.toLocaleString("tr-TR")} TL | ${String(r.title).slice(0, 50)}`);
  }
  console.log(`Bayrağı kalkacak: ${flagOff.length}`);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = path.join(process.cwd(), "logs");
  mkdirSync(dir, { recursive: true });
  const backupPath = path.join(dir, `km-bayrak-${stamp}.json`);
  writeFileSync(
    backupPath,
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        applied: APPLY,
        flagOn: flagOn.map((r) => ({ _id: String(r._id), mileage: r.mileage, status: r.status, sourceSite: r.sourceSite, title: r.title })),
        flagOff: flagOff.map((r) => ({ _id: String(r._id), mileage: r.mileage, status: r.status, title: r.title })),
      },
      null,
      2
    )
  );
  console.log(`Yedek: ${backupPath}`);

  if (!APPLY) {
    console.log("Salt rapor. Yazmak için: npx tsx scripts/km-bayrak.ts --uygula");
    process.exit(0);
  }
  if (flagOn.length) {
    await Car.updateMany({ _id: { $in: flagOn.map((r) => r._id) } }, { $set: { mileageSuspect: true } }, { timestamps: false });
  }
  if (flagOff.length) {
    await Car.updateMany({ _id: { $in: flagOff.map((r) => r._id) } }, { $set: { mileageSuspect: false } }, { timestamps: false });
  }
  console.log(`Uygulandı: bayraklanan ${flagOn.length}, bayrağı kalkan ${flagOff.length}.`);
  process.exit(0);
}

main().catch((error) => {
  console.error("km temizliği çöktü:", error);
  process.exit(1);
});
