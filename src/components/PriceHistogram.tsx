"use client";

import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { buildPriceBins } from "@/lib/price-bins";

interface Props {
  prices: number[];
  currentPrice: number;
  segmentLabel: string;
  
  brand?: string;
}

const BAR_COLOR = "#64748b";
const HIGHLIGHT_COLOR = "#f0b23c";

export function PriceHistogram({ prices, currentPrice, segmentLabel, brand }: Props) {
  const router = useRouter();
  const bins = buildPriceBins(prices, currentPrice);
  if (bins.length === 0) return null;

  const currentBin = bins.find((bin) => bin.isCurrent);
  const data = bins.map((bin) => ({
    ...bin,
    topLabel: bin.count === 0 ? "" : bin.isCurrent ? `Bu araç · ${bin.count}` : String(bin.count),
  }));

  function goToRange(entry: { payload?: (typeof data)[number] } & Partial<(typeof data)[number]>) {
    const bin = entry.payload ?? entry;
    if (!brand || !bin.count || bin.min === undefined || bin.max === undefined) return;
    const params = new URLSearchParams({
      brand,
      priceMin: String(bin.min),
      priceMax: String(bin.max),
    });
    router.push(`/?${params.toString()}`);
  }

  return (
    <div>
      <h3 className="text-lg font-semibold">Bu araç piyasada nerede?</h3>
      <p className="mb-3 text-xs leading-relaxed text-slate-500">
        Her çubuk bir <strong className="text-slate-300">fiyat aralığını</strong>,
        yüksekliği o aralıktaki <strong className="text-slate-300">ilan sayısını</strong>{" "}
        gösterir ({segmentLabel} segmenti, {prices.length} ilan).{" "}
        <span className="font-bold text-amber-300">Sarı çubuk</span> bu aracın aralığı
        {currentBin ? ` (${currentBin.label})` : ""}.
        {brand && " Bir çubuğa tıklayınca o aralıktaki ilanları listeler."}
      </p>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 22, right: 4, bottom: 4, left: 4 }}>
            <XAxis
              dataKey="label"
              tick={{ fill: "#93a1b8", fontSize: 10 }}
              axisLine={{ stroke: "#383835" }}
              tickLine={false}
              interval={0}
              angle={-24}
              height={52}
              textAnchor="end"
              label={{
                value: "Fiyat aralığı",
                position: "insideBottom",
                offset: -2,
                fill: "#64748b",
                fontSize: 11,
              }}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: "#93a1b8", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={34}
              label={{
                value: "İlan sayısı",
                angle: -90,
                position: "insideLeft",
                fill: "#64748b",
                fontSize: 11,
              }}
            />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              formatter={(value: number) => [`${value} ilan`, "Bu aralıkta"]}
              contentStyle={{
                background: "#10151f",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 10,
                color: "#e6ebf5",
              }}
              labelStyle={{ color: "#93a1b8" }}
            />
            <Bar
              dataKey="count"
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
              onClick={(entry) => goToRange(entry)}
              cursor={brand ? "pointer" : undefined}
            >
              {data.map((bin) => (
                <Cell
                  key={bin.label}
                  fill={bin.isCurrent ? HIGHLIGHT_COLOR : BAR_COLOR}
                />
              ))}
              <LabelList
                dataKey="topLabel"
                position="top"
                content={(props) => {
                  const { x, y, width, value, index } = props as {
                    x: number;
                    y: number;
                    width: number;
                    value: string;
                    index: number;
                  };
                  if (!value) return null;
                  const isCurrent = data[index]?.isCurrent;
                  return (
                    <text
                      x={Number(x) + Number(width) / 2}
                      y={Number(y) - 6}
                      textAnchor="middle"
                      fontSize={11}
                      fontWeight={isCurrent ? 800 : 600}
                      fill={isCurrent ? "#f0b23c" : "#93a1b8"}
                    >
                      {value}
                    </text>
                  );
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
