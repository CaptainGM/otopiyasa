"use client";

import dynamic from "next/dynamic";
import type { BrandSummary } from "@/lib/brand-summaries";
import type { BrandTrends } from "@/lib/brand-trends";
import type { ModelCurves } from "@/lib/model-curves";
import type { YearStats } from "@/types";


function ChartSkeleton({ height = 320 }: { height?: number }) {
  return (
    <div
      className="flex animate-pulse items-center justify-center rounded-2xl border border-white/5 bg-white/[0.02] text-sm text-slate-500"
      style={{ height }}
    >
      Grafik yükleniyor…
    </div>
  );
}

export const PriceCharts = dynamic(
  () => import("@/components/PriceCharts").then((m) => m.PriceCharts),
  { ssr: false, loading: () => <ChartSkeleton height={380} /> }
) as (props: { brandSummaries: BrandSummary[]; byYear: YearStats[] }) => React.ReactElement;

export const ModelCurveChart = dynamic(
  () => import("@/components/ModelCurveChart").then((m) => m.ModelCurveChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
) as (props: { curves: ModelCurves }) => React.ReactElement;

export const BrandTrendChart = dynamic(
  () => import("@/components/BrandTrendChart").then((m) => m.BrandTrendChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
) as (props: { trends: BrandTrends }) => React.ReactElement;
