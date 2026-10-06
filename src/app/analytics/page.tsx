// Grafikler sayfa boyandıktan SONRA yüklenir (recharts ağır) — bkz. LazyCharts.
import { Suspense } from "react";
import { unstable_cache } from "next/cache";
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
import { CACHE_TTL } from "@/lib/cache";
import { getBrandModelOptions } from "@/lib/brand-models";
import { PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";
import { mergeCategoryStats, normalizeBodyType, normalizeTransmission } from "@/lib/vehicle-attrs";

// ISR: 2 dakikada bir arka planda tazeler — anlık yükleme + güncel veri
// Analiz verisi en fazla 5 dakika gecikmeli: yeni ilan eklenince/arşive gidince sayfa kendiliğinden yenilenir.
export const revalidate = 300;

/**
 * Vites, yakıt ve kasa tipi Arabam liste sayfalarında ilan BAŞLIĞINDAN tahmin ediliyordu (örn. başlıkta "otomatik"
 * yoksa "Manuel"). Gerçek ilan sayfasından doğrulanmamış Arabam ilanları bu dağılımlara katılmaz; diğer kaynaklar
 * (galeri siteleri) bilgiyi doğrudan verdiği için dahildir. Bekçi ilanları gezdikçe örnek büyür.
 */
/**
 * Doğrulanmış ilan oranı bunun altındayken vites/kasa dağılımı gösterilmez: o zaman örnek çoğunlukla galeri
 * sitelerinden gelir ve piyasayı temsil etmez (otomatik oranı olduğundan çok yüksek çıkar).
 */
const MIN_TRUSTED_COVERAGE = 0.25;

const TRUSTED_FEATURES: { $or: Record<string, unknown>[] } = {
  $or: [{ sourceSite: { $ne: "arabam" } }, { featuresVerifiedAt: { $exists: true } }],
};

const getAnalyticsData = unstable_cache(
  async () => {
    await connectDB();
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
      trustedTotal,
      byYearRaw,
      activeTotal,
      fuelRaw,
      transRaw,
      bracketRaw,
      bodyRaw,
      topBrandsRaw,
    ] = await Promise.all([
      Car.countDocuments({ ...PUBLIC_LISTING_FILTER, ...TRUSTED_FEATURES }),
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
        { $match: { ...PUBLIC_LISTING_FILTER, ...TRUSTED_FEATURES, "features.transmission": { $exists: true, $ne: "" } } },
        { $group: { _id: "$features.transmission", count: { $sum: 1 }, avgPrice: { $avg: "$price" } } },
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
        { $match: { ...PUBLIC_LISTING_FILTER, ...TRUSTED_FEATURES, "features.bodyType": { $exists: true, $ne: "" } } },
        { $group: { _id: "$features.bodyType", count: { $sum: 1 }, avgPrice: { $avg: "$price" } } },
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

    // Kaynakların farklı yazdığı değerler birleştirilir (Tiptronik → Otomatik, Suv/Arazi aracı → SUV...) ve
    // yüzdeler tüm bilinen ilanlara göre hesaplanır (bkz. lib/vehicle-attrs.ts).
    const featureCoverageOk = activeTotal > 0 && trustedTotal / activeTotal >= MIN_TRUSTED_COVERAGE;
    const transmissionStats = (featureCoverageOk ? mergeCategoryStats(transRaw, normalizeTransmission, 3) : []).map((t) => ({
      transmission: t.label,
      count: t.count,
      avgPrice: t.avgPrice,
      sharePct: t.sharePct,
    }));

    const bodyTypeStats = (featureCoverageOk ? mergeCategoryStats(bodyRaw, normalizeBodyType, 5) : []).map((b) => ({
      bodyType: b.label,
      count: b.count,
      avgPrice: b.avgPrice,
      sharePct: b.sharePct,
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
        featureBase: {
          trusted: trustedTotal,
          total: activeTotal,
          minCoveragePct: Math.round(MIN_TRUSTED_COVERAGE * 100),
          gated: !featureCoverageOk,
        },
        generatedAt: new Date().toISOString(),
      },
    };
  },
  ["analytics:all:v5"],
  { revalidate: CACHE_TTL.medium / 1000 }
);

function AnalyticsLoading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-live="polite">
      <div>
        <h1 className="text-3xl font-extrabold text-white">İkinci El Araç Piyasası Analizi</h1>
        <p className="mt-2 text-sm text-slate-400">Analiz verileri yükleniyor…</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="card h-28 animate-pulse bg-white/[0.035]" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="card h-72 animate-pulse bg-white/[0.035]" />
        ))}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<AnalyticsLoading />}>
      <AnalyticsContent />
    </Suspense>
  );
}

async function AnalyticsContent() {
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
    const [data, bOptions] = await Promise.all([
      getAnalyticsData(),
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

  // En çok ilanın bulunduğu bütçe aralığı ("Diğer" kovası sayılmaz).
  const busiestBracket = [...insightsData.priceBrackets]
    .filter((bracket) => bracket.label !== "Diğer")
    .sort((a, b) => b.count - a.count)[0];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-white">İkinci El Araç Piyasası Analizi</h1>
        <p className="mt-1 text-sm text-slate-400">
          Türkiye pazarındaki güncel aktif ilan verileriyle bütçe segmentleri, yakıt, vites, kasa tipleri ve fiyat trendleri.
          Arşivdeki (kaldırılmış) ilanlar bu analize katılmaz; veriler en fazla 5 dakika gecikmeyle otomatik yenilenir.
          {insightsData.generatedAt && (
            <> Son hesaplama: {new Date(insightsData.generatedAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" })}.</>
          )}
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
                {insightsData.bodyTypeStats[0]?.bodyType || "—"}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                {insightsData.bodyTypeStats[0]
                  ? `Kasa tipi bilinen ilanların %${insightsData.bodyTypeStats[0].sharePct}'ini oluşturuyor`
                  : "Yeterli veri yok"}
              </p>
            </div>

            <div className="card p-5 border-l-4 border-indigo-500">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">En Yoğun Bütçe</p>
              <p className="mt-2 text-3xl font-black text-indigo-400">{busiestBracket?.label || "—"}</p>
              <p className="mt-1 text-[11px] text-slate-400">
                {busiestBracket ? `İlanların %${busiestBracket.sharePct}'i bu segmentte` : "Yeterli veri yok"}
              </p>
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
