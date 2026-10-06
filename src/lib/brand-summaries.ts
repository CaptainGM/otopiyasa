import { modelFamily, modelFamilyKey } from "@/lib/model-family";
import { isNonCarBrand, normalizeBrand } from "@/lib/normalize-brand";

export interface ModelSummary {
  model: string;
  count: number;
  avgPrice: number;
}

export interface BrandSummary {
  brand: string;
  count: number;
  avgPrice: number;
  topModels: ModelSummary[];
}

interface SummaryCar {
  brand: string;
  model: string;
  price: number;
}

/** Veritabanında önceden gruplanmış satır: aynı marka+model yazımındaki ilan sayısı ve fiyat toplamı. */
export interface BrandModelGroup {
  brand: string;
  model: string;
  count: number;
  priceSum: number;
}

/**
 * Ayrıştırma hatasıyla marka yerine geçen ilan sahibi türleri ("Sahibinden Karavan ..." → marka "Sahibinden").
 * Bunlar marka değildir; grafikte ayrı çubuk olarak görünmemeli.
 */
const NOT_A_BRAND = new Set(["sahibinden", "galeriden", "bilinmiyor", "diğer", "diger"]);

/** Karışık harfli yazım ("Clio") tamamı büyük harfli olandan ("CLIO") okunaklıdır. */
function preferLabel(a: string, b: string): string {
  const mixed = (s: string) => s !== s.toLocaleUpperCase("tr-TR");
  if (mixed(a) !== mixed(b)) return mixed(a) ? a : b;
  return a.length <= b.length ? a : b;
}

/**
 * Marka özetleri. Modeller aileye göre birleştirilir: kaynaklar aynı modeli "CLIO", "Clio" ve
 * "Clio 1.5 dCi Joy" diye yazdığı için eskiden aynı model ayrı satırlarda görünüyordu.
 *
 * @param maxBrands Kaç marka döneceği. Varsayılan sınırsız: grafik yatay
 *   kaydırılabilir olduğu için ilk 12 marka yerine TÜM markalar gösterilir
 *   (kullanıcı Ferrari/Togg/BYD gibi nadir markaları da görmek istiyor).
 * @param topModelCount Tooltip'te gösterilecek en popüler model sayısı.
 */
export function buildBrandSummariesFromGroups(
  groups: BrandModelGroup[],
  maxBrands = Infinity,
  topModelCount = 3
): BrandSummary[] {
  const brands = new Map<
    string,
    { count: number; priceSum: number; models: Map<string, { label: string; count: number; priceSum: number }> }
  >();
  for (const g of groups) {
    if (!g.brand || !(g.count > 0) || !(g.priceSum > 0)) continue;
    const brand = normalizeBrand(g.brand);
    if (!brand || NOT_A_BRAND.has(brand.toLocaleLowerCase("tr-TR")) || isNonCarBrand(brand)) continue;
    const entry = brands.get(brand) || { count: 0, priceSum: 0, models: new Map() };
    entry.count += g.count;
    entry.priceSum += g.priceSum;
    const key = modelFamilyKey(g.model, brand) || "diger";
    const label = modelFamily(g.model, brand) || "Diğer";
    const model = entry.models.get(key);
    if (model) {
      model.count += g.count;
      model.priceSum += g.priceSum;
      model.label = preferLabel(model.label, label);
    } else {
      entry.models.set(key, { label, count: g.count, priceSum: g.priceSum });
    }
    brands.set(brand, entry);
  }

  return [...brands.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, maxBrands)
    .map(([brand, e]) => ({
      brand,
      count: e.count,
      avgPrice: Math.round(e.priceSum / e.count),
      topModels: [...e.models.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, topModelCount)
        .map((m) => ({ model: m.label, count: m.count, avgPrice: Math.round(m.priceSum / m.count) })),
    }));
}

/** Tek tek ilan listesinden marka özetleri (bkz. buildBrandSummariesFromGroups). */
export function buildBrandSummaries(cars: SummaryCar[], maxBrands = Infinity, topModelCount = 3): BrandSummary[] {
  return buildBrandSummariesFromGroups(
    cars.filter((c) => c.price > 0).map((c) => ({ brand: c.brand, model: c.model, count: 1, priceSum: c.price })),
    maxBrands,
    topModelCount
  );
}
