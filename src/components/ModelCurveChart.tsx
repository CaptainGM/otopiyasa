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
import { ModelCurves } from "@/lib/model-curves";
import { formatPrice } from "@/lib/utils";


const SERIES_COLORS = ["#3987e5", "#008300", "#d55181", "#c98500", "#199e70"];

export function ModelCurveChart({ curves }: { curves: ModelCurves }) {
  if (curves.segments.length === 0) return null;

  return (
    <div className="card p-5">
      <h3 className="mb-1 text-lg font-semibold">Model bazlı yıl-fiyat eğrisi</h3>
      <p className="mb-4 text-xs text-slate-500">
        En çok ilana sahip {curves.segments.length} modelin model yılına göre ortalama
        fiyatı — eğrinin eğimi o modelin yıllara göre değer kaybını gösterir.
      </p>
      <div className="h-96">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={curves.points} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis
              dataKey="year"
              tick={{ fill: "#898781", fontSize: 12 }}
              axisLine={{ stroke: "#383835" }}
              tickLine={false}
              label={{
                value: "Model yılı",
                position: "insideBottom",
                offset: -2,
                fill: "#64748b",
                fontSize: 11,
              }}
            />
            <YAxis
              tickFormatter={(value) => `${Math.round(value / 1000)}B`}
              tick={{ fill: "#898781", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={48}
              label={{
                value: "Ortalama fiyat (₺)",
                angle: -90,
                position: "insideLeft",
                fill: "#64748b",
                fontSize: 11,
              }}
            />
            <Tooltip
              formatter={(value: number) => formatPrice(value)}
              labelFormatter={(year) => `${year} model`}
              contentStyle={{
                background: "#10151f",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 10,
                color: "#e6ebf5",
              }}
              labelStyle={{ color: "#93a1b8" }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {curves.segments.map((segment, index) => (
              <Line
                key={segment}
                type="monotone"
                dataKey={segment}
                stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
                strokeWidth={2}
                connectNulls
                dot={{ r: 3, strokeWidth: 0, fill: SERIES_COLORS[index % SERIES_COLORS.length] }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
