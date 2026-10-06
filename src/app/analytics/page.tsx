// Grafikler sayfa boyandıktan SONRA yüklenir (recharts ağır) — bkz. LazyCharts.
import { Suspense } from "react";
import {
  InteractiveModelAnalytics,
  MarketInsightsCharts,
  PriceCharts,
} from "@/components/LazyCharts";
import type { MarketInsightData } from "@/components/MarketInsightsCharts";
import { buildBrandSummariesFromGroups, BrandSummary } from "@/lib/brand-summaries";
import { connectDB } from "@/lib/mongodb";
import { Car } from "@/models/Car";
import { formatNumber, formatPrice, trPercent } from "@/lib/utils";
import { StatsResponse } from "@/types";
import { getBrandModelOptions } from "@/lib/brand-models";
import { MARKET_LISTING_FILTER as PUBLIC_LISTING_FILTER } from "@/lib/listing-visibility";
import { mergeCategoryStats, normalizeBodyType, normalizeTransmission, trustedFeatureFilter } from "@/lib/vehicle-attrs";

// ISR: 2 dakikada bir arka planda tazeler — anlık yükleme + güncel veri
// Analiz sayfası 6 saatte bir yeniden çizilir (ISR). Eskiden 5 dakikaydı ve ayrıca veri önbelleği (unstable_cache)
// vardı: her yenileme ~38 yazma birimi, günde ~15 bin; Vercel ücretsiz planın aylık 200 bin ISR yazma limitini tek
// başına aşıyordu. Piyasa göstergeleri saatler içinde anlamlı değişmediği için 6 saat yeterli.
export const revalidate = 21600;

/**
 * Vites, yakıt ve kasa tipi Arabam toplu çekiminde ilan BAŞLIĞINDAN tahmin ediliyordu (örn. başlıkta "otomatik"
 * yoksa "Manuel"). Her dağılım yalnızca o özelliği doğrulanmış ilanlarla hesaplanır (bkz. trustedFeatureFilter);
 * bekçi ilan ve liste sayfalarını gezdikçe örnek büyür.
 *
 * Doğrulanmış ilan oranı bunun altındayken dağılım gösterilmez: o zaman örnek çoğunlukla galeri sitelerinden
 * gelir ve piyasayı temsil etmez (otomatik oranı olduğundan çok yüksek çıkar).
 */
const MIN_TRUSTED_COVERAGE = 0.25;

const getAnalyticsData = async () => {
    await connectDB();
    // 1. Marka özetleri: TÜM aktif ilanlardan (aynı fiyat süzgeciyle). Eskiden yalnızca en yeni 1.200 ilandan
    // hesaplanıyordu; grafik "veritabanındaki markaların tamamı" derken Volkswagen'i 1.240 yerine 197 ilan gösteriyordu.
    const brandGroups = await Car.aggregate<{ _id: { b: string; m: string }; count: number; priceSum: number }>([
      { $match: { ...PUBLIC_LISTING_FILTER, price: { $gte: 50_000, $lte: 40_000_000 } } },
      { $group: { _id: { b: "$brand", m: "$model" }, count: { $sum: 1 }, priceSum: { $sum: "$price" } } },
    ]);

    // 2. Çoklu analitik agregasyonlar
    const [
      trustedFuel,
      trustedTrans,
      trustedBody,
      byYearRaw,
      activeTotal,
      fuelRaw,
      transRaw,
      bracketRaw,
      bodyRaw,
      topBrandsRaw,
    ] = await Promise.all([
      Car.countDocuments({ $and: [PUBLIC_LISTING_FILTER, trustedFeatureFilter("fuelType")] }),
      Car.countDocuments({ $and: [PUBLIC_LISTING_FILTER, trustedFeatureFilter("transmission")] }),
      Car.countDocuments({ $and: [PUBLIC_LISTING_FILTER, trustedFeatureFilter("bodyType")] }),
      // Temizlenmiş Yıl Eğrisi (1995'ten gelecek model yılına, aşırı trol/hatalı fiyatlar elenmiş)
      Car.aggregate([
        {
          $match: {
            ...PUBLIC_LISTING_FILTER,
            price: { $gte: 50_000, $lte: 40_000_000 },
            // Yeni model yılı ilanları yıl bitmeden gelir (Ekim'de 2027 model): üst sınır gelecek yıl.
            year: { $gte: 1995, $lte: new Date().getFullYear() + 1 },
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
        { $match: { $and: [PUBLIC_LISTING_FILTER, trustedFeatureFilter("fuelType"), { "features.fuelType": { $exists: true, $nin: ["", "Bilinmiyor"] } }] } },
        { $group: { _id: "$features.fuelType", count: { $sum: 1 }, avgPrice: { $avg: "$price" } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),

      // Vites Türü Dağılımı
      Car.aggregate([
        { $match: { $and: [PUBLIC_LISTING_FILTER, trustedFeatureFilter("transmission"), { "features.transmission": { $exists: true, $ne: "" } }] } },
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
        { $match: { $and: [PUBLIC_LISTING_FILTER, trustedFeatureFilter("bodyType"), { "features.bodyType": { $exists: true, $ne: "" } }] } },
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

    // Kaynakların farklı yazdığı değerler birleştirilir (Tiptronik → Otomatik, Suv/Arazi aracı → SUV...) ve
    // yüzdeler tüm bilinen ilanlara göre hesaplanır (bkz. lib/vehicle-attrs.ts).
    const base = (trusted: number) => ({
      trusted,
      total: activeTotal,
      minCoveragePct: Math.round(MIN_TRUSTED_COVERAGE * 100),
      gated: !(activeTotal > 0 && trusted / activeTotal >= MIN_TRUSTED_COVERAGE),
    });
    const featureBases = { fuelType: base(trustedFuel), transmission: base(trustedTrans), bodyType: base(trustedBody) };

    const totalFuelCount = fuelRaw.reduce((acc, f) => acc + (f.count || 0), 0) || 1;
    const fuelStats = (featureBases.fuelType.gated ? [] : fuelRaw).map((f) => ({
      fuel: f._id,
      count: f.count,
      avgPrice: Math.round(f.avgPrice || 0),
      sharePct: Math.round(((f.count || 0) / totalFuelCount) * 100),
    }));

    const transmissionStats = (!featureBases.transmission.gated ? mergeCategoryStats(transRaw, normalizeTransmission, 3) : []).map((t) => ({
      transmission: t.label,
      count: t.count,
      avgPrice: t.avgPrice,
      sharePct: t.sharePct,
    }));

    const bodyTypeStats = (!featureBases.bodyType.gated ? mergeCategoryStats(bodyRaw, normalizeBodyType, 5) : []).map((b) => ({
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
      brandSummaries: buildBrandSummariesFromGroups(
        brandGroups.map((g) => ({ brand: g._id.b, model: g._id.m, count: g.count, priceSum: g.priceSum }))
      ),
      byYear: byYearRaw,
      totalCars: activeTotal,
      overallAvgPrice,
      insights: {
        priceBrackets,
        fuelStats,
        transmissionStats,
        bodyTypeStats,
        topBrands,
        featureBases,
        generatedAt: new Date().toISOString(),
      },
    };
};

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
          Türkiye pazarındaki güncel otomobil, SUV ve hafif ticari ilanlarıyla bütçe segmentleri, yakıt, vites, kasa tipleri ve fiyat trendleri (motosiklet, kamyon ve karavan bu göstergelere katılmaz).
          Arşivdeki (kaldırılmış) ilanlar bu analize katılmaz; veriler 6 saatte bir kendiliğinden yenilenir.
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
              <p className="mt-1 text-[11px] text-emerald-400">✓ Yayındaki otomobil, SUV ve minivan ilanları</p>
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
                  ? `Kasa tipi bilinen ilanlardaki payı %${insightsData.bodyTypeStats[0].sharePct}`
                  : "Yeterli veri yok"}
              </p>
            </div>

            <div className="card p-5 border-l-4 border-indigo-500">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">En Yoğun Bütçe</p>
              <p className="mt-2 text-3xl font-black text-indigo-400">{busiestBracket?.label || "—"}</p>
              <p className="mt-1 text-[11px] text-slate-400">
                {busiestBracket ? `İlanların ${trPercent(busiestBracket.sharePct)} bu segmentte` : "Yeterli veri yok"}
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
