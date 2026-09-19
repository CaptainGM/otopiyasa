
import mongoose from "mongoose";
import { readFileSync } from "node:fs";

const atlasUri = process.argv[2];
if (!atlasUri || !atlasUri.startsWith("mongodb")) {
  console.error('Kullanım: node scripts/migrate-to-atlas.mjs "<ATLAS_URI>"');
  process.exit(1);
}

const env = readFileSync(".env", "utf8");
const localUri = env.match(/MONGODB_URI=(.+)/)?.[1]?.trim();

console.log("Yerel veritabanına bağlanılıyor...");
const local = await mongoose.createConnection(localUri).asPromise();
console.log("Atlas'a bağlanılıyor...");
const atlas = await mongoose.createConnection(atlasUri).asPromise();

const collections = (await local.db.listCollections().toArray())
  .map((c) => c.name)
  .filter((name) => !name.startsWith("system."));

for (const name of collections) {
  const docs = await local.db.collection(name).find({}).toArray();
  if (docs.length === 0) {
    console.log(`${name}: boş, atlandı`);
    continue;
  }
  
  await atlas.db.collection(name).deleteMany({});
  await atlas.db.collection(name).insertMany(docs);
  console.log(`${name}: ${docs.length} kayıt kopyalandı`);
}

console.log("\nTaşıma tamamlandı. Vercel'deki MONGODB_URI'yi Atlas URI ile ayarlamayı unutma.");
await local.close();
await atlas.close();
