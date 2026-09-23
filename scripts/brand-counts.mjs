

import mongoose from "mongoose";
import { readFileSync } from "node:fs";

const env = readFileSync(".env", "utf8");
const uri = env.match(/MONGODB_URI=(.+)/)?.[1]?.trim();
if (!uri) {
  console.error("MONGODB_URI .env içinde bulunamadı.");
  process.exit(1);
}

await mongoose.connect(uri);
const cars = mongoose.connection.collection("cars");

const total = await cars.countDocuments();
const rows = await cars
  .aggregate([
    { $group: { _id: "$brand", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ])
  .toArray();

console.log(`\nToplam araç: ${total}  |  Marka sayısı: ${rows.length}\n`);
console.log("Marka".padEnd(22) + "Adet   Pay");
console.log("-".repeat(40));
for (const r of rows) {
  const brand = (r._id || "(boş)").padEnd(22);
  const count = String(r.count).padStart(4);
  const pct = ((r.count / total) * 100).toFixed(1).padStart(5);
  console.log(`${brand}${count}   %${pct}`);
}


const rare = rows.filter((r) => r.count <= 5);
if (rare.length > 0) {
  console.log(`\nAz veri (≤5 ilan) olan ${rare.length} marka:`);
  console.log(rare.map((r) => `${r._id} (${r.count})`).join(", "));
}

await mongoose.disconnect();
