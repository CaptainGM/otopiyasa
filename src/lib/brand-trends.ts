

const TURKISH_MONTHS: Record<string, number> = {
  ocak: 0,
  şubat: 1,
  mart: 2,
  nisan: 3,
  mayıs: 4,
  haziran: 5,
  temmuz: 6,
  ağustos: 7,
  eylül: 8,
  ekim: 9,
  kasım: 10,
  aralık: 11,
};

const MONTH_LABELS = [
  "Oca", "Şub", "Mar", "Nis", "May", "Haz",
  "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara",
];

export function parseTurkishDate(value: string | undefined): Date | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d{1,2})\s+(\S+)\s+(\d{4})$/);
  if (!match) return null;
  const month = TURKISH_MONTHS[match[2].toLocaleLowerCase("tr-TR")];
  if (month === undefined) return null;
  return new Date(Number(match[3]), month, Number(match[1]));
}

export interface TrendCar {
  brand: string;
  price: number;
  listingDate?: string;
  createdAt?: Date | string;
}

export interface BrandTrendPoint {
  month: string; 
  [brand: string]: string | number | null;
}

export interface BrandTrends {
  brands: string[];
  points: BrandTrendPoint[];
}


export function buildBrandTrends(cars: TrendCar[], maxBrands = 5): BrandTrends {
  const dated = cars
    .map((car) => {
      const date =
        parseTurkishDate(car.listingDate) ||
        (car.createdAt ? new Date(car.createdAt) : null);
      return date && !isNaN(date.getTime()) && car.price > 0
        ? { brand: car.brand, price: car.price, date }
        : null;
    })
    .filter((entry): entry is { brand: string; price: number; date: Date } => entry !== null);

  const brandCounts = new Map<string, number>();
  for (const entry of dated) {
    brandCounts.set(entry.brand, (brandCounts.get(entry.brand) || 0) + 1);
  }
  const brands = [...brandCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxBrands)
    .map(([brand]) => brand);

  
  const byMonth = new Map<string, Map<string, number[]>>();
  for (const entry of dated) {
    if (!brands.includes(entry.brand)) continue;
    const key = `${entry.date.getFullYear()}-${String(entry.date.getMonth()).padStart(2, "0")}`;
    if (!byMonth.has(key)) byMonth.set(key, new Map());
    const brandMap = byMonth.get(key)!;
    if (!brandMap.has(entry.brand)) brandMap.set(entry.brand, []);
    brandMap.get(entry.brand)!.push(entry.price);
  }

  const points = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, brandMap]) => {
      const [year, month] = key.split("-").map(Number);
      const point: BrandTrendPoint = {
        month: `${MONTH_LABELS[month]} ${String(year).slice(2)}`,
      };
      for (const brand of brands) {
        const prices = brandMap.get(brand);
        point[brand] = prices
          ? Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length)
          : null;
      }
      return point;
    });

  return { brands, points };
}
