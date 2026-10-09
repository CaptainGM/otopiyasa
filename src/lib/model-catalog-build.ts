import { catalogBrandKey, genericModelFamily } from "@/lib/model-family";
import { normalizeBrand } from "@/lib/normalize-brand";

/** Harf sınıfıyla adlanan markalarda "C Serisi" gerçek ailedir; diğer markalarda ("H 100") yanlış birleştirmedir. */
const CLASS_BRAND_KEYS = new Set(["mercedesbenz", "mercedes", "lexus", "bmw"]);

const bareText = (text: string) =>
  text
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]/gu, "");

/**
 * Kaynağın model listesinden, genel aile kuralının yanlışlıkla başka modele kattığı adları ayıklar: "i20 N" → genel kural "i20" der,
 * kaynak ayrı model sayar. Genel kuralın zaten doğru bulduğu adlar (Corolla, Civic…) yazılmaz.
 */
export function buildModelExtensions(catalog: Array<{ brand: string; names: string[] }>): Record<string, string[]> {
  const out = new Map<string, Map<string, string>>(); // marka anahtarı → (birleşik ad → görünen ad)
  for (const { brand: rawBrand, names } of catalog) {
    // Veritabanındaki marka yazımı (KGM SsangYong → KG Mobility); anahtar buna göre kurulur ki kural gerçekten eşleşsin.
    const brand = normalizeBrand(rawBrand);
    const key = catalogBrandKey(brand);
    if (!key) continue;
    for (const raw of names) {
      const name = raw.trim().replace(/\s+/g, " ");
      if (!name) continue;
      const generic = genericModelFamily(name, brand);
      const nameKey = bareText(name);
      const genericKey = bareText(generic);
      // Genel kural adı olduğu gibi buluyorsa (ya da ad ailenin devamı değilse) istisna gerekmez.
      const falseSeries = genericKey.endsWith("serisi") && !nameKey.endsWith("serisi") && !CLASS_BRAND_KEYS.has(key);
      if (!genericKey || genericKey === nameKey || !(nameKey.startsWith(genericKey) || falseSeries)) continue;
      if (!out.has(key)) out.set(key, new Map());
      if (!out.get(key)!.has(nameKey)) out.get(key)!.set(nameKey, name);
    }
  }
  return Object.fromEntries(
    [...out.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, names]) => [key, [...names.values()].sort((a, b) => a.localeCompare(b, "tr"))])
  );
}

/** model-catalog-data.ts dosyasının tam içeriği. */
export function renderModelCatalogData(extensions: Record<string, string[]>): string {
  const lines = Object.entries(extensions).map(([brand, names]) => `  ${JSON.stringify(brand)}: ${JSON.stringify(names)},`);
  return `/**
 * KAYNAĞIN AYRI MODEL SAYDIĞI ADLAR (marka → model adları). \`scripts/model-catalog.ts\` kaynağın marka sayfalarındaki model listesinden
 * üretir (scrape.bat 22); elle düzenlenmez. Yalnızca genel aile kuralının ("i20 N" → "i20") yanlış birleştirdiği adlar yazılır; diğer
 * modeller zaten aile kuralıyla doğru çıkıyor. Anahtar: aksansız, harf/rakam dışı karakterleri atılmış küçük harf marka adı.
 */
export const MODEL_EXTENSIONS: Record<string, string[]> = {
${lines.join("\n")}
};
`;
}
