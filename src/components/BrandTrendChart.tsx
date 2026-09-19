"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BrandTrends } from "@/lib/brand-trends";
import { formatPrice } from "@/lib/utils";

// Koyu kart zemininde (#10151f) dataviz doğrulayıcısından geçen 5'li kategorik palet
const SERIES_COLORS = ["#3987e5", "#008300", "#d55181", "#c98500", "#199e70"];

export function BrandTrendChart({ trends }: { trends: BrandTrends }) {
  if (trends.brands.length === 0 || trends.points.length === 0) return null;

  const singleMonth = trends.points.length === 1;

  return (
    <div className="card p-5">
      <h3 className="mb-1 text-lg font-semibold">Marka bazlı fiyat trendi</h3>
      <p className="mb-4 text-xs text-slate-500">
        En çok ilana sahip {trends.brands.length} markanın ilan tarihine göre aylık
        ortalama fiyatı{singleMonth ? " — veri çoğaldıkça çizgiler uzayacak" : ""}.
      </p>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trends.points} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis
              dataKey="month"
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
              formatter={(value: number) => formatPrice(value)}
              contentStyle={{
                background: "#10151f",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 10,
                color: "#e6ebf5",
              }}
              labelStyle={{ color: "#93a1b8" }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {trends.brands.map((brand, index) => (
              <Line
                key={brand}
                type="monotone"
                dataKey={brand}
                stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
                strokeWidth={2}
                connectNulls
                dot={{ r: singleMonth ? 5 : 3, strokeWidth: 0, fill: SERIES_COLORS[index % SERIES_COLORS.length] }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
