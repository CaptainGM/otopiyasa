
import { readFileSync, writeFileSync } from "node:fs";

const sql = readFileSync(new URL("../il_ilce_enlem_boylam.sql", import.meta.url), "utf8");

/** Türkçe başlık biçimi: "AFYONKARAHİSAR" → "Afyonkarahisar", "IĞDIR" → "Iğdır". */
function titleTr(raw) {
  return raw
    .split(/([\s\-'/]+)/)
    .map((part) => {
      if (/^[\s\-'/]+$/.test(part) || !part) return part;
      const chars = [...part];
      const head = chars[0] === "i" ? "İ" : chars[0].toLocaleUpperCase("tr-TR");
      const tail = chars
        .slice(1)
        .join("")
        // Büyük I küçükken noktasız ı, İ ise i olur.
        .replace(/I/g, "ı")
        .replace(/İ/g, "i")
        .toLocaleLowerCase("tr-TR");
      return head + tail;
    })
    .join("");
}


const provinces = new Map(); 
for (const m of sql.matchAll(/INSERT INTO `pk_il` VALUES \('(\d+)',\s*'([^']+)'/g)) {
  provinces.set(m[1], titleTr(m[2]));
}

const districts = new Map(); // il_id -> Set(ad)
for (const m of sql.matchAll(/INSERT INTO `pk_ilce` VALUES \('\d+',\s*'(\d+)',\s*'([^']+)'/g)) {
  const ilId = m[1];
  let name = titleTr(m[2]);

  name = name.replace(/\s*\(.*?\)\s*/g, "").trim();
  if (!name) continue;
  if (!districts.has(ilId)) districts.set(ilId, new Set());
  districts.get(ilId).add(name);
}

const out = {};
for (const [ilId, ad] of [...provinces].sort((a, b) => a[1].localeCompare(b[1], "tr"))) {
  out[ad] = [...(districts.get(ilId) || [])].sort((a, b) => a.localeCompare(b, "tr"));
}

const body = `/**
 * İL → İLÇE adları (görüntüleme için, doğru Türkçe yazımıyla).
 * ÜRETİLMİŞ DOSYA — elle düzenleme: scripts/gen-geo.mjs çalıştır.
 * Kaynak: il_ilce_enlem_boylam.sql
 */
export const TR_GEO: Record<string, string[]> = ${JSON.stringify(out, null, 0)};

/** Alfabetik il listesi. */
export const TR_PROVINCES: string[] = Object.keys(TR_GEO);
`;

writeFileSync(new URL("../src/lib/tr-geo.ts", import.meta.url), body, "utf8");

/**
 * MOBİL İÇİN AYNI VERİ.
 * Flutter uygulaması da il/ilçe seçimi sunuyor; iki tarafın listesi ayrışmasın
 * diye ikisi de BU dosyadan üretiliyor (tek kaynak).
 */
const dart = `// İL → İLÇE adları. ÜRETİLMİŞ DOSYA — elle düzenleme:
// node scripts/gen-geo.mjs  (kaynak: il_ilce_enlem_boylam.sql)
const Map<String, List<String>> trGeo = ${JSON.stringify(out)
  .replace(/"([^"]+)":/g, "'$1':")
  .replace(/"/g, "'")};

/// Alfabetik il listesi.
final List<String> trProvinces = trGeo.keys.toList();

/// Bir ilin ilçeleri; bilinmeyen ilde boş liste.
List<String> trDistrictsOf(String province) => trGeo[province] ?? const [];
`;
writeFileSync(new URL("../mobile/lib/data/tr_geo.dart", import.meta.url), dart, "utf8");
console.log(
  `tr-geo.ts yazıldı: ${Object.keys(out).length} il, ${Object.values(out).reduce((n, d) => n + d.length, 0)} ilçe`
);
console.log("Örnek:", Object.keys(out).slice(0, 3), "| İstanbul ilçe:", (out["İstanbul"] || []).length);
