"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatNumber, formatPrice } from "@/lib/utils";

function formatAxisPrice(value: number): string {
  if (!value) return "0 ₺";
  if (value >= 1_000_000) {
    const val = value / 1_000_000;
    return val % 1 === 0 ? `${val}M ₺` : `${val.toFixed(1)}M ₺`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}B ₺`;
  }
  return `${value} ₺`;
}

interface YearlyPoint {
  year: number;
  count: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  avgMileage: number;
  cars?: Array<{
    _id: string;
    title: string;
    price: number;
    mileage: number;
    city?: string;
    imageUrl?: string;
  }>;
}

interface MileagePoint {
  range: string;
  count: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
}

interface AnalyticsData {
  brand: string;
  model: string;
  count: number;
  yearlyData: YearlyPoint[];
  mileageData: MileagePoint[];
  stats: {
    overallAvgPrice: number;
    annualDepreciationRate: number;
    minYear: number | null;
    maxYear: number | null;
  } | null;
  brands: string[];
  brandModels: Record<string, string[]>;
}

export function InteractiveModelAnalytics({
  initialBrands = [],
  initialBrandModels = {},
}: {
  initialBrands?: string[];
  initialBrandModels?: Record<string, string[]>;
}) {
  const [brands, setBrands] = useState<string[]>(initialBrands);
  const [brandModels, setBrandModels] = useState<Record<string, string[]>>(initialBrandModels);

  // Varsayılan olarak kullanıcının da belirttiği Renault -> Megane
  const [selectedBrand, setSelectedBrand] = useState<string>("Renault");
  const [selectedModel, setSelectedModel] = useState<string>("Megane");

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeYearPoint, setActiveYearPoint] = useState<YearlyPoint | null>(null);

  // 1. İlk yüklemede marka ve model listesini çek (eğer prop verilmediyse)
  useEffect(() => {
    if (brands.length === 0) {
      fetch("/api/analytics/model-breakdown")
        .then((r) => r.json())
        .then((res) => {
          if (res.brands && res.brands.length > 0) {
            setBrands(res.brands);
            setBrandModels(res.brandModels || {});
            // Eğer Renault varsa Renault, yoksa ilk marka
            const defaultBrand = res.brands.includes("Renault") ? "Renault" : res.brands[0];
            setSelectedBrand(defaultBrand);
            const models = res.brandModels?.[defaultBrand] || [];
            const defaultModel = models.includes("Megane") ? "Megane" : models[0] || "";
            setSelectedModel(defaultModel);
          }
        })
        .catch(() => {});
    }
  }, [brands.length]);

  // 2. Seçilen marka veya model değiştiğinde analitik verisini getir
  useEffect(() => {
    if (!selectedBrand || !selectedModel) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    fetch(
      `/api/analytics/model-breakdown?brand=${encodeURIComponent(
        selectedBrand
      )}&model=${encodeURIComponent(selectedModel)}`
    )
      .then((r) => {
        if (!r.ok) throw new Error("Model analiz verisi alınamadı.");
        return r.json();
      })
      .then((res) => {
        if (isMounted) {
          setData(res);
          if (res.yearlyData && res.yearlyData.length > 0) {
            setActiveYearPoint(res.yearlyData[res.yearlyData.length - 1]);
          } else {
            setActiveYearPoint(null);
          }
          if (res.brands) setBrands(res.brands);
          if (res.brandModels) setBrandModels(res.brandModels);
        }
      })
      .catch((err) => {
        if (isMounted) setError(err instanceof Error ? err.message : "Hata oluştu");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedBrand, selectedModel]);

  function handleBrandChange(newBrand: string) {
    setSelectedBrand(newBrand);
    const availableModels = brandModels[newBrand] || [];
    setSelectedModel(availableModels[0] || "");
  }

  const availableModels = brandModels[selectedBrand] || [];

  return (
    <div className="card space-y-6 p-6 border-amber-500/20 bg-gradient-to-b from-slate-900/90 to-slate-950/90 shadow-xl">
      {/* Başlık ve Filtre Seçici Çubuğu */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-white/5 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-amber-400 animate-pulse" />
            <h2 className="text-xl font-bold tracking-tight text-slate-100">
              İnteraktif Model Değer Kaybı & Kilometre Analizi
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            İstediğin marka ve modeli seçerek yıllara göre amortisman eğrisini ve kilometrenin piyasa fiyatına etkisini canlı incele.
          </p>
        </div>

        {/* Dropdown Filtreleri */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="brand-select" className="text-xs font-semibold text-slate-400">
              Marka:
            </label>
            <select
              id="brand-select"
              value={selectedBrand}
              onChange={(e) => handleBrandChange(e.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-200 outline-none focus:border-amber-400"
            >
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="model-select" className="text-xs font-semibold text-slate-400">
              Model:
            </label>
            <select
              id="model-select"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={availableModels.length === 0}
              className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-200 outline-none focus:border-amber-400 disabled:opacity-50"
            >
              {availableModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex h-72 items-center justify-center gap-3 text-slate-400 animate-pulse">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
          <span className="text-sm font-medium">{selectedBrand} {selectedModel} verileri hesaplanıyor…</span>
        </div>
      )}

      {error && !loading && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {!loading && data && data.count === 0 && (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-8 text-center text-slate-400">
          {selectedBrand} {selectedModel} modeli için veritabanında yeterli aktif ilan bulunamadı. Lütfen başka bir model seçin.
        </div>
      )}

      {!loading && data && data.count > 0 && (
        <div className="space-y-6">
          {/* Özet Metrik Kutuları */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5">
              <p className="text-xs font-medium text-slate-400">İncelenen İlan</p>
              <p className="mt-1 text-xl font-black text-slate-100">{data.count} adet</p>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5">
              <p className="text-xs font-medium text-slate-400">Model Ortalaması</p>
              <p className="mt-1 text-xl font-black text-amber-300">
                {formatPrice(data.stats?.overallAvgPrice || 0)}
              </p>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5">
              <p className="text-xs font-medium text-slate-400">Yıllık Değer Kaybı</p>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="text-xl font-black text-rose-400">
                  %{data.stats?.annualDepreciationRate || 0}
                </span>
                <span className="text-[10px] text-slate-500">/ yıl</span>
              </div>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5">
              <p className="text-xs font-medium text-slate-400">Model Yılı Aralığı</p>
              <p className="mt-1 text-xl font-black text-slate-100">
                {data.stats?.minYear} – {data.stats?.maxYear}
              </p>
            </div>
          </div>

          {/* 1. Grafik: Değer Kaybı (Amortisman) Eğrisi */}
          <div className="rounded-2xl border border-white/5 bg-slate-950/40 p-4">
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-200">
                  📉 Model Yılına Göre Değer Kaybı (Amortisman Eğrisi)
                </h3>
                <p className="text-xs text-slate-400">
                  Her model yılı için piyasadaki ortalama satış fiyatı. Eğim aracın yaşlandıkça değerini ne hızla kaybettiğini gösterir.
                </p>
              </div>
              {data.stats?.annualDepreciationRate ? (
                <span className="self-start sm:self-auto rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-bold text-rose-300">
                  Ortalama Değer Kaybı: %{data.stats.annualDepreciationRate}/yıl
                </span>
              ) : null}
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={data.yearlyData}
                  margin={{ top: 10, right: 15, left: 5, bottom: 5 }}
                  onMouseMove={(state) => {
                    if (state?.activePayload?.length) {
                      setActiveYearPoint(state.activePayload[0].payload as YearlyPoint);
                    }
                  }}
                  onClick={(state) => {
                    if (state?.activePayload?.length) {
                      setActiveYearPoint(state.activePayload[0].payload as YearlyPoint);
                    }
                  }}
                >
                  <defs>
                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis
                    dataKey="year"
                    tick={{ fill: "#898781", fontSize: 12 }}
                    axisLine={{ stroke: "#383835" }}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={formatAxisPrice}
                    tick={{ fill: "#898781", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    width={70}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload as YearlyPoint;
                        return (
                          <div className="rounded-xl border border-slate-700 bg-slate-900/95 p-3 shadow-2xl text-xs space-y-1.5 max-w-xs backdrop-blur-md">
                            <p className="font-bold text-amber-300 text-sm">{d.year} Model {selectedBrand} {selectedModel}</p>
                            <p className="text-slate-200">
                              Ortalama Fiyat: <strong className="text-white">{formatPrice(d.avgPrice)}</strong>
                            </p>
                            <p className="text-slate-400">
                              Fiyat Aralığı: {formatPrice(d.minPrice)} – {formatPrice(d.maxPrice)}
                            </p>
                            <p className="text-slate-400">
                              Ortalama Kilometre: {formatNumber(d.avgMileage)} km
                            </p>
                            <p className="text-slate-500">Piyasadaki İlan: {d.count} adet</p>

                            {d.cars && d.cars.length > 0 && (
                              <div className="mt-2 border-t border-slate-700/80 pt-2 space-y-1">
                                <p className="font-semibold text-amber-400 text-[11px]">Örnek İlanlar ({d.year}):</p>
                                {d.cars.slice(0, 3).map((car) => (
                                  <div key={car._id} className="flex items-center justify-between gap-2 text-[11px] bg-white/5 px-2 py-1 rounded">
                                    <span className="truncate max-w-[140px] text-slate-300 font-medium">{car.title}</span>
                                    <span className="shrink-0 font-bold text-emerald-400">{formatPrice(car.price)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="avgPrice"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorPrice)"
                    activeDot={{ r: 6, fill: "#fbbf24" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Seçilen Yılın Örnek İlanları & Vitrin Kartları */}
            {activeYearPoint && (
              <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400 font-bold text-sm">
                      🚗 {activeYearPoint.year} Model {selectedBrand} {selectedModel} İlanları
                    </span>
                    <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[11px] font-bold text-amber-300">
                      {activeYearPoint.count} adet ilan
                    </span>
                  </div>
                  <Link
                    href={`/?brand=${encodeURIComponent(selectedBrand)}&model=${encodeURIComponent(selectedModel)}&yearMin=${activeYearPoint.year}&yearMax=${activeYearPoint.year}`}
                    className="text-xs font-bold text-amber-300 hover:text-amber-200 hover:underline inline-flex items-center gap-1"
                  >
                    Tüm {activeYearPoint.year} İlanlarını Keşfet →
                  </Link>
                </div>

                {activeYearPoint.cars && activeYearPoint.cars.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {activeYearPoint.cars.map((c) => (
                      <Link
                        key={c._id}
                        href={`/cars/${c._id}`}
                        className="flex items-center gap-3 p-2.5 rounded-lg border border-white/5 bg-slate-900/80 hover:bg-slate-800/80 hover:border-amber-400/30 transition group"
                      >
                        {c.imageUrl ? (
                          <img
                            src={c.imageUrl}
                            alt={c.title}
                            className="h-12 w-16 rounded object-cover shrink-0 bg-slate-800"
                          />
                        ) : (
                          <div className="h-12 w-16 rounded bg-slate-800 shrink-0 flex items-center justify-center text-[10px] text-slate-500">
                            Görsel yok
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-white truncate group-hover:text-amber-300 transition">
                            {c.title}
                          </p>
                          <div className="flex items-center justify-between mt-1 text-[11px]">
                            <span className="text-slate-400">{formatNumber(c.mileage)} km</span>
                            <span className="font-bold text-amber-400">{formatPrice(c.price)}</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Bu model yılına ait ilan verisi.</p>
                )}
              </div>
            )}
          </div>

          {/* 2. Grafik: Kilometre vs Fiyat Dağılımı */}
          <div className="rounded-2xl border border-white/5 bg-slate-950/40 p-4">
            <div className="mb-4">
              <h3 className="text-base font-bold text-slate-200">
                🚗 Kilometre vs Ortalama Fiyat Dağılımı
              </h3>
              <p className="text-xs text-slate-400">
                Seçilen modelin kat ettiği kilometre dilimlerine göre ortalama piyasa fiyatı. Kilometre arttıkça fiyattaki düşüş trendini gösterir.
              </p>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.mileageData}
                  margin={{ top: 10, right: 15, left: 5, bottom: 5 }}
                >
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis
                    dataKey="range"
                    tick={{ fill: "#898781", fontSize: 11 }}
                    axisLine={{ stroke: "#383835" }}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={formatAxisPrice}
                    tick={{ fill: "#898781", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    width={70}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload as MileagePoint;
                        return (
                          <div className="rounded-xl border border-slate-700 bg-slate-900 p-3 shadow-xl text-xs space-y-1">
                            <p className="font-bold text-cyan-300 text-sm">{d.range}</p>
                            <p className="text-slate-200">
                              Ortalama Fiyat: <strong className="text-white">{formatPrice(d.avgPrice)}</strong>
                            </p>
                            <p className="text-slate-400">
                              Aralık: {formatPrice(d.minPrice)} – {formatPrice(d.maxPrice)}
                            </p>
                            <p className="text-slate-500">İlan Sayısı: {d.count} adet</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    dataKey="avgPrice"
                    fill="#38bdf8"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={48}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
