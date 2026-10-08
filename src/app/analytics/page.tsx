// Grafikler sayfa boyandıktan SONRA yüklenir (recharts ağır) — bkz. LazyCharts.
import { Suspense } from "react";
import { MarketInsightsCharts, PriceCharts } from "@/components/LazyCharts";
import Link from "next/link";
import type { MarketInsightData } from "@/components/MarketInsightsCharts";
import type { BrandSummary } from "@/lib/brand-summaries";
import { getAnalyticsData } from "@/lib/analytics-data";
import { formatNumber, formatPrice, trPercent } from "@/lib/utils";
import { StatsResponse } from "@/types";

// ISR: 2 dakikada bir arka planda tazeler — anlık yükleme + güncel veri
// Analiz sayfası 6 saatte bir yeniden çizilir (ISR). Eskiden 5 dakikaydı ve ayrıca veri önbelleği (unstable_cache)
// vardı: her yenileme ~38 yazma birimi, günde ~15 bin; Vercel ücretsiz planın aylık 200 bin ISR yazma limitini tek
// başına aşıyordu. Piyasa göstergeleri saatler içinde anlamlı değişmediği için 6 saat yeterli.
export const revalidate = 21600;

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

  try {
    const data = await getAnalyticsData();

    brandSummaries = data.brandSummaries;
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

          {/* Model bazlı değer kaybı artık kendi sayfasında (km ve hasar etkileriyle) */}
          <Link href="/deger-kaybi" className="card group flex flex-wrap items-center justify-between gap-3 p-5 transition hover:border-[var(--accent)]">
            <div>
              <p className="eyebrow">Marka ve model seç</p>
              <p className="font-display text-xl font-semibold">Değer kaybı: yaş, kilometre ve hasar etkisi</p>
              <p className="mt-1 text-sm text-[var(--muted)]">Aynı yaş ve kilometrede hasarın, boyanın ve her 10 bin km'nin fiyata etkisi.</p>
            </div>
            <span className="btn btn-primary">Değer kaybına git</span>
          </Link>
        </>
      )}
    </div>
  );
}
