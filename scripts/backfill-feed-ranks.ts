import { loadEnv } from "./load-env";
import type { Types } from "mongoose";

loadEnv();

const RANK_FIELDS = ["rand", "rand2", "rand3", "rand4"] as const;
const BATCH_SIZE = 500;
const dryRun = process.argv.includes("--dry-run");

async function main() {
  const [{ connectDB }, { Car }, mongoose] = await Promise.all([
    import("@/lib/mongodb"),
    import("@/models/Car"),
    import("mongoose"),
  ]);
  await connectDB();

  const missingRank = {
    $or: RANK_FIELDS.map((field) => ({ [field]: { $exists: false } })),
  };
  const missingBefore = await Car.collection.countDocuments(missingRank);
  if (dryRun) {
    console.log(`Akış sıralaması ön kontrolü: ${missingBefore} ilanda bir veya daha fazla sıra alanı eksik.`);
    await mongoose.default.disconnect();
    return;
  }

  let lastId: Types.ObjectId | undefined;
  let updated = 0;
  while (true) {
    const page = await Car.collection
      .find(
        { ...missingRank, ...(lastId ? { _id: { $gt: lastId } } : {}) },
        { projection: { _id: 1, ...Object.fromEntries(RANK_FIELDS.map((field) => [field, 1])) } }
      )
      .sort({ _id: 1 })
      .limit(BATCH_SIZE)
      .toArray();
    if (page.length === 0) break;
    lastId = page[page.length - 1]._id;

    const operations = page.flatMap((car) => {
      const set: Record<string, number> = {};
      for (const field of RANK_FIELDS) {
        if (typeof car[field] !== "number" || !Number.isFinite(car[field])) {
          set[field] = Math.random();
        }
      }
      return Object.keys(set).length > 0
        ? [{ updateOne: { filter: { _id: car._id }, update: { $set: set } } }]
        : [];
    });
    if (operations.length > 0) {
      const result = await Car.collection.bulkWrite(operations, { ordered: false });
      updated += result.modifiedCount;
    }
  }

  for (const field of RANK_FIELDS.slice(1)) {
    await Car.collection.createIndex(
      { status: 1, [field]: 1 },
      { name: `status_1_${field}_1` }
    );
  }

  const missingAfter = await Car.collection.countDocuments(missingRank);
  console.log(`Akış sıralaması alanları tamamlandı: ${updated} ilan güncellendi; eksik kalan ${missingAfter}.`);
  await mongoose.default.disconnect();
}

main().catch(async (error) => {
  console.error(`Akış sıralaması güncellemesi başarısız (${error instanceof Error ? error.name : "hata"}).`);
  const mongoose = await import("mongoose");
  await mongoose.default.disconnect().catch(() => {});
  process.exitCode = 1;
});
