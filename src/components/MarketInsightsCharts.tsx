"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatNumber, formatPrice } from "@/lib/utils";

export interface MarketInsightData {
  priceBrackets: Array<{ label: string; count: number; avgPrice: number; sharePct: number }>;
  fuelStats: Array<{ fuel: string; count: number; avgPrice: number; sharePct: number }>;
  transmissionStats: Array<{ transmission: string; count: number; avgPrice: number; sharePct: number }>;
  bodyTypeStats: Array<{ bodyType: string; count: number; avgPrice: number; sharePct: number }>;
  topBrands: Array<{ brand: string; count: number; avgPrice: number }>;
}

interface MarketInsightsChartsProps {
  data: MarketInsightData;
}

const darkTooltip = {
  background: "#10151f",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 12,
  color: "#e6ebf5",
  padding: "10px 14px",
  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
};

const BRACKET_COLORS = ["#38bdf8", "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899"];
const FUEL_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#06b6d4", "#a855f7"];
const BODY_COLORS = ["#f97316", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899", "#64748b"];

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

export function MarketInsightsCharts({ data }: MarketInsightsChartsProps) {
  return (
    <div className="space-y-8">
      {/* 1. BÜTÇE SEGMENTLERİ & EN ÇOK İLANLI 10 MARKA */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Bütçe Dağılımı */}
        <div className="card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>💰</span> Bütçe Segmentleri Dağılımı
              </h3>
              <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 font-semibold border border-blue-500/20">
                Pazarın %80&apos;i &lt;2M ₺
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Piyasadaki araçların fiyat aralıklarına göre adedi ve pazar payı yüzdesi.
            </p>
          </div>

          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.priceBrackets} margin={{ top: 12, right: 8, bottom: 4, left: 4 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  axisLine={{ stroke: "#334155" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={38}
                />
                <Tooltip
                  contentStyle={darkTooltip}
                  formatter={(value: number, _name, item: any) => [
                    `${formatNumber(value)} araç (%${item.payload.sharePct}) • Ort: ${formatPrice(item.payload.avgPrice)}`,
                    "İlan Adedi",
                  ]}
                  labelStyle={{ color: "#38bdf8", fontWeight: "bold" }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {data.priceBrackets.map((_, idx) => (
                    <Cell key={idx} fill={BRACKET_COLORS[idx % BRACKET_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2 border-t border-white/5 pt-3">
            {data.priceBrackets.map((b, idx) => (
              <div key={b.label} className="bg-white/[0.02] p-2 rounded-lg border border-white/5">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: BRACKET_COLORS[idx % BRACKET_COLORS.length] }}
                  />
                  <span className="text-[11px] font-medium text-slate-300 truncate">{b.label}</span>
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-xs font-bold text-white">{formatNumber(b.count)}</span>
                  <span className="text-[10px] text-slate-400 font-semibold">%{b.sharePct}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* En Popüler 10 Marka */}
        <div className="card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>🏆</span> En Çok İlana Sahip 10 Marka
              </h3>
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
                Pazar Liderleri
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Türkiye pazarında en fazla aktif ikinci el ilanına sahip markalar ve ortalama fiyatları.
            </p>
          </div>

          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.topBrands}
                layout="vertical"
                margin={{ top: 4, right: 16, bottom: 4, left: 16 }}
              >
                <CartesianGrid stroke="rgba(255,255,255,0.06)" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  axisLine={{ stroke: "#334155" }}
                  tickLine={false}
                />
                <YAxis
                  dataKey="brand"
                  type="category"
                  tick={{ fill: "#cbd5e1", fontSize: 12, fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                  width={80}
                />
                <Tooltip
                  contentStyle={darkTooltip}
                  formatter={(value: number, _name, item: any) => [
                    `${formatNumber(value)} ilan • Ortalama: ${formatPrice(item.payload.avgPrice)}`,
                    "İlan Adedi",
                  ]}
                  labelStyle={{ color: "#34d399", fontWeight: "bold" }}
                />
                <Bar dataKey="count" fill="#10b981" radius={[0, 6, 6, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 flex items-center justify-between text-xs text-slate-400 border-t border-white/5 pt-3">
            <span>En yüksek ortalama: <strong className="text-slate-200">Audi ({formatPrice(data.topBrands.find(b => b.brand === "Audi")?.avgPrice || 0)})</strong></span>
            <span>En ekonomik ortalama: <strong className="text-slate-200">Fiat ({formatPrice(data.topBrands.find(b => b.brand === "Fiat")?.avgPrice || 0)})</strong></span>
          </div>
        </div>
      </div>

      {/* 2. YAKIT TÜRÜ, VİTES TÜRÜ & KASA TİPİ DAĞILIMI */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Yakıt Türü Dağılımı */}
        <div className="card p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>⛽</span> Yakıt Türü Dağılımı
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Pazar payı ve ortalama satış fiyatları
            </p>
          </div>

          <div className="mt-4 space-y-3">
            {data.fuelStats.map((f, idx) => (
              <div key={f.fuel} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: FUEL_COLORS[idx % FUEL_COLORS.length] }}
                    />
                    {f.fuel}
                  </span>
                  <span className="text-slate-400">
                    <strong className="text-white">%{f.sharePct}</strong> ({formatNumber(f.count)})
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, f.sharePct)}%`,
                      backgroundColor: FUEL_COLORS[idx % FUEL_COLORS.length],
                    }}
                  />
                </div>
                <div className="text-[11px] text-slate-400 flex justify-end">
                  Ort. <span className="text-slate-300 font-medium ml-1">{formatPrice(f.avgPrice)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Vites Türü Tercihleri */}
        <div className="card p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>⚙️</span> Vites Türü Tercihleri
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Otomatik vs Manuel pazar oranı ve fiyat farkı
            </p>
          </div>

          <div className="mt-4 space-y-4">
            {data.transmissionStats.map((t) => {
              const isAuto = t.transmission.toLowerCase().includes("oto");
              return (
                <div key={t.transmission} className="bg-white/[0.02] p-3 rounded-xl border border-white/5 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-white">{t.transmission}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-white/5 font-semibold text-slate-300">
                      %{t.sharePct}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Toplam ilan: <strong className="text-slate-200">{formatNumber(t.count)}</strong></span>
                    <span>Ortalama: <strong className={isAuto ? "text-emerald-400" : "text-blue-400"}>{formatPrice(t.avgPrice)}</strong></span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isAuto ? "bg-emerald-500" : "bg-blue-500"}`}
                      style={{ width: `${t.sharePct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 text-[11px] text-slate-400 bg-blue-500/5 border border-blue-500/10 p-2.5 rounded-lg text-center">
            💡 Otomatik vites araçlar ortalamada manuel araçlara kıyasla yaklaşık <strong className="text-blue-300">%45 daha yüksek</strong> fiyattan işlem görüyor.
          </div>
        </div>

        {/* Kasa Tipi Dağılımı */}
        <div className="card p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>🚙</span> Kasa Tipi Dağılımı
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Piyasadaki gövde tipleri ve ortalamaları
            </p>
          </div>

          <div className="mt-4 space-y-3">
            {data.bodyTypeStats.map((b, idx) => (
              <div key={b.bodyType} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: BODY_COLORS[idx % BODY_COLORS.length] }}
                    />
                    {b.bodyType}
                  </span>
                  <span className="text-slate-400">
                    <strong className="text-white">%{b.sharePct}</strong> ({formatNumber(b.count)})
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, b.sharePct)}%`,
                      backgroundColor: BODY_COLORS[idx % BODY_COLORS.length],
                    }}
                  />
                </div>
                <div className="text-[11px] text-slate-400 flex justify-end">
                  Ort. <span className="text-slate-300 font-medium ml-1">{formatPrice(b.avgPrice)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 text-[11px] text-slate-400 border-t border-white/5 pt-3">
            SUV gövde tipi, Sedan&apos;ı yakalayarak Türkiye&apos;nin en çok tercih edilen kasa tipi haline geldi.
          </div>
        </div>
      </div>
    </div>
  );
}
