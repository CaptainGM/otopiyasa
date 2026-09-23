

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

function average(prices: number[]) {
  return Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length);
}

/**
 * @param maxBrands Kaç marka döneceği. Varsayılan sınırsız: grafik yatay
 *   kaydırılabilir olduğu için ilk 12 marka yerine TÜM markalar gösterilir
 *   (kullanıcı Ferrari/Togg/BYD gibi nadir markaları da görmek istiyor).
 * @param topModelCount Tooltip'te gösterilecek en popüler model sayısı.
 */
export function buildBrandSummaries(
  cars: SummaryCar[],
  maxBrands = Infinity,
  topModelCount = 3
): BrandSummary[] {
  const byBrand = new Map<string, SummaryCar[]>();
  for (const car of cars) {
    if (!car.brand || !(car.price > 0)) continue;
    if (!byBrand.has(car.brand)) byBrand.set(car.brand, []);
    byBrand.get(car.brand)!.push(car);
  }

  return [...byBrand.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, maxBrands)
    .map(([brand, list]) => {
      const byModel = new Map<string, number[]>();
      for (const car of list) {
        const model = car.model || "Diğer";
        if (!byModel.has(model)) byModel.set(model, []);
        byModel.get(model)!.push(car.price);
      }

      const topModels = [...byModel.entries()]
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, topModelCount)
        .map(([model, prices]) => ({
          model,
          count: prices.length,
          avgPrice: average(prices),
        }));

      return {
        brand,
        count: list.length,
        avgPrice: average(list.map((car) => car.price)),
        topModels,
      };
    });
}
