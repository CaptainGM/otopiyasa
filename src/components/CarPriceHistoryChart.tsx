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

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#0f1116] px-3 py-2 shadow-lg">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="text-sm font-bold text-amber-300">{formatPrice(payload[0].value)}</p>
    </div>
  );
}

export function CarPriceHistoryChart({ data }: CarPriceHistoryChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center text-center text-sm text-slate-500">
        Bu araç için henüz fiyat geçmişi yok.
      </div>
    );
  }

  const prices = data.map((d) => d.price);
  const first = prices[0];
  const last = prices[prices.length - 1];
  const change = last - first;
  const changePct = first ? Math.round((change / first) * 100) : 0;

  
  if (data.length === 1) {
    return (
      <div className="flex h-72 flex-col justify-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] px-6">
        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Güncel fiyat</p>
        <p className="text-3xl font-black tracking-tight text-[var(--text)]">{formatPrice(last)}</p>
        <p className="text-xs text-slate-500">{data[0].date} itibarıyla kaydedildi</p>
        <p className="mt-2 text-xs text-slate-500">
          Bu ilanın fiyatı her değiştiğinde buraya bir nokta eklenir ve zaman içindeki
          değişim grafiği oluşur.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-slate-400">Kayıtlı {data.length} fiyat noktası</span>
        <span
          className={`text-sm font-bold ${
            change > 0 ? "text-red-400" : change < 0 ? "text-emerald-400" : "text-slate-300"
          }`}
        >
          {change === 0
            ? "Değişim yok"
            : `${change > 0 ? "+" : ""}${formatPrice(change)} (${change > 0 ? "+" : ""}${changePct}%)`}
        </span>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f0b23c" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#f0b23c" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: "#6b7280", fontSize: 12 }}
              axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(value) => `${Math.round(value / 1000)}K`}
              tick={{ fill: "#6b7280", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={44}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(240,178,60,0.3)" }} />
            <Area
              type="monotone"
              dataKey="price"
              stroke="#f0b23c"
              strokeWidth={2.5}
              fill="url(#priceFill)"
              dot={{ fill: "#f0b23c", r: 3 }}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
