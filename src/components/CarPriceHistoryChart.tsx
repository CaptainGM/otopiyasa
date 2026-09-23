"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatPrice } from "@/lib/utils";

interface CarPriceHistoryChartProps {
  data: Array<{ date: string; price: number }>;
}

function formatAxisPrice(val: number): string {
  if (val >= 1_000_000) {
    const m = val / 1_000_000;
    return `${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M ₺`;
  }
  return `${Math.round(val / 1000)}B ₺`;
}

function CustomTooltip({
  active,
  payload,
  label,
  firstPrice,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  firstPrice?: number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const currentVal = payload[0].value;
  const diffFromFirst = firstPrice !== undefined ? currentVal - firstPrice : 0;

  return (
    <div className="rounded-xl border border-white/15 bg-[#0f1117]/95 px-4 py-3 shadow-2xl backdrop-blur-md">
      <p className="text-[11px] font-semibold text-slate-400">{label}</p>
      <p className="text-base font-black text-white mt-0.5">{formatPrice(currentVal)}</p>
      {diffFromFirst !== 0 && (
        <p
          className={`text-[11px] font-semibold mt-1 flex items-center gap-1 ${
            diffFromFirst < 0 ? "text-emerald-400" : "text-rose-400"
          }`}
        >
          <span>{diffFromFirst < 0 ? "📉 İlk fiyata göre indirim:" : "📈 İlk fiyata göre artış:"}</span>
          <span>{diffFromFirst < 0 ? "-" : "+"}{formatPrice(Math.abs(diffFromFirst))}</span>
        </p>
      )}
    </div>
  );
}

export function CarPriceHistoryChart({ data }: CarPriceHistoryChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-white/5 bg-white/[0.01] text-center text-sm text-slate-500">
        Bu araç için henüz fiyat geçmişi verisi bulunmuyor.
      </div>
    );
  }

  const prices = data.map((d) => d.price);
  const first = prices[0];
  const last = prices[prices.length - 1];
  const change = last - first;
  const changePct = first ? Math.round((change / first) * 1000) / 10 : 0;

  // Fiyat değişim rengi: İndirimse Zümrüt Yeşili (#10b981), Zam ise Mercan (#f43f5e), Sabitse Amber (#f59e0b)
  const isDiscount = change < 0;
  const isHike = change > 0;
  const strokeColor = isDiscount ? "#10b981" : isHike ? "#f43f5e" : "#f59e0b";
  const gradientId = isDiscount ? "discountGrad" : isHike ? "hikeGrad" : "stableGrad";

  // Y Eksenini dinamik zoom'la ayarla (Düz çizgi sorununu çözer!)
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const diff = maxPrice - minPrice;
  const padding = diff > 0 ? diff * 0.4 : minPrice * 0.05;
  const yDomain: [number, number] = [
    Math.max(0, Math.floor((minPrice - padding) / 10000) * 10000),
    Math.ceil((maxPrice + padding) / 10000) * 10000,
  ];

  if (data.length === 1) {
    return (
      <div className="flex h-64 flex-col justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-6 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
          İlan Fiyat Takibi Aktif
        </div>
        <div>
          <p className="text-3xl font-black tracking-tight text-white">{formatPrice(last)}</p>
          <p className="text-xs text-slate-500 mt-1">{data[0].date} tarihinde yayına girdi.</p>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed border-t border-white/5 pt-3">
          Araç satıcısı fiyatı her güncellediğinde sistemimiz bunu anlık tespit eder ve bu alanda indirim/fiyat hareket grafiği oluşturur.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5 shadow-sm">
      {/* 1. ÖZET METRİK KARTLARI */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">İlk İlan Fiyatı</p>
          <p className="text-base font-bold text-slate-300 mt-0.5">{formatPrice(first)}</p>
          <p className="text-[10px] text-slate-500">{data[0].date}</p>
        </div>

        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Güncel Fiyat</p>
          <p className="text-base font-bold text-white mt-0.5">{formatPrice(last)}</p>
          <p className="text-[10px] text-slate-500">{data[data.length - 1].date}</p>
        </div>

        <div
          className={`rounded-xl border p-3 ${
            isDiscount
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
              : isHike
              ? "border-rose-500/20 bg-rose-500/10 text-rose-400"
              : "border-slate-700 bg-slate-800/40 text-slate-300"
          }`}
        >
          <p className="text-[11px] font-medium uppercase tracking-wider opacity-80">Toplam Değişim</p>
          <p className="text-base font-black mt-0.5 flex items-center gap-1">
            {isDiscount && <span>↓ -{formatPrice(Math.abs(change))}</span>}
            {isHike && <span>↑ +{formatPrice(change)}</span>}
            {!isDiscount && !isHike && <span>Fiyat Sabit</span>}
          </p>
          <p className="text-[10px] font-semibold opacity-90">
            {change !== 0 ? `%${Math.abs(changePct)} ${isDiscount ? "indirim uygulandı" : "fiyat arttı"}` : "Değişiklik olmadı"}
          </p>
        </div>
      </div>

      {/* 2. DİNAMİK YAKINLAŞTIRILMIŞ GRAFİK */}
      <div className="h-60 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 12, right: 12, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="discountGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="hikeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="stableGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              tickLine={false}
            />
            <YAxis
              domain={yDomain}
              tickFormatter={formatAxisPrice}
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={65}
            />
            <Tooltip content={<CustomTooltip firstPrice={first} />} cursor={{ stroke: strokeColor, strokeWidth: 1.5, strokeDasharray: "3 3" }} />
            <Area
              type="monotone"
              dataKey="price"
              stroke={strokeColor}
              strokeWidth={2.8}
              fill={`url(#${gradientId})`}
              dot={{ fill: strokeColor, stroke: "#0f1117", strokeWidth: 2, r: 4.5 }}
              activeDot={{ r: 7, stroke: "#ffffff", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* 3. ŞEFFAF FİYAT ADIMLARI ZAMAN ÇİZELGESİ */}
      <div className="border-t border-white/5 pt-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
          Fiyat Güncelleme Geçmişi ({data.length} Kayıt)
        </p>
        <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
          {data.slice().reverse().map((point, idx) => {
            const isLatest = idx === 0;
            return (
              <div
                key={idx}
                className="flex items-center justify-between text-xs py-1 px-2.5 rounded-lg bg-white/[0.02] border border-white/5"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isLatest ? (isDiscount ? "bg-emerald-400" : isHike ? "bg-rose-400" : "bg-amber-400") : "bg-slate-600"
                    }`}
                  />
                  <span className="text-slate-400">{point.date}</span>
                  {isLatest && <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wide">(Son Fiyat)</span>}
                </div>
                <span className="font-bold text-slate-200">{formatPrice(point.price)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

