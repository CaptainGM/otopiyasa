
const RATE_MS = 1100;

const ascii = (s) =>
  (s || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i")
    .replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u")
    .trim();

const TR_BOUNDS = { latMin: 35.7, latMax: 42.2, lngMin: 25.6, lngMax: 44.9 };

function loadExisting(file, exportName) {
  if (!fs.existsSync(file)) return {};
  const src = fs.readFileSync(file, "utf8");
  const start = src.indexOf("{", src.indexOf(exportName));
  if (start === -1) return {};
  const json = src.slice(start, src.lastIndexOf("}") + 1);
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}


function districtFromAddress(address) {
  const left = String(address || "").split(",")[0];
  const parts = left.split(/\s+/).filter(Boolean);
  const i = parts.findIndex((p) => /^(mh|mah|mahallesi|mahalle)\.?$/i.test(p));
  const guess = i >= 0 ? parts.slice(i + 1).join(" ") : parts.slice(-1).join(" ");
  return guess.trim();
}

async function geocode(district, province) {
  const url =
    "https://nominatim.openstreetmap.org/search?" +
    new URLSearchParams({
      q: `${district}, ${province}, Türkiye`,
      format: "json",
      limit: "1",
      countrycodes: "tr",
    });
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const rows = await res.json();
  if (!rows.length) return null;
  const lat = Number(rows[0].lat);
  const lng = Number(rows[0].lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (
    lat < TR_BOUNDS.latMin || lat > TR_BOUNDS.latMax ||
    lng < TR_BOUNDS.lngMin || lng > TR_BOUNDS.lngMax
  ) {
    return null; 
  }
  return { lat, lng };
}

const uri = fs.readFileSync(path.join(ROOT, ".env"), "utf8").match(/^MONGODB_URI=(.*)$/m)[1].trim();
await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });
const col = mongoose.connection.db.collection("cars");

const docs = await col
  .find({ address: { $exists: true, $ne: "" } }, { projection: { address: 1, city: 1 } })
  .toArray();
await mongoose.disconnect();


const seen = new Map();
for (const d of docs) {
  const district = districtFromAddress(d.address);
  if (!district || !d.city) continue;
  if (/^merkez$/i.test(district)) continue;
  const key = `${d.city}|${district}`;
  seen.set(key, (seen.get(key) || 0) + 1);
}
console.log(`Adresli araç: ${docs.length}, benzersiz il|ilçe: ${seen.size}`);

// Halihazırda çözülebilenleri ele
const { TR_DISTRICTS } = await import("../src/lib/tr-districts.ts").catch(() => ({}));
const base = TR_DISTRICTS || loadExisting(path.join(ROOT, "src/lib/tr-districts.ts"), "TR_DISTRICTS");
const extra = loadExisting(OUT_FILE, "DISTRICT_EXTRA");

const provinceKeyFor = (cityAscii) => {
  if (base[cityAscii]) return cityAscii;
  return Object.keys(base).find((p) => cityAscii.includes(p)) || null;
};

const todo = [];
for (const [key, count] of seen) {
  const [city, district] = key.split("|");
  const cityKey = ascii(city);
  const province = provinceKeyFor(cityKey);
  const dAscii = ascii(district);
  const inBase = province && (base[province] || []).some((d) => dAscii.includes(d.name));
  const inExtra = (extra[province] || []).some((d) => dAscii.includes(d.name));
  if (!inBase && !inExtra) todo.push({ city, district, province: province || cityKey, count });
}
todo.sort((a, b) => b.count - a.count);

console.log(`Koordinatı eksik ilçe: ${todo.length} (etkilenen ilan: ${todo.reduce((s, t) => s + t.count, 0)})`);
if (todo.length === 0) {
  console.log("Eksik yok — dosya değiştirilmedi.");
  process.exit(0);
}

let added = 0;
let failed = 0;
for (const [i, item] of todo.entries()) {
  try {
    const coords = await geocode(item.district, item.city);
    if (coords) {
      (extra[item.province] ||= []).push({
        name: ascii(item.district),
        lat: Number(coords.lat.toFixed(6)),
        lng: Number(coords.lng.toFixed(6)),
      });
      added++;
      console.log(`  ✓ ${String(i + 1).padStart(3)}/${todo.length} ${item.city}/${item.district} → ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)} (${item.count} ilan)`);
    } else {
      failed++;
      console.log(`  ✗ ${String(i + 1).padStart(3)}/${todo.length} ${item.city}/${item.district} — bulunamadı`);
    }
  } catch (err) {
    failed++;
    console.log(`  ! ${item.city}/${item.district} — ${err.message}`);
  }
  await new Promise((r) => setTimeout(r, RATE_MS));
}


for (const key of Object.keys(extra)) {
  extra[key].sort((a, b) => b.name.length - a.name.length);
}

fs.writeFileSync(
  OUT_FILE,
  `// OTOMATİK ÜRETİLDİ — elle düzenleme; scripts/fill-districts.mjs ile yenilenir.
// Kaynak: OpenStreetMap Nominatim (ODbL).
//
// tr-districts.ts'i TAMAMLAR: o veri seti bir "semt" listesinden üretildiği için
// il-merkez ilçelerini (İzmit, Karatay, Muratpaşa, Odunpazarı…) içermiyordu ve
// bu ilçelerdeki ilanlar haritada il merkezinde yığılıyordu.
export const DISTRICT_EXTRA: Record<string, { name: string; lat: number; lng: number }[]> =
${JSON.stringify(extra, null, 0)};
`,
  "utf8"
);

console.log(`\nBitti → ${path.relative(ROOT, OUT_FILE)}`);
console.log(`Eklenen: ${added}, bulunamayan: ${failed}`);
