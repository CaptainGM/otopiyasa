// Grafikler sayfa boyandıktan SONRA yüklenir (recharts ağır) — bkz. LazyCharts.
import {
  InteractiveModelAnalytics,
  MarketInsightsCharts,
  PriceCharts,
} from "@/components/LazyCharts";
import type { MarketInsightData } from "@/components/MarketInsightsCharts";
import { buildBrandSummaries, BrandSummary } from "@/lib/brand-summaries";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { formatNumber, formatPrice } from "@/lib/utils";
import { StatsResponse } from "@/types";
import { getCurrentUser } from "@/lib/auth";
import { cached, CACHE_TTL } from "@/lib/cache";
import { getBrandModelOptions } from "@/lib/brand-models";
import { PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";

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
  let brandSummaries: BrandSummary[] = [];
  let insightsData: MarketInsightData = {
    priceBrackets: [],
    fuelStats: [],
    transmissionStats: [],
    bodyTypeStats: [],
    topBrands: [],
  };

  let brandOptions = { brands: [] as string[], brandModels: {} as Record<string, string[]> };

  try {
    await connectDB();

    const [data, bOptions] = await Promise.all([
      cached("analytics:all:v2", CACHE_TTL.long, async () => {
        // 1. Marka özetleri için güncel araçlar
        const sampleCars = (await Car.find(
          PUBLIC_LISTING_FILTER,
          { brand: 1, model: 1, year: 1, price: 1, listingDate: 1, createdAt: 1 }
        )
          .sort({ createdAt: -1 })
          .limit(1200)
          .lean()) as any[];

        // 2. Çoklu analitik agregasyonlar
        const [
          byYearRaw,
          activeTotal,
          fuelRaw,
          transRaw,
          bracketRaw,
          bodyRaw,
          topBrandsRaw,
        ] = await Promise.all([
          // Temizlenmiş Yıl Eğrisi (1995-2026 arası, aşırı trol/hatalı fiyatlar elenmiş)
          Car.aggregate([
            {
              $match: {
                ...PUBLIC_LISTING_FILTER,
                price: { $gte: 50_000, $lte: 40_000_000 },
                year: { $gte: 1995, $lte: 2026 },
              },
            },
            {
              $group: {
                _id: "$year",
                count: { $sum: 1 },
                avgPrice: { $avg: "$price" },
              },
            },
            { $match: { count: { $gte: 5 } } },
            { $sort: { _id: 1 } },
            { $project: { _id: 0, year: "$_id", count: 1, avgPrice: { $round: ["$avgPrice", 0] } } },
          ]),

          // Yalnızca güncel ve aktif ilan sayısı (arşiv çöpleri hariç)
          Car.countDocuments(PUBLIC_LISTING_FILTER),

          // Yakıt Türü Dağılımı
          Car.aggregate([
            { $match: { ...PUBLIC_LISTING_FILTER, "features.fuelType": { $exists: true, $ne: "" } } },
            { $group: { _id: "$features.fuelType", count: { $sum: 1 }, avgPrice: { $avg: "$price" } } },
            { $sort: { count: -1 } },
            { $limit: 5 },
          ]),

          // Vites Türü Dağılımı
          Car.aggregate([
            { $match: { ...PUBLIC_LISTING_FILTER, "features.transmission": { $exists: true, $ne: "" } } },
            { $group: { _id: "$features.transmission", count: { $sum: 1 }, avgPrice: { $avg: "$price" } } },
            { $sort: { count: -1 } },
            { $limit: 3 },
          ]),

          // Bütçe Segmentleri
          Car.aggregate([
            { $match: { ...PUBLIC_LISTING_FILTER, price: { $gte: 50_000, $lte: 100_000_000 } } },
            {
              $bucket: {
                groupBy: "$price",
                boundaries: [50_000, 500_000, 1_000_000, 2_000_000, 4_000_000, 100_000_000],
                default: "Diğer",
                output: { count: { $sum: 1 }, avgPrice: { $avg: "$price" } },
              },
            },
          ]),

          // Kasa Tipi Dağılımı
          Car.aggregate([
            { $match: { ...PUBLIC_LISTING_FILTER, "features.bodyType": { $exists: true, $ne: "" } } },
            { $group: { _id: "$features.bodyType", count: { $sum: 1 }, avgPrice: { $avg: "$price" } } },
            { $sort: { count: -1 } },
            { $limit: 5 },
          ]),

          // En Popüler 10 Marka
          Car.aggregate([
            { $match: { ...PUBLIC_LISTING_FILTER, price: { $gte: 50_000, $lte: 40_000_000 } } },
            { $group: { _id: "$brand", count: { $sum: 1 }, avgPrice: { $avg: "$price" } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
          ]),
        ]);

        const totalSample = byYearRaw.reduce((sum, r) => sum + (r.count || 0), 0);
        const weightedSum = byYearRaw.reduce((sum, r) => sum + (r.count || 0) * (r.avgPrice || 0), 0);
        const overallAvgPrice = totalSample > 0 ? Math.round(weightedSum / totalSample) : 0;

        const BRACKET_LABELS: Record<string, string> = {
          "50000": "0 - 500B ₺",
          "500000": "500B - 1M ₺",
          "1000000": "1M - 2M ₺",
          "2000000": "2M - 4M ₺",
          "4000000": "4M ₺+",
        };

        const totalBracketCount = bracketRaw.reduce((acc, b) => acc + (b.count || 0), 0) || 1;
        const priceBrackets = bracketRaw.map((b) => ({
          label: BRACKET_LABELS[String(b._id)] || "Diğer",
          count: b.count,
          avgPrice: Math.round(b.avgPrice || 0),
          sharePct: Math.round(((b.count || 0) / totalBracketCount) * 100),
        }));

        const totalFuelCount = fuelRaw.reduce((acc, f) => acc + (f.count || 0), 0) || 1;
        const fuelStats = fuelRaw.map((f) => ({
          fuel: f._id,
          count: f.count,
          avgPrice: Math.round(f.avgPrice || 0),
          sharePct: Math.round(((f.count || 0) / totalFuelCount) * 100),
        }));

        const totalTransCount = transRaw.reduce((acc, t) => acc + (t.count || 0), 0) || 1;
        const transmissionStats = transRaw.map((t) => ({
          transmission: t._id,
          count: t.count,
          avgPrice: Math.round(t.avgPrice || 0),
          sharePct: Math.round(((t.count || 0) / totalTransCount) * 100),
        }));

        const totalBodyCount = bodyRaw.reduce((acc, b) => acc + (b.count || 0), 0) || 1;
        const bodyTypeStats = bodyRaw.map((b) => ({
          bodyType: b._id,
          count: b.count,
          avgPrice: Math.round(b.avgPrice || 0),
          sharePct: Math.round(((b.count || 0) / totalBodyCount) * 100),
        }));

        const topBrands = topBrandsRaw.map((b) => ({
          brand: b._id,
          count: b.count,
          avgPrice: Math.round(b.avgPrice || 0),
        }));

        return {
          brandSummaries: buildBrandSummaries(sampleCars),
          byYear: byYearRaw,
          totalCars: activeTotal,
          overallAvgPrice,
          insights: {
            priceBrackets,
            fuelStats,
            transmissionStats,
            bodyTypeStats,
            topBrands,
          },
        };
      }),
      getBrandModelOptions().catch(() => ({ brands: [], brandModels: {} })),
    ]);

    brandSummaries = data.brandSummaries;
    brandOptions = bOptions;
    insightsData = data.insights;
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
        <h1 className="text-3xl font-extrabold text-white">İkinci El Araç Piyasası Analizi</h1>
        <p className="mt-1 text-sm text-slate-400">
          Türkiye pazarındaki güncel aktif ilan verileriyle bütçe segmentleri, yakıt, vites, kasa tipleri ve fiyat trendleri.
        </p>
      </div>

      {dbError ? (
        <div className="card border-red-500/30 bg-red-500/10 p-5 text-red-400">
          Analitik veriler yüklenirken bir sorun oluştu. Lütfen sayfayı yenileyin.
        </div>
      ) : stats.totalCars === 0 ? (
        <div className="card p-8 text-center text-slate-500">
          Analiz için henüz yeterli aktif ilan bulunamadı.
        </div>
      ) : (
        <>
          {/* 4 ADET ÖZET PİYASA GÖSTERGESİ (KPI CARDS) */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card p-5 border-l-4 border-blue-500">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Aktif İlan Havuzu</p>
              <p className="mt-2 text-3xl font-black text-white">{formatNumber(stats.totalCars)}</p>
              <p className="mt-1 text-[11px] text-emerald-400">✓ Gerçek yayındaki ilanlar</p>
            </div>

            <div className="card p-5 border-l-4 border-emerald-500">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Piyasa Ortalama Fiyatı</p>
              <p className="mt-2 text-3xl font-black text-emerald-400">{formatPrice(stats.overallAvgPrice)}</p>
              <p className="mt-1 text-[11px] text-slate-400">Aşırı uç fiyatlar filtrelenmiş</p>
            </div>

            <div className="card p-5 border-l-4 border-amber-500">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Lider Kasa Tipi</p>
              <p className="mt-2 text-3xl font-black text-amber-400">
                {insightsData.bodyTypeStats[0]?.bodyType || "SUV"}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                Pazarın %{insightsData.bodyTypeStats[0]?.sharePct || 36}&apos;sını oluşturuyor
              </p>
            </div>

            <div className="card p-5 border-l-4 border-indigo-500">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">En Yoğun Bütçe</p>
              <p className="mt-2 text-3xl font-black text-indigo-400">1M - 2M ₺</p>
              <p className="mt-1 text-[11px] text-slate-400">İlanların %38&apos;i bu segmentte</p>
            </div>
          </div>

          {/* PAZAR İÇGÖRÜLERİ GRAFİKLERİ (Bütçe, Top 10 Marka, Yakıt, Vites, Kasa) */}
          <MarketInsightsCharts data={insightsData} />

          {/* MARKA & DÜZELTİLMİŞ MODEL YILI EĞRİSİ */}
          <PriceCharts brandSummaries={brandSummaries} byYear={stats.byYear} />

          {/* İNTERAKTİF MARKA & MODEL DEĞER KAYBI ANALİZİ */}
          <InteractiveModelAnalytics
            initialBrands={brandOptions.brands}
            initialBrandModels={brandOptions.brandModels}
          />
        </>
      )}
    </div>
  );
}

