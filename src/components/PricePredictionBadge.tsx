import { formatPrice } from "@/lib/utils";
import { PricePrediction } from "@/lib/price-prediction";

const METHOD_LABELS: Record<PricePrediction["method"], string> = {
  segment: "aynı marka/model verisiyle",
  "brand+model": "marka verisi + bu modelin ilanlarıyla",
  brand: "aynı marka verisiyle",
  global: "genel veri seti ile",
  average: "genel ortalama ile",
};

export function PricePredictionBadge({
  actualPrice,
  prediction,
}: {
  actualPrice: number;
  prediction: PricePrediction;
}) {
  if (prediction.sampleSize < 3) {
    return null;
  }

  const diff = actualPrice - prediction.predictedPrice;
  const pct = prediction.predictedPrice
    ? Math.round((diff / prediction.predictedPrice) * 100)
    : 0;

 
  const lowConfidence =
    (prediction.method === "brand" || prediction.method === "global") &&
    (prediction.segmentSize ?? 0) < 3;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
        ML tahmini fiyat ({METHOD_LABELS[prediction.method]})
      </p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
        <strong className="text-base text-emerald-200">
          {formatPrice(prediction.predictedPrice)}
        </strong>
        <span className="text-xs font-bold text-slate-300">
          İlan {diff > 0 ? "+" : ""}
          {formatPrice(diff)} ({pct > 0 ? "+" : ""}
          {pct}%)
        </span>
      </div>
      {lowConfidence && (
        <p className="mt-2 text-[11px] leading-relaxed text-amber-300/90">
          Bu marka/modelde piyasada yeterli karşılaştırma ilanı yok (yalnızca{" "}
          {prediction.segmentSize} eşleşme) — tahmin{" "}
          {prediction.method === "global" ? "tüm piyasa ortalamasına" : "marka geneline"}{" "}
          dayanıyor ve gerçek değerden belirgin şekilde uzak olabilir.
          {prediction.comparableRange &&
            ` Bulunan gerçek ilan(lar): ${formatPrice(prediction.comparableRange.min)} – ${formatPrice(prediction.comparableRange.max)}.`}
        </p>
      )}
    </div>
  );
}
