import { formatPrice } from "@/lib/utils";
import { PricePrediction } from "@/lib/price-prediction";

const METHOD_LABELS: Record<PricePrediction["method"], string> = {
  segment: "Aynı marka/model segmenti",
  "brand+model": "Marka regresyonu + model düzeltmesi",
  brand: "Marka geneli regresyonu",
  global: "Tüm piyasa genel havuzu",
  average: "Genel piyasa ortalaması",
};

export function PricePredictionBadge({
  actualPrice,
  prediction,
  marketAvgPrice,
  marketListingCount,
}: {
  actualPrice: number;
  prediction: PricePrediction;
  marketAvgPrice?: number;
  marketListingCount?: number;
}) {
  if (prediction.sampleSize < 3) {
    return null;
  }

  const diff = actualPrice - prediction.predictedPrice;
  const pct = prediction.predictedPrice
    ? Math.round((diff / prediction.predictedPrice) * 100)
    : 0;

  // Termometre ibresi (0 fark %50 merkezde, her %1 fark için %2.5 kayma)
  const pinPosition = Math.max(6, Math.min(94, 50 + pct * 2.5));

  let statusTag = "Piyasa Değerinde";
  let statusIcon = "🟢";
  let statusColor = "text-sky-300 border-sky-500/30 bg-sky-500/10";
  let analysisDesc = `İlan fiyatı, aracın model yılı, kilometresi ve hasar kondisyonuna göre hesaplanan adil piyasa ederiyle tam uyumludur.`;

  if (pct <= -6) {
    statusTag = `Kondisyonuna Göre %${Math.abs(pct)} Hesaplı (Fırsat)`;
    statusIcon = "🔥";
    statusColor = "text-emerald-300 border-emerald-500/30 bg-emerald-500/15";
    analysisDesc = `Bu araç, benzer kilometre ve hasar kondisyonundaki emsallerine göre %${Math.abs(pct)} daha avantajlı fiyatlandırılmıştır.`;
  } else if (pct >= 6) {
    statusTag = `Hasar ve KM Durumuna Göre %${pct} Yüksek`;
    statusIcon = "🔴";
    statusColor = "text-rose-300 border-rose-500/30 bg-rose-500/15";
    analysisDesc = `Bu araç, aynı kilometre ve hasar durumundaki piyasa beklentisinin %${pct} üzerinde fiyatlandırılmıştır.`;
  }

  const lowConfidence =
    (prediction.method === "brand" || prediction.method === "global") &&
    (prediction.segmentSize ?? 0) < 3;

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 space-y-3.5 shadow-xl backdrop-blur-md">
      {/* Üst Başlık & Rozet */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-lg">🌡️</span>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Yapay Zeka Fiyat Analiz Termometresi
            </h4>
            <p className="text-[11px] text-slate-400">
              {METHOD_LABELS[prediction.method]} · {prediction.sampleSize} emsal araç
            </p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${statusColor}`}>
          <span>{statusIcon}</span>
          {statusTag}
        </span>
      </div>

      {/* Fiyat Kıyaslama Rakamları */}
      <div
        className={`grid ${
          marketAvgPrice && marketListingCount && marketListingCount >= 2
            ? "grid-cols-1 sm:grid-cols-3"
            : "grid-cols-2"
        } gap-3 rounded-xl bg-white/5 p-3 border border-white/5`}
      >
        <div>
          <p className="text-[11px] text-slate-400">AI Adil Piyasa Ederi</p>
          <p className="text-base font-black text-emerald-300">
            {formatPrice(prediction.predictedPrice)}
          </p>
          <p className="text-[10px] text-slate-500">KM ve hasara göre</p>
        </div>
        <div>
          <p className="text-[11px] text-slate-400">Piyasa Farkı</p>
          <p
            className={`text-base font-bold ${
              pct < 0 ? "text-emerald-400" : pct > 0 ? "text-rose-400" : "text-sky-300"
            }`}
          >
            {diff > 0 ? "+" : ""}{formatPrice(diff)} ({pct > 0 ? "+" : ""}{pct}%)
          </p>
          <p className="text-[10px] text-slate-500">
            {pct < 0 ? "Fırsat avantajı" : pct > 0 ? "Piyasa üzerinde" : "Tam ederinde"}
          </p>
        </div>
        {marketAvgPrice && marketListingCount && marketListingCount >= 2 ? (
          <div>
            <p className="text-[11px] text-slate-400">Segment Ham Ort.</p>
            <p className="text-base font-bold text-amber-200">
              {formatPrice(marketAvgPrice)}
            </p>
            <p className="text-[10px] text-slate-500">
              Aynı model/yıl: {marketListingCount} ilan
            </p>
          </div>
        ) : null}
      </div>

      {/* Görsel Termometre Çubuğu */}
      <div className="space-y-1.5 pt-1">
        <div className="relative h-3 w-full rounded-full bg-gradient-to-r from-emerald-500 via-sky-400 to-rose-500 p-0.5 shadow-inner">
          {/* İbre / Pin */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center transition-all duration-500"
            style={{ left: `${pinPosition}%` }}
          >
            <div className="h-4 w-4 rounded-full border-2 border-slate-900 bg-white shadow-md" />
          </div>
        </div>
        {/* Termometre Bölge Açıklamaları */}
        <div className="flex justify-between text-[10px] font-semibold text-slate-400">
          <span className="text-emerald-400">Fırsat (Hesaplı)</span>
          <span className="text-sky-300">Adil Değer</span>
          <span className="text-rose-400">Piyasa Üstü</span>
        </div>
      </div>

      {/* Açıklama Metni */}
      <p className="text-xs leading-relaxed text-slate-300 border-t border-white/5 pt-2.5">
        💡 {analysisDesc}
      </p>

      {lowConfidence && (
        <p className="rounded-lg bg-amber-500/10 p-2.5 text-[11px] leading-relaxed text-amber-300/90 border border-amber-500/20">
          ⚠️ Bu model segmentinde piyasada sınırlı sayıda ({prediction.segmentSize} ilan) veri bulunduğu için aralık geniş olabilir.
          {prediction.comparableRange &&
            ` Bulunan ilanlar: ${formatPrice(prediction.comparableRange.min)} – ${formatPrice(prediction.comparableRange.max)}.`}
        </p>
      )}
    </div>
  );
}

