

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
