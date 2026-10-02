import * as cheerio from "cheerio";
import type { FuelPriceCity, FuelPriceDoc } from "@/models/FuelPrice";

/**
 * GÜNLÜK AKARYAKIT FİYATLARI (ücretsiz, anahtarsız kaynaklar)
 *
 *  1. Petrol Ofisi fiyat sayfası: tek istekte 81 il için vergili benzin, motorin ve otogaz (LPG).
 *  2. Yedek: Opet'in herkese açık fiyat uç noktası (İstanbul benzin/motorin; LPG vermiyor).
 *
 * Fiyatlar veritabanında tek belgede tutulur; 3 saatten eskiyse sayfa/uygulama okurken yenilenir,
 * 7/24 motor ise her turda saatlik kontrol eder (zamlar gün içinde de gelebiliyor). Kaynağa
 * ulaşılamazsa son bilinen fiyat kullanılır; belgenin saati kartta Türkiye saatiyle gösterilir.
 */
export const FUEL_PRICE_MAX_AGE_MS = 3 * 60 * 60 * 1000;
/** Motorun yenileme eşiği: sayfa okumasından daha sıkı, böylece okuyan kimse beklemez. */
export const FUEL_PRICE_DAEMON_MAX_AGE_MS = 60 * 60 * 1000;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/** "İstanbul" → "ISTANBUL", "Kahramanmaraş" → "KAHRAMANMARAS". */
export function cityKey(name: string): string {
  return (name || "")
    .replace(/İ/g, "I").replace(/ı/g, "i")
    .replace(/Ş/g, "S").replace(/ş/g, "s")
    .replace(/Ğ/g, "G").replace(/ğ/g, "g")
    .replace(/Ü/g, "U").replace(/ü/g, "u")
    .replace(/Ö/g, "O").replace(/ö/g, "o")
    .replace(/Ç/g, "C").replace(/ç/g, "c")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

const toPrice = (text: string) => {
  const n = Number(text.replace(",", ".").trim());
  return Number.isFinite(n) && n > 5 && n < 500 ? Math.round(n * 100) / 100 : undefined;
};

/** Fiyat sayfasındaki il satırlarını okur; sütunlar başlık metninden bulunur (sıra değişirse bozulmasın). */
export function parsePetrolOfisiPrices(html: string): FuelPriceCity[] {
  const $ = cheerio.load(html);
  const headers = $("th").map((_, el) => $(el).text().trim().toLocaleLowerCase("tr-TR")).get();
  const col = (re: RegExp) => headers.findIndex((h) => re.test(h));
  const benzinCol = col(/kurşunsuz|benzin/);
  const dizelCol = col(/diesel|motorin|dizel/);
  const lpgCol = col(/otogaz|lpg/);
  if (benzinCol < 1 || dizelCol < 1) return [];

  const cities: FuelPriceCity[] = [];
  $("tr.price-row").each((_, row) => {
    const cells = $(row).find("td");
    const name = (($(row).attr("data-disctrict-name") || cells.eq(0).text()) as string).trim();
    const price = (i: number) => (i >= 1 ? toPrice(cells.eq(i).find(".with-tax").first().text()) : undefined);
    const city: FuelPriceCity = { key: cityKey(name), name, benzin: price(benzinCol), dizel: price(dizelCol), lpg: price(lpgCol) };
    if (city.name && (city.benzin || city.dizel)) cities.push(city);
  });
  return cities;
}

export function averagePrices(cities: FuelPriceCity[]): FuelPriceDoc["average"] {
  const avg = (key: "benzin" | "dizel" | "lpg") => {
    const values = cities.map((c) => c[key]).filter((v): v is number => typeof v === "number");
    return values.length ? Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 100) / 100 : undefined;
  };
  return { benzin: avg("benzin"), dizel: avg("dizel"), lpg: avg("lpg") };
}

async function fetchFromPetrolOfisi(): Promise<FuelPriceCity[]> {
  const res = await fetch("https://www.petrolofisi.com.tr/akaryakit-fiyatlari", {
    headers: { "User-Agent": UA, "Accept-Language": "tr-TR,tr;q=0.9" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parsePetrolOfisiPrices(await res.text());
}

async function fetchFromOpet(): Promise<FuelPriceCity[]> {
  const res = await fetch("https://api.opet.com.tr/api/fuelprices/prices?ProvinceCode=34&IncludeAllProducts=true", {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const districts = (await res.json()) as Array<{ prices?: Array<{ productName?: string; amount?: number }> }>;
  const prices = districts[0]?.prices || [];
  const find = (re: RegExp) => toPrice(String(prices.find((p) => re.test(p.productName || ""))?.amount ?? ""));
  const city: FuelPriceCity = { key: "ISTANBUL", name: "İstanbul", benzin: find(/benzin/i), dizel: find(/motorin/i) };
  return city.benzin || city.dizel ? [city] : [];
}

/** Kaynaklardan güncel fiyatları çeker; ikisi de başarısızsa hata fırlatır. */
export async function fetchFuelPrices(): Promise<{ source: string; cities: FuelPriceCity[] }> {
  try {
    const cities = await fetchFromPetrolOfisi();
    if (cities.length >= 10) return { source: "Petrol Ofisi", cities };
  } catch {
    // yedek kaynağa geç
  }
  const cities = await fetchFromOpet();
  if (cities.length === 0) throw new Error("Akaryakıt fiyatı kaynaklarına ulaşılamadı.");
  return { source: "Opet", cities };
}

export interface FuelPrices {
  source: string;
  fetchedAt: Date;
  cities: FuelPriceCity[];
  average: FuelPriceDoc["average"];
}

let refreshing: Promise<FuelPrices | null> | null = null;

/** Veritabanındaki fiyatları kaynaktan yeniler (aynı anda tek yenileme). */
export async function refreshFuelPrices(): Promise<FuelPrices | null> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const { FuelPrice } = await import("@/models/FuelPrice");
    const { source, cities } = await fetchFuelPrices();
    const doc = { name: "latest", source, fetchedAt: new Date(), cities, average: averagePrices(cities) };
    await FuelPrice.updateOne({ name: "latest" }, { $set: doc }, { upsert: true });
    return doc;
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

/** Güncel fiyatlar; belirtilen süreden eskiyse (varsayılan 3 saat) yenilemeyi dener, olmazsa son bilinen fiyatı döndürür. */
export async function getFuelPrices(maxAgeMs = FUEL_PRICE_MAX_AGE_MS): Promise<FuelPrices | null> {
  const { FuelPrice } = await import("@/models/FuelPrice");
  const stored = await FuelPrice.findOne({ name: "latest" }).lean<FuelPrices | null>();
  if (stored && Date.now() - new Date(stored.fetchedAt).getTime() < maxAgeMs) return stored;
  try {
    return (await refreshFuelPrices()) || stored;
  } catch {
    return stored;
  }
}

/** İlanın ilindeki fiyat; il bulunamazsa (ya da o yakıt yoksa) ülke ortalaması. */
/** Fiyat sayfasındaki kısa/eski il adları. */
const CITY_ALIASES: Record<string, string> = { AFYONKARAHISAR: "AFYON", ICEL: "MERSIN" };

export function pricesForCity(prices: FuelPrices, city?: string): { benzin?: number; dizel?: number; lpg?: number; place: string } {
  // "Mersin(İçel)" gibi parantezli yazımlar da eşleşsin.
  const plain = cityKey(city || "").replace(/\s*\(.*\)\s*$/, "");
  const key = CITY_ALIASES[plain] || plain;
  const matches = key ? prices.cities.filter((c) => c.key === key || c.key.startsWith(`${key} `)) : [];
  const pick = (k: "benzin" | "dizel" | "lpg") => {
    const values = matches.map((c) => c[k]).filter((v): v is number => typeof v === "number");
    return values.length ? Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 100) / 100 : prices.average[k];
  };
  return { benzin: pick("benzin"), dizel: pick("dizel"), lpg: pick("lpg"), place: matches.length ? city || "" : "Türkiye ortalaması" };
}
