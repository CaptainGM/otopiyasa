import { normalizeFuelType } from "@/lib/normalize-fuel";
import { normalizeColor } from "@/lib/normalize-color";

/**
 * Arabam liste sayfaları (marka/model sayfaları, `?page=` ile) görünen tabloda vites ve yakıt sütunu
 * göstermez, ama sayfaya gömülü `var model = {...}` verisinde her ilanın vitesi, yakıtı, rengi, yılı, km'si
 * ve fiyatı yazılıdır. Toplu çekim eskiden yalnızca tabloyu okuyup vitesi başlıktan tahmin ediyordu
 * (başlıkta "otomatik" yoksa "Manuel"); doğru veri hep bu JSON'daydı.
 *
 * Aynı veride modelin filtre sayıları da vardır (ör. Kasa tipi: SUV 613, Crossover 1).
 */

export interface ArabamListDoc {
  /** Kaynaktaki ilan numarası. */
  id: string;
  url: string;
  year: number | null;
  mileage: number | null;
  /** Yalnızca TL fiyat; başka para birimi ya da okunamayan fiyat null. */
  price: number | null;
  /** "Otomatik" | "Manuel" | "Yarı Otomatik" */
  transmission: string | null;
  fuelType: string | null;
  color: string | null;
  city: string | null;
  /** Kaynağın model sayfası yolu, ör. "arazi-suv-pick-up/chevrolet-captiva". */
  modelPath: string | null;
}

export interface ArabamListPage {
  docs: ArabamListDoc[];
  total: number | null;
  totalPages: number | null;
  /** Kasa tipi filtre sayıları (kaynağın kendi yazımıyla). */
  bodyTypes: { value: string; count: number }[];
}

/** `start` konumundaki { veya [ ile açılan JSON değerinin bittiği konumu bulur (metin içindeki ayraçları saymaz). */
export function jsonValueEnd(text: string, start: number): number {
  const open = text[start];
  const close = open === "{" ? "}" : open === "[" ? "]" : "";
  if (!close) return -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{" || ch === "[") depth++;
    else if (ch === "}" || ch === "]") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function embeddedModel(html: string): Record<string, unknown> | null {
  const marker = html.indexOf("var model = ");
  if (marker < 0) return null;
  const start = html.indexOf("{", marker);
  const end = start >= 0 ? jsonValueEnd(html, start) : -1;
  if (end < 0) return null;
  try {
    return JSON.parse(html.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** İç içe nesnede ilk eşleşen değeri bulur (kaynağın veri düzeni değişirse kırılmasın diye yol sabitlenmez). */
function findDeep(node: unknown, test: (key: string, value: unknown) => boolean, depth = 0): unknown {
  if (!node || typeof node !== "object" || depth > 8) return undefined;
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (test(key, value)) return value;
  }
  for (const value of Object.values(node as Record<string, unknown>)) {
    const found = findDeep(value, test, depth + 1);
    if (found !== undefined) return found;
  }
  return undefined;
}

const digits = (value: unknown) => {
  const n = Number(String(value ?? "").replace(/\D/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};

export function normalizeArabamGear(raw?: string | null): string | null {
  const v = (raw || "").trim().toLocaleLowerCase("tr-TR");
  if (!v) return null;
  if (v.startsWith("yarı") || v.startsWith("yari")) return "Yarı Otomatik";
  if (v === "otomatik") return "Otomatik";
  if (v === "düz" || v === "duz" || v === "manuel") return "Manuel";
  return null;
}

function toDoc(raw: Record<string, any>): ArabamListDoc | null {
  const id = raw?.Id != null ? String(raw.Id) : "";
  const path = typeof raw?.Url === "string" ? raw.Url : "";
  if (!/^\d{5,}$/.test(id) || !path.startsWith("/ilan/")) return null;

  const props = new Map<string, string>();
  for (const p of Array.isArray(raw.DetailedProperties) ? raw.DetailedProperties : []) {
    if (p && typeof p.Key === "string" && typeof p.Value === "string") props.set(p.Key.toLocaleLowerCase("tr-TR"), p.Value);
  }
  const colorProp = (Array.isArray(raw.PropertyListWithKey) ? raw.PropertyListWithKey : []).find(
    (p: any) => p && p.Name === "Renk" && typeof p.Description === "string"
  );
  const fuelRaw = props.get("yakıt tipi");
  const fuel = fuelRaw ? normalizeFuelType(fuelRaw) : null;
  const priceText = typeof raw.FormattedPrice === "string" ? raw.FormattedPrice : "";
  const categories: any[] = Array.isArray(raw.Categories) ? raw.Categories : [];
  const modelPath = categories[2]?.AbsolutePath;

  return {
    id,
    url: `https://www.arabam.com${path}`,
    year: Number.isInteger(raw.Year) && raw.Year > 1900 ? raw.Year : null,
    mileage: digits(raw.Km ?? props.get("kilometre")),
    price: /\bTL\b/.test(priceText) ? digits(priceText) : null,
    transmission: normalizeArabamGear(props.get("vites tipi")),
    fuelType: fuel && fuel !== "Bilinmiyor" ? fuel : null,
    color: colorProp?.Description?.trim() ? normalizeColor(colorProp.Description) : null,
    city: typeof raw.City === "string" && raw.City.trim() ? raw.City.trim() : null,
    modelPath: typeof modelPath === "string" && modelPath.includes("/") ? modelPath : null,
  };
}

/** Liste sayfası HTML'inden ilanları ve modelin kasa tipi sayımını çıkarır. Veri bulunamazsa boş döner. */
export function parseArabamListPage(html: string): ArabamListPage {
  const empty: ArabamListPage = { docs: [], total: null, totalPages: null, bodyTypes: [] };
  const model = embeddedModel(html);
  if (!model) return empty;

  const rawDocs = findDeep(model, (k, v) => k === "Documents" && Array.isArray(v)) as Record<string, any>[] | undefined;
  const holder = (
    "TotalPages" in model ? model : findDeep(model, (_k, v) => !!v && typeof v === "object" && "TotalPages" in (v as object))
  ) as { Total?: unknown; TotalPages?: unknown } | undefined;
  const bodyFacet = findDeep(
    model,
    (_k, v) => !!v && typeof v === "object" && (v as any).Name === "Kasa tipi" && Array.isArray((v as any).Items)
  ) as { Items: any[] } | undefined;

  const docs = (rawDocs || []).map(toDoc).filter((d): d is ArabamListDoc => d !== null);
  const total = Number(holder?.Total);
  const totalPages = Number(holder?.TotalPages);
  return {
    docs,
    total: Number.isInteger(total) && total >= 0 ? total : null,
    totalPages: Number.isInteger(totalPages) && totalPages >= 0 ? totalPages : null,
    bodyTypes: (bodyFacet?.Items || [])
      .map((it) => ({ value: String(it?.Value ?? it?.Name ?? "").trim(), count: Number(it?.Count) || 0 }))
      .filter((it) => it.value && it.count > 0),
  };
}

/**
 * Modelin kasa tipi tek başına belirleyiciyse (ör. Captiva: 613 SUV, 1 Crossover → SUV) o kasa tipini döndürür.
 * Birden çok kasa tipi olan modellerde (Egea: sedan/hatchback/station) null: ilan bazında bilinmez.
 */
export function dominantBodyType(
  bodyTypes: { value: string; count: number }[],
  normalize: (raw: string) => string | null,
  minShare = 0.97,
  minCount = 5
): string | null {
  const byLabel = new Map<string, number>();
  let total = 0;
  for (const { value, count } of bodyTypes) {
    total += count;
    const label = normalize(value);
    if (label) byLabel.set(label, (byLabel.get(label) || 0) + count);
  }
  if (total < minCount) return null;
  const [label, count] = [...byLabel.entries()].sort((a, b) => b[1] - a[1])[0] || [];
  return label && count / total >= minShare ? label : null;
}
