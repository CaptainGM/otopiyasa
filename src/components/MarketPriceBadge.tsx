import { formatPrice } from "@/lib/utils";

interface MarketPriceBadgeProps {
  price: number;
  marketAvgPrice?: number;
  marketListingCount?: number;
  compact?: boolean;
}

export function MarketPriceBadge({
  price,
  marketAvgPrice,
  marketListingCount,
  compact = false,
}: MarketPriceBadgeProps) {
  if (!marketAvgPrice || !marketListingCount || marketListingCount < 2) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-400">
        Bu segment için henüz yeterli ilan yok
      </div>
    );
  }

  const diff = price - marketAvgPrice;
  const pct = Math.round((diff / marketAvgPrice) * 100);
  const isAbove = diff > 0;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
        {compact ? "Piyasa ort." : "Bu araca özel piyasa ortalaması"}
      </p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
        <strong className="text-base text-amber-200">{formatPrice(marketAvgPrice)}</strong>
        <span
          className={`text-xs font-bold ${isAbove ? "market-up" : diff < 0 ? "market-down" : "text-slate-300"}`}
        >
          {diff === 0
            ? "Piyasa ortalamasında"
            : `${isAbove ? "+" : ""}${formatPrice(diff)} (${isAbove ? "+" : ""}${pct}%)`}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-slate-500">
        Aynı marka / model / yıl: {marketListingCount} ilan
      </p>
    </div>
  );
}
