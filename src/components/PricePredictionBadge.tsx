import { formatPrice } from "@/lib/utils";
import { PricePrediction } from "@/lib/price-prediction";
import { SUSPICIOUS_DISCOUNT } from "@/lib/deals";
import { FAIR_BAND_PCT } from "@/lib/market-position";
import { Icon } from "@/components/Icon";

const METHOD_LABELS: Record<PricePrediction["method"], string> = {
  segment: "Aynı marka/model segmenti",
  "brand+model": "Marka regresyonu + model düzeltmesi",
  brand: "Marka geneli regresyonu",
  global: "Tüm piyasa genel havuzu",
  average: "Genel piyasa ortalaması",
};

type Band = "suspicious" | "cheap" | "fair" | "pricey";

const BAND_STYLE: Record<Band, { text: string; chip: string }> = {
  suspicious: { text: "text-[var(--accent)]", chip: "border-[var(--accent)] text-[var(--accent)]" },
  cheap: { text: "text-[var(--cheap)]", chip: "border-[var(--cheap)] text-[var(--cheap)]" },
  fair: { text: "text-[var(--fair)]", chip: "border-[var(--fair)] text-[var(--fair)]" },
  pricey: { text: "text-[var(--pricey)]", chip: "border-[var(--pricey)] text-[var(--pricey)]" },
};

/**
 * İlan sayfasındaki fiyat analizi: ilan fiyatı, aynı yıl/km/hasar durumundaki emsallerden hesaplanan adil değerle
 * karşılaştırılır (bkz. lib/price-prediction.ts). Bantlar kart göstergesiyle aynı: ±%6 adil, %30+ altı şüpheli.
 */
export function PricePredictionBadge({
  actualPrice,
  prediction,
  marketAvgPrice,
  marketListingCount,
  marketScope,
  marketFamilyLabel,
}: {
  actualPrice: number;
  prediction: PricePrediction;
  marketAvgPrice?: number;
  marketListingCount?: number;
  marketScope?: "model" | "family";
  marketFamilyLabel?: string;
}) {
  if (prediction.sampleSize < 3) {
    return null;
  }

  const diff = actualPrice - prediction.predictedPrice;
  const pct = prediction.predictedPrice ? Math.round((diff / prediction.predictedPrice) * 100) : 0;

  // İbre: 0 fark ortada, her %1 fark için %2,5 kayma.
  const pinPosition = Math.max(6, Math.min(94, 50 + pct * 2.5));

  let band: Band = "fair";
  let statusTag = "Piyasa değerinde";
  let analysisDesc =
    "İlan fiyatı, aracın model yılı, kilometresi ve hasar durumuna göre hesaplanan adil piyasa değeriyle uyumlu.";

  if (pct <= -Math.round(SUSPICIOUS_DISCOUNT * 100)) {
    band = "suspicious";
    statusTag = `Dikkat: piyasanın %${Math.abs(pct)} altında`;
    analysisDesc =
      "Bu fiyat benzer araçların çok altında. Bu kadar düşük fiyatlar çoğu zaman hatalı girilmiş ya da kapora/dolandırıcılık amaçlı ilanlardır: aracı görmeden ve ekspertiz yaptırmadan ödeme yapma, IBAN'a kapora gönderme.";
  } else if (pct <= -FAIR_BAND_PCT) {
    band = "cheap";
    statusTag = `Emsallerine göre %${Math.abs(pct)} hesaplı`;
    analysisDesc = `Bu araç, benzer kilometre ve hasar durumundaki emsallerine göre %${Math.abs(pct)} daha uygun fiyatlı.`;
  } else if (pct >= FAIR_BAND_PCT) {
    band = "pricey";
    statusTag = `Emsallerine göre %${pct} yüksek`;
    analysisDesc = `Bu araç, aynı kilometre ve hasar durumundaki piyasa beklentisinin %${pct} üzerinde fiyatlandırılmış.`;
  }

  const lowConfidence =
    (prediction.method === "brand" || prediction.method === "global") && (prediction.segmentSize ?? 0) < 3;
  const showSegment = !!marketAvgPrice && !!marketListingCount && marketListingCount >= 3;
  const style = BAND_STYLE[band];

  return (
    <section className="surface-2 space-y-4 p-4" aria-label="Fiyat analizi">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="eyebrow flex items-center gap-1.5">
            <Icon name="thermo" size={14} />
            Fiyat analizi
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {METHOD_LABELS[prediction.method]} · {prediction.sampleSize} emsal araç
          </p>
        </div>
        <span className={`badge !bg-transparent ${style.chip}`}>
          {band === "suspicious" && <Icon name="warning" size={13} />}
          {statusTag}
        </span>
      </div>

      <dl className={`grid gap-3 ${showSegment ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2"}`}>
        <div>
          <dt className="text-[11px] text-[var(--muted)]">Adil piyasa değeri</dt>
          <dd className="num mt-0.5 text-base font-semibold">{formatPrice(prediction.predictedPrice)}</dd>
          <dd className="text-[10px] text-[var(--faint)]">km ve hasara göre</dd>
        </div>
        <div>
          <dt className="text-[11px] text-[var(--muted)]">Fark</dt>
          <dd className={`num mt-0.5 text-base font-semibold ${style.text}`}>
            {diff > 0 ? "+" : ""}
            {formatPrice(diff)} ({pct > 0 ? "+" : pct < 0 ? "−" : ""}%{Math.abs(pct)})
          </dd>
          <dd className="text-[10px] text-[var(--faint)]">
            {pct < 0 ? "değerinin altında" : pct > 0 ? "değerinin üstünde" : "tam değerinde"}
          </dd>
        </div>
        {showSegment ? (
          <div>
            <dt className="text-[11px] text-[var(--muted)]">Segment ortalaması</dt>
            <dd className="num mt-0.5 text-base font-semibold">{formatPrice(marketAvgPrice!)}</dd>
            <dd className="text-[10px] text-[var(--faint)]">
              {marketScope === "family" && marketFamilyLabel
                ? `${marketFamilyLabel} ailesi, aynı yıl (tüm donanımlar): ${marketListingCount} aktif ilan`
                : `Aynı marka/model/yıl: ${marketListingCount} aktif ilan`}
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="space-y-1.5">
        <div className="gauge">
          <span className="gauge-marker" style={{ left: `${pinPosition}%` }} />
        </div>
        <div className="num flex justify-between text-[10px] uppercase tracking-[0.08em]">
          <span className="text-[var(--cheap)]">Hesaplı</span>
          <span className="text-[var(--fair)]">Adil</span>
          <span className="text-[var(--pricey)]">Yüksek</span>
        </div>
      </div>

      <p className="border-t border-[var(--border)] pt-3 text-xs leading-relaxed text-[var(--muted)]">{analysisDesc}</p>

      {lowConfidence && (
        <p className="flex gap-2 rounded-lg border border-[var(--border-strong)] p-2.5 text-[11px] leading-relaxed text-[var(--muted)]">
          <Icon name="warning" size={14} className="mt-0.5 shrink-0 text-[var(--accent)]" />
          <span>
            Bu model segmentinde piyasada sınırlı sayıda ({prediction.segmentSize} ilan) veri bulunduğu için aralık geniş
            olabilir.
            {prediction.comparableRange &&
              ` Bulunan ilanlar: ${formatPrice(prediction.comparableRange.min)} – ${formatPrice(prediction.comparableRange.max)}.`}
          </span>
        </p>
      )}
    </section>
  );
}
