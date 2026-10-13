import { formatPrice } from "@/lib/utils";
import type { PriceScale, PriceScaleTier } from "@/lib/price-scale";

/** Yüzde konumunu [0, 100] aralığına sıkıştırır (ilan fiyatı emsal aralığının dışında kalabilir). */
const pct = (value: number, min: number, max: number) => {
  const span = max - min || 1;
  return Math.min(100, Math.max(0, ((value - min) / span) * 100));
};

function positionText(tier: PriceScaleTier): string {
  const diff = tier.medianDiffPct ?? 0;
  if (Math.abs(diff) < 5) return "Piyasa seviyesinde";
  return diff < 0 ? `Medyanın %${Math.abs(diff)} altında` : `Medyanın %${diff} üstünde`;
}

function ScaleBar({ tier, listingPrice }: { tier: PriceScaleTier; listingPrice: number }) {
  const min = tier.min ?? 0;
  const max = tier.max ?? min;
  const low = pct(tier.p25 ?? min, min, max);
  const high = pct(tier.p75 ?? max, min, max);
  return (
    <div className="space-y-2">
      <div className="relative h-3 rounded-full bg-white/10">
        <div className="absolute top-0 h-3 rounded-full bg-sky-400/30" style={{ left: `${low}%`, width: `${Math.max(2, high - low)}%` }} />
        <div className="absolute -top-1 h-5 w-0.5 bg-slate-200" style={{ left: `${pct(tier.median ?? min, min, max)}%` }} />
        <div
          className="absolute -top-1.5 h-6 w-3 -translate-x-1/2 rounded-full border-2 border-[var(--bg,#0b0f14)] bg-amber-400"
          style={{ left: `${pct(listingPrice, min, max)}%` }}
          title={`İlan: ${formatPrice(listingPrice)}`}
        />
      </div>
      <div className="flex justify-between text-[11px] text-slate-500">
        <span>{formatPrice(min)}</span>
        <span>{formatPrice(max)}</span>
      </div>
    </div>
  );
}

export function PriceScaleCard({ scale }: { scale: PriceScale }) {
  const tier = scale.tiers.find((t) => t.key === scale.chosen) ?? null;
  // Yalnızca aile geneli varsa konum yorumu yapılmaz: km, hasar ve donanım farkı büyük olabilir.
  const narrow = tier !== null && tier.key !== "aile";
  return (
    <section className="card space-y-4 p-5" aria-label="Fiyat skalası">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">Fiyat skalası</h2>
        {tier && <span className="text-xs text-slate-400">{tier.n} emsal</span>}
      </header>

      {tier ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-300">
            <strong className="text-base text-white">{formatPrice(tier.median ?? 0)}</strong> emsal medyanı
            {narrow ? ` · ${positionText(tier)}` : ""}
          </p>
          {narrow ? (
            <p className="text-xs text-slate-400">
              Emsallerin %{tier.cheaperPct} kadarı bu ilandan daha ucuz. Kademe: {tier.label.toLocaleLowerCase("tr-TR")}.
            </p>
          ) : (
            <p className="text-xs text-amber-300/90">
              Benzer km, hasar ve donanımda yeterli emsal yok; yalnızca aynı model ailesinin geneli gösteriliyor. Konum yorumu yapılmadı.
            </p>
          )}
          <ScaleBar tier={tier} listingPrice={scale.listingPrice} />
        </div>
      ) : (
        <p className="text-sm text-slate-400">
          Bu ilan için yeterli emsal yok. Aynı model ailesinden en az 3–5 benzer yayında ilan gerekir.
        </p>
      )}

      {/* Hesaplanamayan donanım kademeleri "0 ilan" diye gösterilmez: 0, "emsal yok" demek olurdu; oysa bilgi eksikti. */}
      <ul className="divide-y divide-white/5 text-sm">
        {scale.tiers.filter((t) => !t.missingPackage).map((t) => (
          <li key={t.key} className={`flex items-center justify-between gap-3 py-2 ${t.key === scale.chosen ? "text-white" : "text-slate-400"}`}>
            <span>
              {t.label}
              {t.note && <span className="block text-[11px] text-slate-500">{t.note}</span>}
            </span>
            <span className="num text-right">
              {t.usable && t.median != null ? (
                <>
                  {formatPrice(t.median)} <span className="text-[11px] text-slate-500">({t.n} ilan)</span>
                </>
              ) : (
                <span className="text-[11px] text-slate-500">{t.n} ilan</span>
              )}
            </span>
          </li>
        ))}
      </ul>

      {scale.inferredEngine !== null && (
        <p className="text-[11px] leading-relaxed text-amber-300/90">
          İlanda motor hacmi yazmıyor; aynı model, yakıt ve vitesteki emsallerin en yaygın motoru ({scale.inferredEngine.toFixed(1).replace(".", ",")} L)
          esas alındı.
        </p>
      )}
      {scale.tiers.some((t) => t.missingPackage) && (
        <p className="text-[11px] leading-relaxed text-slate-500">
          Donanım kademeleri için ilanda motor hacmi, yakıt ve vites bilgisi gerekli; eksik olduğu için gösterilmedi.
        </p>
      )}

      <p className="text-[11px] leading-relaxed text-slate-500">
        Donanım eşleşmesi motor hacmi, yakıt, vites ve beygir (±%10) ile yapılır; başlıktaki paket adı (ör. GT Line) yapısal veri
        olmadığı için kullanılmaz. Hasar eşleşmesi yalnızca ilk kademede aranır.
      </p>
    </section>
  );
}
