
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SQL_PATH = path.join(ROOT, "il_ilce_enlem_boylam.sql");
const OUT_PATH = path.join(ROOT, "src", "lib", "tr-districts.ts");
function ascii(s) {
  return (s || "")
    .replace(/İ/g, "I")
    .replace(/ı/g, "i")
    .replace(/Ş/g, "S").replace(/ş/g, "s")
    .replace(/Ğ/g, "G").replace(/ğ/g, "g")
    .replace(/Ü/g, "U").replace(/ü/g, "u")
    .replace(/Ö/g, "O").replace(/ö/g, "o")
    .replace(/Ç/g, "C").replace(/ç/g, "c")
    .toLowerCase()
    .trim();
}

const sql = fs.readFileSync(SQL_PATH, "utf8");


const ilById = new Map();
const provinceCenters = {};
const ilRe = /INSERT INTO `pk_il` VALUES \('(\d+)', '([^']*)', '([^']*)', '([^']*)'/g;
for (const m of sql.matchAll(ilRe)) {
  const name = ascii(m[2]);
  ilById.set(m[1], name);
  const lat = Number(m[3]);
  const lng = Number(m[4]);
  if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) {
    provinceCenters[name] = { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
  }
}


const ilceRe = /INSERT INTO `pk_ilce` VALUES \('\d+', '(\d+)', '([^']*)', '([^']*)', '([^']*)'/g;


function nameVariants(raw) {
  const names = new Set();
  const base = raw.replace(/\(.*?\)/g, "").trim();
  if (base) names.add(ascii(base));
  for (const inner of raw.matchAll(/\(([^)]*)\)/g)) {
    const v = inner[1].trim();
    if (v) names.add(ascii(v));
  }
  return [...names].filter(Boolean);
}


const ALIASES = {
  eyup: ["eyupsultan"],
  
};

const provinces = {};
let districtCount = 0;

for (const m of sql.matchAll(ilceRe)) {
  const province = ilById.get(m[1]);
  if (!province) continue;
  const lat = Number(m[3]);
  const lng = Number(m[4]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0 || lng === 0) continue;

  const list = (provinces[province] ||= []);
  const variants = nameVariants(m[2]);
  for (const name of variants) {
    for (const n of [name, ...(ALIASES[name] || [])]) {
      if (list.some((d) => d.name === n)) continue;
      list.push({ name: n, lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) });
      districtCount += 1;
    }
  }
}


for (const list of Object.values(provinces)) {
  list.sort((a, b) => b.name.length - a.name.length || a.name.localeCompare(b.name));
}

const contents = `// OTOMATİK ÜRETİLDİ — elle düzenlemeyin.
// Kaynak: il_ilce_enlem_boylam.sql (Google Maps/Başarsoft il-ilçe koordinatları)
// Yenilemek için: node scripts/gen-districts-from-sql.mjs
//
// ${Object.keys(provinces).length} il, ${districtCount} ilçe arama adı (parantezli ikinci adlar ve
// ad değişiklikleri ayrı ad olarak eklenir). İl-MERKEZ ilçeleri dahildir
// (İzmit, Karatay, Muratpaşa, Odunpazarı...) — önceki semt veri setinde yoktular.
export const TR_DISTRICTS: Record<string, { name: string; lat: number; lng: number }[]> =
${JSON.stringify(provinces, null, 0)};

// 81 il merkezi. city-coords.ts bunu TABAN olarak kullanır; elle doğrulanmış
// değerler (ör. Kocaeli → İzmit şehir merkezi) bunun ÜZERİNE yazılır.
export const TR_PROVINCE_CENTERS: Record<string, { lat: number; lng: number }> =
${JSON.stringify(provinceCenters, null, 0)};
`;

fs.writeFileSync(OUT_PATH, contents, "utf8");

console.log(`YAZILDI: ${path.relative(ROOT, OUT_PATH)}`);
console.log(`  il: ${Object.keys(provinces).length}`);
console.log(`  il merkezi: ${Object.keys(provinceCenters).length}`);
console.log(`  ilçe arama adı: ${districtCount}`);
const sample = ["kocaeli", "istanbul", "izmir", "ankara", "antalya"];
for (const p of sample) {
  console.log(`  ${p}: ${provinces[p]?.length ?? 0} ad`);
}
