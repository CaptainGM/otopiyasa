import { marketPosition, type MarketBand } from "@/lib/market-position";

/** Bant renkleri: şüpheli ucuz kırmızı (uyarı), ucuz yeşil, adil mavi, pahalı mercan. */
export const BAND_COLOR: Record<MarketBand, string> = {
  suspicious: "var(--danger)",
  cheap: "var(--cheap)",
  fair: "var(--fair)",
  pricey: "var(--pricey)",
};

/**
 * Fiyatın kendi segmentindeki yeri: ucuz (yeşil) → adil (mavi) → pahalı (mercan) çubuğu üzerinde ibre.
 * Sitenin imza öğesi: her kartta "bu fiyat iyi mi?" sorusunun cevabı tek bakışta. Emsal yetersizse
 * yer kaplamayan ince bir "piyasa verisi az" satırı çizilir (kartların boyu eşit kalsın).
 */
export function MarketGauge({
  price,
  avg,
  count,
  size = "sm",
}: {
  price: number;
  avg?: number | null;
  count?: number | null;
  size?: "sm" | "md";
}) {
  const position = marketPosition(price, avg, count);
  const md = size === "md";
  if (!position) {
    return (
      <div className={md ? "space-y-2" : "space-y-1.5"}>
        <div className="h-1.5 rounded-full bg-[var(--border)]" />
        <p className="eyebrow !text-[0.66rem] !tracking-[0.1em] text-[var(--faint)]">Piyasa verisi az</p>
      </div>
    );
  }
  const color = BAND_COLOR[position.band];
  return (
    <div className={md ? "space-y-2.5" : "space-y-2"}>
      <div
        className={`gauge ${md ? "gauge-lg" : ""}`}
        role="img"
        aria-label={`Piyasaya göre: ${position.label} (${count} benzer ilan)`}
        title={`Piyasa ortalaması üzerinden: ${position.pct > 0 ? "+" : ""}${position.pct}% · ${count} benzer ilan`}
      >
        <span className="gauge-marker" style={{ left: `${position.marker}%`, ["--marker" as string]: color }} />
      </div>
      <p className={`flex items-center justify-between gap-2 ${md ? "text-sm" : "text-xs"}`}>
        <span className="font-bold uppercase tracking-[0.04em]" style={{ color }}>
          {position.label}
        </span>
        <span className="num text-[var(--muted)]">{count} emsal</span>
      </p>
    </div>
  );
}
