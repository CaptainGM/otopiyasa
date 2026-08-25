// Grafikler sayfa boyandıktan SONRA yüklenir (recharts ağır) — bkz. LazyCharts.
import { BrandTrendChart, ModelCurveChart, PriceCharts } from "@/components/LazyCharts";
import { buildBrandSummaries, BrandSummary } from "@/lib/brand-summaries";
import { buildBrandTrends, BrandTrends, TrendCar } from "@/lib/brand-trends";
import { buildModelCurves, CurveCar, ModelCurves } from "@/lib/model-curves";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { formatPrice } from "@/lib/utils";
import { StatsResponse, YearStats } from "@/types";
import { getCurrentUser } from "@/lib/auth";
import { cached, CACHE_TTL } from "@/lib/cache";

// Grafikler her ziyarette güncel veriden hesaplansın (build anında donmasın)
export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  await getCurrentUser();
  let stats: StatsResponse = {
    byBrand: [],
    byYear: [],
    overallAvgPrice: 0,
    totalCars: 0,
  };
  let dbError = false;
  let trends: BrandTrends = { brands: [], points: [] };
  let curves: ModelCurves = { segments: [], points: [] };
  let brandSummaries: BrandSummary[] = [];

  try {
    await connectDB();

    // Tüm analitik veriler herkes için aynı ve pahalı (8000 aracı yükleyip
    // hesaplama). Yalnızca taramada değişir → önbelleğe al, sekme geçişi anında
    // olsun (eskiden her ziyarette 8000 araç yükleniyordu → 3-4 sn).
    const data = await cached("analytics:all", CACHE_TTL.medium, async () => {
      const trendCars = (await Car.find(
        {},
        { brand: 1, model: 1, year: 1, price: 1, listingDate: 1, createdAt: 1 }
      ).lean()) as unknown as (TrendCar & CurveCar)[];

      const [byYear, totalCars, overall] = await Promise.all([
        Car.aggregate([
          { $group: { _id: "$year", count: { $sum: 1 }, avgPrice: { $avg: "$price" } } },
          { $sort: { _id: 1 } },
          { $project: { _id: 0, year: "$_id", count: 1, avgPrice: { $round: ["$avgPrice", 0] } } },
        ]),
        Car.countDocuments(),
        Car.aggregate([{ $group: { _id: null, avgPrice: { $avg: "$price" } } }]),
      ]);

      return {
        trends: buildBrandTrends(trendCars),
        curves: buildModelCurves(trendCars),
        brandSummaries: buildBrandSummaries(trendCars),
        byYear: byYear as YearStats[],
        totalCars,
        overallAvgPrice: Math.round(overall[0]?.avgPrice || 0),
      };
    });

    trends = data.trends;
    curves = data.curves;
    brandSummaries = data.brandSummaries;
    stats = {
      byBrand: [],
      byYear: data.byYear,
      totalCars: data.totalCars,
      overallAvgPrice: data.overallAvgPrice,
    };
  } catch {
    dbError = true;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Fiyat Analizi</h1>
        <p className="text-slate-500">
          Marka ve yıla göre ortalama fiyatları görselleştir.
        </p>
      </div>

      {dbError ? (
        <div className="card border-red-200 bg-red-50 p-5 text-red-700">
          MongoDB bağlantısı kurulamadı.
        </div>
      ) : stats.totalCars === 0 ? (
        <div className="card p-8 text-center text-slate-500">
          Analiz için önce ana sayfadan demo veriyi yükle.
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="card p-5">
              <p className="text-sm text-slate-500">Toplam ilan</p>
              <p className="text-3xl font-bold">{stats.totalCars}</p>
            </div>
            <div className="card p-5">
              <p className="text-sm text-slate-500">Genel ortalama fiyat</p>
              <p className="text-3xl font-bold text-blue-700">
                {formatPrice(stats.overallAvgPrice)}
              </p>
            </div>
          </div>

          <PriceCharts brandSummaries={brandSummaries} byYear={stats.byYear} />

          <ModelCurveChart curves={curves} />

          {/* Zaman bazlı trend, gece scrape'leri en az 2 farklı aya yayılınca anlam kazanır */}
          {trends.points.length >= 2 && <BrandTrendChart trends={trends} />}
        </>
      )}
    </div>
  );
}
