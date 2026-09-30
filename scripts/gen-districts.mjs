
import { writeFileSync } from "node:fs";

const URL =
  "https://gist.githubusercontent.com/NovaYear/4fe0fd530aca8b0e0bc0992b356fa32a/raw";


const ascii = (s) =>
  (s || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i")
    .replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u")
    .trim();

const sql = await (await fetch(URL)).text();
const re = /\(\d+,\s*'([^']*)',\s*'[^']*',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)'\)/g;

const map = {};
let m;
while ((m = re.exec(sql))) {
  const [, sehir, semt, lat, lng] = m;
  if (!sehir || !semt) continue;
  if (ascii(sehir) === ascii(semt)) continue; 
  const key = ascii(sehir);
  const name = ascii(semt);
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) continue;
  (map[key] ||= []);
  if (!map[key].some((d) => d.name === name)) map[key].push({ name, lat: la, lng: ln });
}


for (const k of Object.keys(map)) map[k].sort((a, b) => b.name.length - a.name.length);

const out =
  `// OTOMATİK ÜRETİLDİ — elle düzenleme; scripts/gen-districts.mjs ile yenilenir.\n` +
  `// TR il+ilçe merkez GPS koordinatları (harita ilçe dağıtımı için).\n` +
  `export const TR_DISTRICTS: Record<string, { name: string; lat: number; lng: number }[]> =\n` +
  JSON.stringify(map) +
  `;\n`;

writeFileSync("src/lib/tr-districts.ts", out);
console.log(
  "İl:", Object.keys(map).length,
  "| toplam ilçe:", Object.values(map).reduce((s, a) => s + a.length, 0)
);
