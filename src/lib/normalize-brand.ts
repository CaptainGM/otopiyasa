

const UPPERCASE_BRANDS = new Set(["bmw", "mg", "byd", "ds", "vw", "gaz"]);

const BRAND_ALIASES: Record<string, string> = {
  mercedes: "Mercedes-Benz",
  "mercedes-benz": "Mercedes-Benz",
  vw: "Volkswagen",
  kgmobility: "KG Mobility",
  "kg mobility": "KG Mobility",
  "ds automobiles": "DS",
  seat: "Seat",
  togg: "Togg",
  swm: "Swm",
  audi: "Audi",
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


export function isNonCarBrand(brand: string): boolean {
  
  const lower = brand.replace(/İ/g, "i").toLowerCase();
  return ["motosiklet", "motorsiklet", "atv", "utv", "traktör"].some((word) =>
    lower.includes(word)
  );
}
