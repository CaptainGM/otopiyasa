import { normalizeFuelType, PLUG_IN_TEXT } from "@/lib/normalize-fuel";
import { pricesForCity, type FuelPrices } from "@/lib/fuel-prices";
import { modelFamilyKey } from "@/lib/model-family";

/**
 * YAKIT MALİYETİ: aracın resmi (katalog) ortalama tüketimi × ilanın ilindeki güncel pompa fiyatı.
 *
 * Tüketim ilandaki "Ort. Yakıt Tüketimi" alanından (lt/100 km) okunur; yoksa aynı marka, model ve
 * motor hacmindeki (yoksa aynı modeldeki) diğer ilanların resmi değerinin medyanı kullanılır
 * (en az 3 örnek; model adı ve motor hacmi kaynaktan bağımsız eşleştirilir, bkz. baseModel). O da
 * yoksa aynı sınıftaki (kasa + yakıt) araçların medyanı "tahmini" diye etiketlenerek kullanılır
 * (en az 20 örnek). Elektrikli araçlarda kaynaklar kWh vermediği için sınıfına göre tipik kWh
 * değeri alınır ve kartta tahmin olduğu yazılır. MTV ve sigorta bilerek dahil edilmez (sık değişiyor).
 */
export const MIN_CONSUMPTION = 1;
export const MAX_CONSUMPTION = 25;
/** LPG'de litre başına tüketim benzine göre ~%20 fazladır (yakıtın enerji yoğunluğu düşük). */
export const LPG_CONSUMPTION_FACTOR = 1.2;
/** Bunun altındaki resmi hibrit değerleri plug-in (şarjlı) araçlara aittir. */
const PLUG_IN_THRESHOLD = 3;
const MIN_MODEL_SAMPLES = 3;
/** Sınıf ortalamasının tahmin olarak kullanılabilmesi için gereken en az ilan sayısı. */
const MIN_SEGMENT_SAMPLES = 20;

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

/**
 * ŞARJLI (PLUG-IN) HİBRİT: resmi 1–1,5 lt/100 km değeri bataryanın şarjlı olduğunu varsayar; elektrik
 * maliyeti ayrıca vardır. Birçok ilan bu araçları "Benzin" yazıyor, bu yüzden başlıktaki ifadeye
 * de bakılır; "Hibrit" yazılıp resmi tüketimi 3 lt altında olanlar da şarjlıdır.
 */
export function isPlugInHybrid(
  car: { model?: string; title?: string; features?: { fuelType?: string } },
  consumption?: number | null
): boolean {
  if (PLUG_IN_TEXT.test(`${car.model || ""} ${car.title || ""}`)) return true;
  return normalizeFuelType(car.features?.fuelType) === "Hibrit" && consumption != null && consumption < PLUG_IN_THRESHOLD;
}

/**
 * Elektrik fiyatı ve tüketimi için varsayımlar. Akaryakıttan farklı olarak elektrik için günlük,
 * herkese açık resmi bir fiyat akışı yok (tarifeler üç ayda bir EPDK kararıyla değişir, şarj ağları
 * kendi fiyatını koyar); bu yüzden değerler burada açık varsayım olarak durur ve kartta etiketlenir.
 * Her üç ayda bir gözden geçirilir (son: Ağustos 2026 şarj ağı ve tarife duyuruları).
 */
export const ELECTRICITY = {
  /** Evde gece tarifesi, ₺/kWh. */
  homePerKwh: 3.3,
  /** Halka açık AC şarj (9,90–11 ₺ aralığının ortası), ₺/kWh. */
  publicAcPerKwh: 10.5,
  /** Şarjlı hibritlerin resmi ağırlıklı elektrik tüketimi 13–19 kWh/100 km arasındadır; ortası. */
  kwhPer100Km: 16,
  /** Elektrikli araçlar: ilanlar kWh vermiyor; binek için tipik değer ve SUV/van için daha yüksek değer, kWh/100 km. */
  evKwhPer100Km: 17,
  evLargeKwhPer100Km: 21,
  reviewed: "Ağustos 2026",
} as const;

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
    // "Benzin" yazılmış şarjlı hibrit de hibrit anahtarında tutulur: aynı motorlu benzinli sürümün
    // ve sınıf ortalamalarının değerini 1 lt'ye çekmesin.
    const plugIn = isPlugInHybrid({ model: s.model, title: s.title, features: { fuelType: s.fuelType } }, s.consumption);
    const fuel = plugIn ? "Hibrit" : normalizeFuelType(s.fuelType);
    const engine = engineOf(s);
    if (engine) push(groups.model, modelKey(s.brand, s.model, fuel, engine), s.consumption);
    push(groups.model, modelKey(s.brand, s.model, fuel), s.consumption);
    // Plug-in hibritlerin çok düşük resmi değerleri sınıf ortalamasını bozmasın.
    if (plugIn) continue;
    // Benzinli/dizel araçta 3 lt altı resmi değer yoktur (kaynak hatası ya da şarjlı hibrit); ortalamaya girmez.
    if (fuel !== "Hibrit" && s.consumption < PLUG_IN_THRESHOLD) continue;
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
  consumptionSource: "ilan" | "model" | "sinif";
  /** Tüketim ilandan değilse nereden alındığı (kartlarda gösterilir). */
  consumptionNote?: string;
  /** Hesapta kullanılan yakıt ve litre fiyatı. */
  priceFuel: "benzin" | "motorin" | "LPG" | "elektrik";
  pricePerLiter: number;
  place: string;
  perKm: number;
  per100Km: number;
  /** LPG'li araçta benzinle 100 km maliyeti (karşılaştırma için). */
  petrolPer100Km?: number;
  /** Şarjlı hibrit: `perKm`/`per100Km` evde şarjla benzin + elektriği içerir; diğer senaryolar burada. */
  plugIn?: {
    electricKwhPer100: number;
    homePricePerKwh: number;
    publicPricePerKwh: number;
    /** Yalnızca benzin payı (resmi tüketim × litre fiyatı), 100 km. */
    fuelPer100Km: number;
    /** Yalnızca elektrik payı, evde şarjla, 100 km. */
    electricPer100Km: number;
    perKmPublicCharge: number;
    /** Batarya bitince sınıfındaki benzinli araç gibi yakar; sınıf ortalaması yoksa yok. */
    perKmEmptyBattery?: number;
    emptyBatteryConsumption?: number;
    electricityReviewed: string;
  };
  /** Elektrikli araç: `perKm`/`per100Km` evde şarjla; `consumption` kWh/100 km, `pricePerLiter` ₺/kWh'dir. */
  electric?: {
    kwhPer100: number;
    homePricePerKwh: number;
    publicPricePerKwh: number;
    perKmPublicCharge: number;
    electricityReviewed: string;
  };
  rating?: "low" | "high";
  ratingText?: string;
  note?: string;
  priceSource: string;
  priceDate: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const FUEL_ADJECTIVE: Record<string, string> = { Benzin: "benzinli", Dizel: "dizel", "LPG & Benzin": "LPG'li", Hibrit: "hibrit" };

/**
 * Elektrikli araç: ilanlarda kWh/100 km yok, sınıfına göre tipik değer alınır (SUV ve van daha çok çeker).
 * Evde şarj `perKm`'dir; halka açık şarj ayrıca yazılır. Hepsi tahmindir, kart bunu söyler.
 */
function computeElectricCost(car: FuelCostInput, prices: FuelPrices): FuelCost {
  const cls = bodyClass(car.features?.bodyType);
  const large = cls === "SUV" || cls === "MPV / Van";
  const kwh = large ? ELECTRICITY.evLargeKwhPer100Km : ELECTRICITY.evKwhPer100Km;
  const per100Km = round2(kwh * ELECTRICITY.homePerKwh);
  return {
    fuelType: "Elektrik",
    consumption: kwh,
    consumptionSource: "sinif",
    consumptionNote: `ilanda kWh bilgisi yok; ${large ? "SUV ve van" : "binek"} araçlar için tipik değer, tahmini`,
    priceFuel: "elektrik",
    pricePerLiter: ELECTRICITY.homePerKwh,
    place: "Türkiye",
    perKm: round2(per100Km / 100),
    per100Km,
    electric: {
      kwhPer100: kwh,
      homePricePerKwh: ELECTRICITY.homePerKwh,
      publicPricePerKwh: ELECTRICITY.publicAcPerKwh,
      perKmPublicCharge: round2((kwh * ELECTRICITY.publicAcPerKwh) / 100),
      electricityReviewed: ELECTRICITY.reviewed,
    },
    note:
      "İlanda elektrik tüketimi yok; araç sınıfına göre tipik değer alındı. Elektrik fiyatları tahminidir " +
      `(${ELECTRICITY.reviewed} itibarıyla), pompa fiyatı gibi günlük güncellenmez.`,
    priceSource: "tahmini tarife",
    priceDate: new Date(prices.fetchedAt).toISOString(),
  };
}

export function computeFuelCost(car: FuelCostInput, prices: FuelPrices, stats: ConsumptionStats): FuelCost | null {
  let consumption = parseConsumption(car.features?.avgFuelConsumption);
  let plugIn = isPlugInHybrid(car, consumption);
  const fuel = plugIn ? "Hibrit" : normalizeFuelType(car.features?.fuelType);
  if (fuel === "Elektrik") return computeElectricCost(car, prices);
  if (!["Benzin", "Dizel", "LPG & Benzin", "Hibrit"].includes(fuel)) return null;

  let consumptionSource: FuelCost["consumptionSource"] = "ilan";
  let consumptionNote: string | undefined;
  if (consumption === null) {
    const engine = engineOf({ model: car.model, title: car.title, engineSize: car.features?.engineSize });
    const byEngine = engine ? stats.model[modelKey(car.brand, car.model, fuel, engine)] : undefined;
    const byModel = stats.model[modelKey(car.brand, car.model, fuel)];
    if (byEngine && byEngine.count >= MIN_MODEL_SAMPLES) {
      consumption = byEngine.median;
      consumptionNote = `aynı model ve motordaki ${byEngine.count} ilanın resmi değeri`;
      consumptionSource = "model";
    } else if (byModel && byModel.count >= MIN_MODEL_SAMPLES) {
      consumption = byModel.median;
      consumptionNote = `aynı modeldeki ${byModel.count} ilanın resmi değeri`;
      consumptionSource = "model";
    } else {
      // Model için yeterli örnek yok: aynı sınıftaki (kasa + yakıt) araçların medyanı, tahmin diye etiketlenerek.
      // Başlığında şarjlı hibrit yazan araçta sınıf ortalaması yanıltır (1 lt'ye karşı 5 lt), orada göstermeyiz.
      if (plugIn) return null;
      const cls = bodyClass(car.features?.bodyType);
      const adj = FUEL_ADJECTIVE[fuel] || fuel;
      const classStat = cls ? stats.segment[`${cls}|${fuel}`] : undefined;
      const wide = stats.segment[fuel];
      if (classStat && classStat.count >= MIN_SEGMENT_SAMPLES) {
        consumption = classStat.median;
        consumptionNote = `ilanda resmi değer yok; ${cls} sınıfındaki ${adj} ${classStat.count} ilanın ortalaması, tahmini`;
      } else if (wide && wide.count >= MIN_SEGMENT_SAMPLES) {
        consumption = wide.median;
        consumptionNote = `ilanda resmi değer yok; ${adj} ${wide.count} ilanın ortalaması, tahmini`;
      } else {
        return null;
      }
      consumptionSource = "sinif";
    }
    // Tüketim model istatistiğinden geldiyse şarjlı hibrit tespiti onunla da yapılır.
    plugIn = plugIn || isPlugInHybrid(car, consumption);
  }

  // Benzinli/dizel/LPG'li araçta 3 lt altı resmi değer gerçek değildir (kaynak hatası ya da başlıkta
  // belirtilmemiş şarjlı hibrit); yanlış bir maliyet yazmaktansa göstermeyiz.
  if (!plugIn && fuel !== "Hibrit" && consumption < PLUG_IN_THRESHOLD) return null;

  const local = pricesForCity(prices, car.city);
  const priceFuel: FuelCost["priceFuel"] = fuel === "Dizel" ? "motorin" : fuel === "LPG & Benzin" ? "LPG" : "benzin";
  const pricePerLiter = priceFuel === "motorin" ? local.dizel : priceFuel === "LPG" ? local.lpg : local.benzin;
  if (!pricePerLiter) return null;

  const litersPer100 = priceFuel === "LPG" ? consumption * LPG_CONSUMPTION_FACTOR : consumption;
  const fuelPer100Km = round2(litersPer100 * pricePerLiter);
  // Şarjlı hibrit: benzin payına elektrik de eklenir (evde şarj); 100 km başına toplam yazılır.
  const electricPer100Km = plugIn ? round2(ELECTRICITY.kwhPer100Km * ELECTRICITY.homePerKwh) : 0;
  const per100Km = round2(fuelPer100Km + electricPer100Km);
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

  const cls = bodyClass(car.features?.bodyType);
  if (plugIn) {
    // Batarya bitince sınıfındaki benzinli araç gibi yakar; sınıf ortalaması yoksa bu satır gösterilmez.
    const petrolClass = (cls && stats.segment[`${cls}|Benzin`]) || stats.segment["Benzin"];
    const emptyBattery = petrolClass && petrolClass.count >= 20 && local.benzin ? petrolClass : undefined;
    result.plugIn = {
      electricKwhPer100: ELECTRICITY.kwhPer100Km,
      homePricePerKwh: ELECTRICITY.homePerKwh,
      publicPricePerKwh: ELECTRICITY.publicAcPerKwh,
      fuelPer100Km,
      electricPer100Km,
      perKmPublicCharge: round2((fuelPer100Km + ELECTRICITY.kwhPer100Km * ELECTRICITY.publicAcPerKwh) / 100),
      ...(emptyBattery && local.benzin
        ? { perKmEmptyBattery: round2((emptyBattery.median * local.benzin) / 100), emptyBatteryConsumption: emptyBattery.median }
        : {}),
      electricityReviewed: ELECTRICITY.reviewed,
    };
    result.note =
      "Şarjlı hibrit: resmi tüketim bataryanın şarjlı olduğunu varsayar. İlanda elektrik tüketimi yok; " +
      `${ELECTRICITY.kwhPer100Km} kWh/100 km tipik değeriyle elektrik maliyeti eklendi.`;
    return result;
  }

  const segment = (cls && stats.segment[`${cls}|${fuel}`]) || stats.segment[fuel];
  // Tüketim zaten sınıf ortalamasından alındıysa "ortalamaya göre az/çok yakıyor" demenin anlamı yok.
  if (segment && segment.count >= 20 && consumptionSource !== "sinif") {
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
