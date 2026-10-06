import { marketPosition, type MarketBand } from "@/lib/market-position";

const BAND_TEXT: Record<MarketBand, string> = {
  suspicious: "text-[var(--accent)]",
  cheap: "text-[var(--cheap)]",
  fair: "text-[var(--fair)]",
  pricey: "text-[var(--pricey)]",
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
  if (!position) {
    return (
      <div className={size === "md" ? "space-y-2" : "space-y-1.5"}>
        <div className="h-1 rounded-full bg-[var(--border)]" />
        <p className="eyebrow !text-[0.62rem] !tracking-[0.1em] text-[var(--faint)]">Piyasa verisi az</p>
      </div>
    );
  }
  return (
    <div className={size === "md" ? "space-y-2" : "space-y-1.5"}>
      <div
        className="gauge"
        role="img"
        aria-label={`Piyasaya göre: ${position.label} (${count} benzer ilan)`}
        title={`Piyasa ortalaması üzerinden: ${position.pct > 0 ? "+" : ""}${position.pct}% · ${count} benzer ilan`}
      >
        <span className="gauge-marker" style={{ left: `${position.marker}%` }} />
      </div>
      <p className={`num flex items-center justify-between gap-2 ${size === "md" ? "text-xs" : "text-[0.68rem]"}`}>
        <span className={`font-semibold uppercase tracking-[0.08em] ${BAND_TEXT[position.band]}`}>{position.label}</span>
        <span className="text-[var(--faint)]">{count} emsal</span>
      </p>
    </div>
  );
}
