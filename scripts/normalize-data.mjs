
import { readFileSync } from "node:fs";

const env = readFileSync(".env", "utf8");
const uri = env.match(/MONGODB_URI=(.+)/)?.[1]?.trim();
await mongoose.connect(uri);
const cars = mongoose.connection.collection("cars");

const UPPERCASE_BRANDS = new Set(["bmw", "mg", "byd", "ds", "vw", "gaz", "seat"]);
const BRAND_ALIASES = {
  mercedes: "Mercedes-Benz",
  "mercedes-benz": "Mercedes-Benz",
  vw: "Volkswagen",
  kgmobility: "KG Mobility",
};
function normalizeBrand(raw) {
  
  const cleaned = (raw || "")
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .trim()
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ");
  if (!cleaned) return "Bilinmiyor";
  const lower = cleaned.toLowerCase();
  if (BRAND_ALIASES[lower]) return BRAND_ALIASES[lower];
  if (UPPERCASE_BRANDS.has(lower)) return cleaned.toUpperCase();
  const cap = (w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w);
  return lower.split(" ").map((w) => w.split("-").map(cap).join("-")).join(" ");
}

const demo = await cars.deleteMany({ externalId: /^demo-/ });
console.log("Silinen demo ilan:", demo.deletedCount);

const nonCar = await cars.deleteMany({
  brand: /motosiklet|motorsiklet|atv|utv|traktör/i,
});
console.log("Silinen otomobil dışı ilan:", nonCar.deletedCount);


const distinctBrands = await cars.distinct("brand");
let fixed = 0;
for (const brand of distinctBrands) {
  const normalized = normalizeBrand(brand);
  if (normalized !== brand) {
    const r = await cars.updateMany({ brand }, { $set: { brand: normalized } });
    console.log(`  ${JSON.stringify(brand)} -> ${JSON.stringify(normalized)} (${r.modifiedCount})`);
    fixed += r.modifiedCount;
  }
}
console.log("Normalize edilen ilan (marka):", fixed);


function asciiCity(city) {
  return (city || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i")
    .replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u")
    .trim();
}
const cityCounts = await cars
  .aggregate([{ $group: { _id: "$city", n: { $sum: 1 } } }])
  .toArray();
const cityGroups = new Map(); 
for (const { _id, n } of cityCounts) {
  if (!_id) continue;
  const key = asciiCity(_id);
  if (!cityGroups.has(key)) cityGroups.set(key, []);
  cityGroups.get(key).push({ city: _id, n });
}
let cityFixed = 0;
for (const variants of cityGroups.values()) {
  if (variants.length < 2) continue;
  variants.sort((a, b) => b.n - a.n); 
  const canonical = variants[0].city;
  for (const v of variants.slice(1)) {
    const r = await cars.updateMany({ city: v.city }, { $set: { city: canonical } });
    console.log(`  şehir ${JSON.stringify(v.city)} -> ${JSON.stringify(canonical)} (${r.modifiedCount})`);
    cityFixed += r.modifiedCount;
  }
}
console.log("Normalize edilen ilan (şehir):", cityFixed);

const dealerCity = await cars.updateMany(
  { sourceSite: "otomerkezi", city: /otomerkezi/i },
  { $set: { city: "İstanbul" } }
);
console.log("Firma adı şehir alanına yazılmış ilan düzeltildi:", dealerCity.modifiedCount);

const total = await cars.countDocuments();
const brands = await cars.distinct("brand");
console.log("Kalan ilan:", total, "| Marka sayısı:", brands.length);
console.log("Markalar:", brands.sort().join(", "));
await mongoose.disconnect();
