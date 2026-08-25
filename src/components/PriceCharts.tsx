"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BrandSummary } from "@/lib/brand-summaries";
import { YearStats } from "@/types";
import { formatPrice } from "@/lib/utils";

interface PriceChartsProps {
  brandSummaries: BrandSummary[];
  byYear: YearStats[];
}

const BAR_COLOR = "#3987e5";

const LOW_SAMPLE_LIMIT = 5;
const LOW_SAMPLE_COLOR = "#33507a";

const darkTooltip = {
  background: "#10151f",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 10,
  color: "#e6ebf5",
};

interface BrandTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: BrandSummary }>;
}

function BrandTooltip({ active, payload }: BrandTooltipProps) {
  if (!active || !payload?.length) return null;
  const summary = payload[0].payload;

  return (
    <div
      className="rounded-xl border border-white/10 bg-[#10151f] p-3 text-sm shadow-xl"
      style={{ minWidth: 210 }}
    >
      <p className="font-bold text-white">{summary.brand}</p>
      <p className="mt-0.5 text-amber-300">
        Ortalama {formatPrice(summary.avgPrice)}
        <span className="text-slate-500"> • {summary.count} ilan</span>
      </p>
      {summary.count < LOW_SAMPLE_LIMIT && (
        <p className="mt-1 text-[11px] text-slate-500">
          Az ilan — ortalama güvenilir değil.
        </p>
      )}
      {summary.topModels.length > 0 && (
        <div className="mt-2 space-y-1 border-t border-white/10 pt-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            En çok ilan verilen modeller
          </p>
          {summary.topModels.map((model) => (
            <p key={model.model} className="flex justify-between gap-4 text-xs">
              <span className="text-slate-300">
                {model.model}
                <span className="text-slate-600"> ×{model.count}</span>
              </span>
              <span className="font-semibold text-slate-100">
                {formatPrice(model.avgPrice)}
              </span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export function PriceCharts({ brandSummaries, byYear }: PriceChartsProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="card p-5">
        <h3 className="text-lg font-semibold">Markaya göre ortalama fiyat</h3>
        <p className="text-xs text-slate-500">
          Veritabanındaki {brandSummaries.length} markanın tamamı, ilan sayısına
          göre sıralı — çubuğun üzerine gel: ortalama fiyat, ilan sayısı ve en
          popüler modeller.
        </p>
        <p className="mb-3 text-xs text-slate-500">
          Sağa kaydırarak nadir markaları da görebilirsin. Soluk çubuklar
          <span className="text-slate-400"> {LOW_SAMPLE_LIMIT}&apos;ten az ilanı</span> olan,
          yani ortalaması güvenilmez markalardır.
        </p>
       
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <div
            className="h-80"
            style={{ minWidth: Math.max(320, brandSummaries.length * 54) }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={brandSummaries}
                margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
              >
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis
                  dataKey="brand"
                  tick={{ fill: "#93a1b8", fontSize: 11 }}
                  axisLine={{ stroke: "#383835" }}
                  tickLine={false}
                  interval={0}
                  angle={-35}
                  height={78}
                  textAnchor="end"
                />
                <YAxis
                  tickFormatter={(value) => `${Math.round(value / 1000)}B`}
                  tick={{ fill: "#898781", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  content={<BrandTooltip />}
                />
                <Bar dataKey="avgPrice" radius={[6, 6, 0, 0]} maxBarSize={40}>
                  {brandSummaries.map((summary) => (
                    <Cell
                      key={summary.brand}
                      fill={
                        summary.count >= LOW_SAMPLE_LIMIT ? BAR_COLOR : LOW_SAMPLE_COLOR
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="text-lg font-semibold">Model yılına göre ortalama fiyat</h3>
        <p className="mb-4 text-xs text-slate-500">
          Her nokta, o yıl model araçların güncel ilan fiyatı ortalaması — eski
          model yıllarındaki değerler o yıla ait ilanlardan gelir.
        </p>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={byYear} margin={{ top: 4, right: 8, bottom: 4, left: 4 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="year"
                tick={{ fill: "#898781", fontSize: 12 }}
                axisLine={{ stroke: "#383835" }}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(value) => `${Math.round(value / 1000)}B`}
                tick={{ fill: "#898781", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={44}
              />
              <Tooltip
                formatter={(value: number, _name, item) => [
                  `${formatPrice(value)} (${item?.payload?.count ?? "?"} ilan)`,
                  "Ortalama",
                ]}
                labelFormatter={(year) => `${year} model`}
                contentStyle={darkTooltip}
                labelStyle={{ color: "#93a1b8" }}
              />
              <Line
                type="monotone"
                dataKey="avgPrice"
                stroke={BAR_COLOR}
                strokeWidth={2}
                dot={{ r: 3, strokeWidth: 0, fill: BAR_COLOR }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
