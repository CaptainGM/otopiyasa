"use client";

import { useEffect, useState } from "react";
import { formatPrice } from "@/lib/utils";

interface LiveMarketResult {
  avg: number;
  min: number;
  max: number;
  count: number;
  source: string;
}

export function LiveMarketBadge({
  brand,
  model,
  price,
}: {
  brand: string;
  model: string;
  price: number;
}) {
  const [data, setData] = useState<LiveMarketResult | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    fetch(`/api/market-average?brand=${encodeURIComponent(brand)}&model=${encodeURIComponent(model)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((json) => {
        if (cancelled) return;
        setData(json);
        setStatus("ok");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [brand, model]);

  if (status === "loading") {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <p className="flex items-center gap-2 text-xs text-slate-400">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-amber-300/40 border-t-amber-300" />
          Canlı piyasa ortalaması hesaplanıyor...
        </p>
      </div>
    );
  }

  if (status === "error" || !data) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-slate-500">
        Bu model için canlı piyasa ortalaması alınamadı.
      </div>
    );
  }

  const diff = price - data.avg;
  const pct = data.avg ? Math.round((diff / data.avg) * 100) : 0;
  const isDeal = pct <= -15;
  const above = diff > 0;

  return (
    <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3.5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-300/90">
          Canlı piyasa ortalaması
        </p>
        {isDeal && (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
            Fırsat aracı
          </span>
        )}
      </div>

      <div className="mt-1.5 flex flex-wrap items-end justify-between gap-2">
        <strong className="text-xl font-black text-[var(--text)]">{formatPrice(data.avg)}</strong>
        <span
          className={`text-sm font-bold ${
            above ? "text-red-400" : diff < 0 ? "text-emerald-400" : "text-slate-300"
          }`}
        >
          {diff === 0
            ? "Ortalamada"
            : `Bu ilan ${above ? "+" : ""}${formatPrice(diff)} (${above ? "+" : ""}${pct}%)`}
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
        <span>
          {data.count} canlı ilan • {formatPrice(data.min)} – {formatPrice(data.max)}
        </span>
        <span>{data.source}</span>
      </div>
    </div>
  );
}
