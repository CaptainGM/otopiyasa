const CITY_ALIASES: Record<string, string> = {
  elazig: "Elazığ",
  kirsehir: "Kırşehir",
  afyonkarahisar: "Afyonkarahisar",
  istanbul: "İstanbul",
  izmir: "İzmir",
  igdir: "Iğdır",
  usak: "Uşak",
  canakkale: "Çanakkale",
  corum: "Çorum",
  duzce: "Düzce",
  gumushane: "Gümüşhane",
  kahramanmaras: "Kahramanmaraş",
  kirikkale: "Kırıkkale",
  kirklareli: "Kırklareli",
  kutahya: "Kütahya",
  nevsehir: "Nevşehir",
  nigde: "Niğde",
  tekirdag: "Tekirdağ",
  sanliurfa: "Şanlıurfa",
  sirnak: "Şırnak",
};

const CITY_STORAGE_ALIASES: Record<string, string[]> = {
  "Elazığ": ["Elazığ", "Elaziğ", "Elazig"],
  "Kırşehir": ["Kırşehir", "Kirşehir", "Kirsehir"],
  "İstanbul": ["İstanbul", "Istanbul"],
  "İzmir": ["İzmir", "Izmir"],
};

function cityKey(value: string): string {
  return value
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[İIı]/g, "i")
    .toLocaleLowerCase("tr-TR")
    .replace(/[^a-z0-9]/g, "");
}

export function normalizeCity(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  const key = cityKey(trimmed);
  if (CITY_ALIASES[key]) return CITY_ALIASES[key];
  return trimmed
    .toLocaleLowerCase("tr-TR")
    .replace(/(^|[\s-])\p{L}/gu, (letter) => letter.toLocaleUpperCase("tr-TR"));
}

export function cityStorageAliases(city: string): string[] {
  const canonical = normalizeCity(city);
  const aliases = Object.entries(CITY_ALIASES)
    .filter(([, value]) => value === canonical)
    .map(([key]) => key);
  const values = new Set([
    canonical,
    city.trim(),
    ...aliases,
    cityKey(canonical),
    ...(CITY_STORAGE_ALIASES[canonical] ?? []),
  ]);
  const variants = new Set<string>();
  for (const value of values) {
    variants.add(value);
    variants.add(value.toLocaleLowerCase("tr-TR"));
    variants.add(value.toLocaleUpperCase("tr-TR"));
  }
  return [...variants];
}
