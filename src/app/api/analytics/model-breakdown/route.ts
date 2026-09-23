import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { getBrandModelOptions } from "@/lib/brand-models";
import { PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";
import { checkSharedRateLimit } from "@/lib/api-rate-limit";
import { escapeRegExp } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limited = await checkSharedRateLimit(request, "model-breakdown", { limit: 20, windowMs: 10 * 60 * 1000 });
  if (limited) return limited;

  const url = new URL(request.url);
  const brand = url.searchParams.get("brand")?.trim();
  const model = url.searchParams.get("model")?.trim();

  if ((brand && brand.length > 80) || (model && model.length > 80)) {
    return NextResponse.json({ error: "Marka ve model en fazla 80 karakter olabilir." }, { status: 400 });
  }

  await connectDB();
  const options = await getBrandModelOptions();

  if (!brand || !model) {
    return NextResponse.json({
      brands: options.brands,
      brandModels: options.brandModels,
    });
  }

  const cars = await Car.find(
    {
      ...PUBLIC_LISTING_FILTER,
      brand: new RegExp(`^${escapeRegExp(brand)}$`, "i"),
      model: new RegExp(`^${escapeRegExp(model)}$`, "i"),
      price: { $gte: 50_000, $lte: 40_000_000 },
    },
    { year: 1, price: 1, mileage: 1, title: 1, imageUrl: 1, city: 1 }
  ).lean<{ _id: any; year: number; price: number; mileage: number; title?: string; imageUrl?: string; city?: string }[]>();

  if (cars.length === 0) {
    return NextResponse.json({
      brand,
      model,
      count: 0,
      yearlyData: [],
      mileageData: [],
      stats: null,
      brands: options.brands,
      brandModels: options.brandModels,
    });
  }

  // 1. Yıllara Göre Değer Kaybı (Amortisman) Eğrisi
  const yearMap = new Map<
    number,
    {
      count: number;
      sumPrice: number;
      prices: number[];
      sumMileage: number;
      sampleCars: Array<{ _id: string; title: string; price: number; mileage: number; city?: string; imageUrl?: string }>;
    }
  >();
  for (const c of cars) {
    if (!c.year || !c.price) continue;
    const existing = yearMap.get(c.year) || {
      count: 0,
      sumPrice: 0,
      prices: [],
      sumMileage: 0,
      sampleCars: [],
    };
    existing.count += 1;
    existing.sumPrice += c.price;
    existing.prices.push(c.price);
    existing.sumMileage += c.mileage || 0;
    if (existing.sampleCars.length < 5) {
      existing.sampleCars.push({
        _id: String(c._id),
        title: c.title || `${brand} ${model} ${c.year}`,
        price: c.price,
        mileage: c.mileage || 0,
        city: c.city || "",
        imageUrl: c.imageUrl || "",
      });
    }
    yearMap.set(c.year, existing);
  }

  const yearlyData = Array.from(yearMap.entries())
    .map(([year, d]) => ({
      year,
      count: d.count,
      avgPrice: Math.round(d.sumPrice / d.count),
      minPrice: Math.min(...d.prices),
      maxPrice: Math.max(...d.prices),
      avgMileage: Math.round(d.sumMileage / d.count),
      cars: d.sampleCars,
    }))
    .sort((a, b) => a.year - b.year);

  // Yıllık amortisman (değer kaybı) oranı tahmini
  let totalDepreciationPct = 0;
  let validSteps = 0;
  for (let i = 1; i < yearlyData.length; i++) {
    const prev = yearlyData[i - 1];
    const curr = yearlyData[i];
    if (curr.avgPrice > 0 && prev.avgPrice > 0 && curr.avgPrice > prev.avgPrice) {
      const yearDiff = curr.year - prev.year;
      if (yearDiff > 0) {
        const dropPct =
          (((curr.avgPrice - prev.avgPrice) / curr.avgPrice) * 100) / yearDiff;
        totalDepreciationPct += dropPct;
        validSteps += 1;
      }
    }
  }
  const annualDepreciationRate =
    validSteps > 0
      ? Math.round((totalDepreciationPct / validSteps) * 10) / 10
      : 0;

  // 2. Kilometre vs Fiyat Dağılımı
  const mileageBuckets = [
    { label: "0 - 50 bin km", min: 0, max: 50000, count: 0, sumPrice: 0, prices: [] as number[] },
    { label: "50 - 100 bin km", min: 50000, max: 100000, count: 0, sumPrice: 0, prices: [] as number[] },
    { label: "100 - 150 bin km", min: 100000, max: 150000, count: 0, sumPrice: 0, prices: [] as number[] },
    { label: "150 - 200 bin km", min: 150000, max: 200000, count: 0, sumPrice: 0, prices: [] as number[] },
    { label: "200 bin+ km", min: 200000, max: Infinity, count: 0, sumPrice: 0, prices: [] as number[] },
  ];

  for (const c of cars) {
    const km = typeof c.mileage === "number" ? c.mileage : 0;
    const bucket = mileageBuckets.find((b) => km >= b.min && km < b.max);
    if (bucket && c.price) {
      bucket.count += 1;
      bucket.sumPrice += c.price;
      bucket.prices.push(c.price);
    }
  }

  const mileageData = mileageBuckets.map((b) => ({
    range: b.label,
    count: b.count,
    avgPrice: b.count > 0 ? Math.round(b.sumPrice / b.count) : 0,
    minPrice: b.prices.length > 0 ? Math.min(...b.prices) : 0,
    maxPrice: b.prices.length > 0 ? Math.max(...b.prices) : 0,
  }));

  const overallAvgPrice = Math.round(
    cars.reduce((sum, c) => sum + c.price, 0) / cars.length
  );

  return NextResponse.json({
    brand,
    model,
    count: cars.length,
    yearlyData,
    mileageData,
    stats: {
      overallAvgPrice,
      annualDepreciationRate,
      minYear: yearlyData[0]?.year || null,
      maxYear: yearlyData[yearlyData.length - 1]?.year || null,
    },
    brands: options.brands,
    brandModels: options.brandModels,
  });
}
