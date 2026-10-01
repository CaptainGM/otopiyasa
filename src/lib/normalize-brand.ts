

const UPPERCASE_BRANDS = new Set(["bmw", "mg", "byd", "ds", "vw", "gaz"]);

const BRAND_ALIASES: Record<string, string> = {
  alfa: "Alfa Romeo",
  "alfa romeo": "Alfa Romeo",
  mercedes: "Mercedes-Benz",
  "mercedes benz": "Mercedes-Benz",
  "mercedes-benz": "Mercedes-Benz",
  vw: "Volkswagen",
  kgmobility: "KG Mobility",
  "kg mobility": "KG Mobility",
  kgm: "KG Mobility",
  "kgm ssangyong": "KG Mobility",
  "kgm ssang yong": "KG Mobility",
  ssangyong: "KG Mobility",
  "ssang yong": "KG Mobility",
  "ds automobiles": "DS",
  seat: "Seat",
  togg: "Togg",
  swm: "Swm",
  audi: "Audi",
  // Aksanlar eşleştirme için siliniyor; Türkçe marka adı korunur.
  tofas: "Tofaş",
};

const BRAND_STORAGE_ALIASES: Record<string, string[]> = {
  "Alfa Romeo": ["Alfa", "Alfa Romeo"],
  "Mercedes-Benz": ["Mercedes", "Mercedes-Benz", "Mercedes Benz", "Mercedes - Benz"],
  "KG Mobility": ["KGM", "KG Mobility", "Kgm Ssangyong", "KGM SsangYong", "SsangYong", "Ssang Yong"],
  Volkswagen: ["VW", "Volkswagen"],
  DS: ["DS", "DS Automobiles"],
};

export function normalizeBrand(raw: string): string {
  const cleaned = raw
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s*-\s*/g, "-") 
    .replace(/\s+/g, " ");
  if (!cleaned) return "Bilinmiyor";

  const lower = cleaned
    .replace(/İ/g, "i")
    .replace(/ı/g, "i")
    .toLowerCase();
  if (BRAND_ALIASES[lower]) return BRAND_ALIASES[lower];
  if (UPPERCASE_BRANDS.has(lower)) return cleaned.toUpperCase();


  const capitalize = (word: string) =>
    word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : word;
  return lower
    .split(" ")
    .map((word) => word.split("-").map(capitalize).join("-"))
    .join(" ");
}

export function brandStorageAliases(brand: string): string[] {
  const canonical = normalizeBrand(brand);
  const aliases = BRAND_STORAGE_ALIASES[canonical] ?? [canonical];
  const values = new Set<string>();
  for (const value of [canonical, ...aliases]) {
    values.add(value);
    values.add(value.toLocaleLowerCase("tr-TR"));
    values.add(value.toLocaleUpperCase("tr-TR"));
  }
  return [...values];
}


export function isNonCarBrand(brand: string): boolean {
  
  const lower = brand.replace(/İ/g, "i").toLowerCase();
  return ["motosiklet", "motorsiklet", "atv", "utv", "traktör"].some((word) =>
    lower.includes(word)
  );
}

/**
 * Liste sayfasındaki "Mercedes - Benz G 400 d", "Land Rover Range Rover Velar", "Alfa Romeo Giulia"
 * gibi metinler ilk boşluktan bölününce marka "Mercedes"/"Land"/"Alfa", model "- Benz G 400 d" /
 * "Rover Range Velar" / "Romeo Giulia" oluyordu; filtrede ayrı marka ve anlamsız modeller çıkıyordu.
 */
const SPLIT_BRANDS: Array<{ head: string; tail: RegExp; brand: string }> = [
  { head: "mercedes", tail: /^-?\s*benz(?![a-z0-9])[\s-]*/i, brand: "Mercedes-Benz" },
  { head: "land", tail: /^rover(?![a-z0-9])\s*/i, brand: "Land Rover" },
  { head: "alfa", tail: /^romeo(?![a-z0-9])\s*/i, brand: "Alfa Romeo" },
  { head: "aston", tail: /^martin(?![a-z0-9])\s*/i, brand: "Aston Martin" },
  { head: "rolls", tail: /^-?\s*royce(?![a-z0-9])\s*/i, brand: "Rolls-Royce" },
];

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Marka/model ayrımını düzeltir, markayı tek yazıma çevirir ve modelin başında tekrarlanan markayı atar. */
export function normalizeBrandModel(rawBrand: string, rawModel: string): { brand: string; model: string } {
  let brand = (rawBrand || "").trim();
  let model = (rawModel || "").trim();
  const head = brand.replace(/İ/g, "i").replace(/ı/g, "i").toLowerCase();
  const split = SPLIT_BRANDS.find((s) => s.head === head && s.tail.test(model));
  if (split) {
    brand = split.brand;
    model = model.replace(split.tail, "");
  }
  // Bazı kaynaklar "Range Rover"ı marka yazıyor (model "Velar").
  if (/^range\s+rover$/i.test(brand)) {
    brand = "Land Rover";
    model = `Range Rover ${model}`.trim();
  }
  brand = normalizeBrand(brand);
  // Bölünmüş "Land Rover Range Rover Velar" metninden "Range Velar" kalıyordu.
  if (brand === "Land Rover") model = model.replace(/^range\s+(?!rover(?![a-z0-9]))/i, "Range Rover ");
  // Bir kaynak makyajlı kasayı "MC QASHQAI", "MCQASHQAI1.6" diye yazıyor.
  if (brand === "Nissan") model = model.replace(/^MC(?:\s+(?=\S)|(?=[A-Z]{3,}))/, "");

  // "TOYOTA COROLLA" → "COROLLA"; "DS4", "MG4" gibi bitişik adlar ve yalnız marka adı olan model kalır.
  const brandWords = brand.split(/[\s-]+/).map(escapeRe).join("[\\s-]*");
  const withoutBrand = model.replace(new RegExp(`^${brandWords}[\\s-]+(?=\\S)`, "i"), "");
  if (withoutBrand) model = withoutBrand;

  return { brand, model: model || (rawModel || "").trim() };
}
