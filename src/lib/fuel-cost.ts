import { normalizeFuelType } from "@/lib/normalize-fuel";
import { pricesForCity, type FuelPrices } from "@/lib/fuel-prices";
import { modelFamilyKey } from "@/lib/model-family";

/**
 * YAKIT MALİYETİ: aracın resmi (katalog) ortalama tüketimi × ilanın ilindeki güncel pompa fiyatı.
 *
 * Tüketim ilandaki "Ort. Yakıt Tüketimi" alanından (lt/100 km) okunur; yoksa aynı marka, model ve
 * motor hacmindeki (yoksa aynı modeldeki) diğer ilanların resmi değerinin medyanı kullanılır
 * (en az 3 örnek; model adı ve motor hacmi kaynaktan bağımsız eşleştirilir, bkz. baseModel). Tahmin
 * uydurulmaz: ikisi de yoksa maliyet gösterilmez. Elektrikli araçlarda kaynaklar kWh vermediği
 * için hesap yapılmaz. MTV ve sigorta bilerek dahil edilmez (sık değişiyor).
 */
export const MIN_CONSUMPTION = 1;
export const MAX_CONSUMPTION = 25;
/** LPG'de litre başına tüketim benzine göre ~%20 fazladır (yakıtın enerji yoğunluğu düşük). */
export const LPG_CONSUMPTION_FACTOR = 1.2;
/** Bunun altındaki resmi hibrit değerleri plug-in (şarjlı) araçlara aittir. */
const PLUG_IN_THRESHOLD = 3;
const MIN_MODEL_SAMPLES = 3;

/** "5,4 lt" → 5.4; tanınmayan ya da gerçek dışı değerler (0,8 lt, 40 lt) → null. */
export function parseConsumption(raw?: string | number | null): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const match = String(raw).match(/\d+(?:[.,]\d+)?/);
  if (!match) return null;
  const value = Number(match[0].replace(",", "."));
  return Number.isFinite(value) && value >= MIN_CONSUMPTION && value <= MAX_CONSUMPTION ? value : null;
}

/** Kasa tipini sınıf karşılaştırması için sadeleştirir ("Suv" ve "SUV" aynı sınıf). */
export function bodyClass(bodyType?: string | null): string | null {
  const v = (bodyType || "").toLocaleLowerCase("tr-TR");
  if (/suv|arazi|crossover/.test(v)) return "SUV";
  if (/sedan/.test(v)) return "Sedan";
  if (/hatchback/.test(v)) return "Hatchback";
  if (/station|kombi|wagon/.test(v)) return "Station wagon";
  if (/coupe|cabrio|roadster|spor/.test(v)) return "Coupe";
  if (/mpv|minivan|van/.test(v)) return "MPV / Van";
  return null;
}

export interface ConsumptionStats {
  /** "marka|model|motor|yakıt" ve "marka|model|yakıt" → resmi tüketim medyanı ve örnek sayısı. */
  model: Record<string, { median: number; count: number }>;
  /** "sınıf|yakıt" ve "yakıt" → medyan. */
  segment: Record<string, { median: number; count: number }>;
}

const lower = (s?: string | null) => (s || "").trim().toLocaleLowerCase("tr-TR");
/** Eşleştirme anahtarı: "QASHQAI" Türkçe küçültülünce "qashqaı" olur; ı→i ve aksanlar (ë, ş) sadeleşir. */
const fold = (s?: string | null) => lower(s).replace(/ı/g, "i").normalize("NFD").replace(/\p{M}/gu, "");
/**
 * Kaynaklar modeli farklı yazar: "Qashqai 1.3 DIG-T Sky Pack", "QASHQAI 1.3DIG-T MHEV" ve "Qashqai"
 * aynı araçtır; filtrelerdeki model ailesiyle aynı anahtar kullanılır (bkz. model-family.ts).
 */
export const baseModel = (model?: string | null): string => modelFamilyKey(model);

/** Metindeki motor hacmi: "1.3 DIG-T", "1.3DIG-T", "2,0 TDI" → 1.3 / 2.0; "166.787 km" gibi sayıları almaz. */
export function engineFromText(...texts: Array<string | null | undefined>): number | null {
  for (const text of texts) {
    const match = (text || "").match(/(?:^|[^\d.,])(\d[.,]\d)(?![\d.,]\d)/);
    if (!match) continue;
    const value = Number(match[1].replace(",", "."));
    if (value >= 0.6 && value <= 7) return value;
  }
  return null;
}

/** "marka|model|motor|yakıt" (motor boşsa yalnızca model) — istatistik ve ilan aynı anahtarla aranır. */
export const modelKey = (brand?: string, model?: string, fuel?: string, engine?: number | null) =>
  [fold(brand), modelFamilyKey(model, brand), engine ? engine.toFixed(1) : "", normalizeFuelType(fuel)].join("|");

/** Motor hacmi önce model/başlık metninden (kaynaklar arasında tutarlı), yoksa ilanın alanından. */
const engineOf = (x: { model?: string; title?: string; engineSize?: number | null }) =>
  engineFromText(x.model, x.title) ?? (x.engineSize || null);

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export interface ConsumptionSample {
  brand?: string;
  model?: string;
  title?: string;
  engineSize?: number | null;
  fuelType?: string;
  bodyType?: string;
  consumption: number;
}

export function buildConsumptionStats(samples: ConsumptionSample[]): ConsumptionStats {
  const groups = { model: new Map<string, number[]>(), segment: new Map<string, number[]>() };
  const push = (map: Map<string, number[]>, key: string, v: number) => {
    const list = map.get(key);
    if (list) list.push(v);
    else map.set(key, [v]);
  };
  for (const s of samples) {
    const fuel = normalizeFuelType(s.fuelType);
    const engine = engineOf(s);
    if (engine) push(groups.model, modelKey(s.brand, s.model, fuel, engine), s.consumption);
    push(groups.model, modelKey(s.brand, s.model, fuel), s.consumption);
    // Plug-in hibritlerin çok düşük resmi değerleri sınıf ortalamasını bozmasın.
    if (fuel === "Hibrit" && s.consumption < PLUG_IN_THRESHOLD) continue;
    const cls = bodyClass(s.bodyType);
    if (cls) push(groups.segment, `${cls}|${fuel}`, s.consumption);
    push(groups.segment, fuel, s.consumption);
  }
  const summarize = (map: Map<string, number[]>) =>
    Object.fromEntries([...map].map(([k, v]) => [k, { median: Math.round(median(v) * 10) / 10, count: v.length }]));
  return { model: summarize(groups.model), segment: summarize(groups.segment) };
}

export interface FuelCostInput {
  brand?: string;
  model?: string;
  title?: string;
  city?: string;
  features?: { fuelType?: string; bodyType?: string; engineSize?: number | null; avgFuelConsumption?: string | null };
}

export interface FuelCost {
  fuelType: string;
  /** Resmi ortalama tüketim, lt/100 km (LPG'li araçta benzin değeri). */
  consumption: number;
  consumptionSource: "ilan" | "model";
  /** Tüketim ilandan değilse nereden alındığı (kartlarda gösterilir). */
  consumptionNote?: string;
  /** Hesapta kullanılan yakıt ve litre fiyatı. */
  priceFuel: "benzin" | "motorin" | "LPG";
  pricePerLiter: number;
  place: string;
  perKm: number;
  per100Km: number;
  /** LPG'li araçta benzinle 100 km maliyeti (karşılaştırma için). */
  petrolPer100Km?: number;
  rating?: "low" | "high";
  ratingText?: string;
  note?: string;
  priceSource: string;
  priceDate: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const FUEL_ADJECTIVE: Record<string, string> = { Benzin: "benzinli", Dizel: "dizel", "LPG & Benzin": "LPG'li", Hibrit: "hibrit" };

export function computeFuelCost(car: FuelCostInput, prices: FuelPrices, stats: ConsumptionStats): FuelCost | null {
  const fuel = normalizeFuelType(car.features?.fuelType);
  if (!["Benzin", "Dizel", "LPG & Benzin", "Hibrit"].includes(fuel)) return null;

  let consumption = parseConsumption(car.features?.avgFuelConsumption);
  let consumptionSource: FuelCost["consumptionSource"] = "ilan";
  let consumptionNote: string | undefined;
  if (consumption === null) {
    const engine = engineOf({ model: car.model, title: car.title, engineSize: car.features?.engineSize });
    const byEngine = engine ? stats.model[modelKey(car.brand, car.model, fuel, engine)] : undefined;
    const byModel = stats.model[modelKey(car.brand, car.model, fuel)];
    if (byEngine && byEngine.count >= MIN_MODEL_SAMPLES) {
      consumption = byEngine.median;
      consumptionNote = `aynı model ve motordaki ${byEngine.count} ilanın resmi değeri`;
    } else if (byModel && byModel.count >= MIN_MODEL_SAMPLES) {
      consumption = byModel.median;
      consumptionNote = `aynı modeldeki ${byModel.count} ilanın resmi değeri`;
    } else {
      return null;
    }
    consumptionSource = "model";
  }

  const local = pricesForCity(prices, car.city);
  const priceFuel: FuelCost["priceFuel"] = fuel === "Dizel" ? "motorin" : fuel === "LPG & Benzin" ? "LPG" : "benzin";
  const pricePerLiter = priceFuel === "motorin" ? local.dizel : priceFuel === "LPG" ? local.lpg : local.benzin;
  if (!pricePerLiter) return null;

  const litersPer100 = priceFuel === "LPG" ? consumption * LPG_CONSUMPTION_FACTOR : consumption;
  const per100Km = round2(litersPer100 * pricePerLiter);
  const result: FuelCost = {
    fuelType: fuel,
    consumption,
    consumptionSource,
    ...(consumptionNote ? { consumptionNote } : {}),
    priceFuel,
    pricePerLiter,
    place: local.place,
    perKm: round2(per100Km / 100),
    per100Km,
    priceSource: prices.source,
    priceDate: new Date(prices.fetchedAt).toISOString(),
  };
  if (priceFuel === "LPG" && local.benzin) result.petrolPer100Km = round2(consumption * local.benzin);

  const plugIn = fuel === "Hibrit" && consumption < PLUG_IN_THRESHOLD;
  if (plugIn) {
    result.note = "Plug-in hibrit: resmi değer şarjla yapılan sürüşü de içerir; batarya boşken tüketim daha yüksektir.";
    return result;
  }

  const cls = bodyClass(car.features?.bodyType);
  const segment = (cls && stats.segment[`${cls}|${fuel}`]) || stats.segment[fuel];
  if (segment && segment.count >= 20) {
    const ratio = consumption / segment.median;
    const adj = FUEL_ADJECTIVE[fuel] || fuel;
    const label = cls ? `${cls} sınıfındaki ${adj} araçların` : `${adj} araçların`;
    const avg = segment.median.toLocaleString("tr-TR", { maximumFractionDigits: 1 });
    if (ratio <= 0.85) {
      result.rating = "low";
      result.ratingText = `Az yakıyor: ${label} ortalaması ${avg} lt/100 km.`;
    } else if (ratio >= 1.2) {
      result.rating = "high";
      result.ratingText = `Yakıt tüketimi yüksek: ${label} ortalaması ${avg} lt/100 km.`;
    }
  }
  return result;
}
