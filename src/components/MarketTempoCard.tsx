"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import type { MarketTempo } from "@/lib/market-tempo";

/**
 * Piyasa temposu: benzer ilanlar kaç günde yayından kalkıyor, satıcıların ne kadarı indirime gidiyor (pazarlık payı).
 * Ayrı istekle gelir (hesap ilk seferde birkaç saniye sürebilir, sonuç 6 saat CDN'de). Veri yetersizse hiç çizilmez:
 * uydurma rakam gösterilmez. "Yayından kalkma" satış demek değildir; metin bunu açıkça söyler.
 */
export function MarketTempoCard({ carId }: { carId: string }) {
  const [tempo, setTempo] = useState<MarketTempo | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/cars/${carId}/tempo`)
      .then((res) => (res.ok ? res.json() : { tempo: null }))
      .then((data: { tempo: MarketTempo | null }) => {
        if (!cancelled) setTempo(data.tempo ?? null);
      })
      .catch(() => {
        if (!cancelled) setTempo(null);
      });
    return () => {
      cancelled = true;
    };
  }, [carId]);

  if (tempo === undefined) {
    return <div className="surface-2 h-[118px] animate-pulse" aria-hidden />;
  }
  if (!tempo || (!tempo.days && !tempo.drop)) return null;

  return (
    <section className="surface-2 space-y-3 p-4" aria-label="Piyasa temposu">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="eyebrow flex items-center gap-1.5">
          <Icon name="pulse" size={14} />
          Piyasa temposu
        </p>
        <span className="text-xs text-[var(--muted)]">{tempo.scopeLabel}</span>
      </div>
      <dl className="grid grid-cols-2 gap-3">
        {tempo.days && (
          <div>
            <dt className="text-xs text-[var(--muted)]">Yayında kalma süresi</dt>
            <dd className="num mt-0.5 text-2xl font-semibold text-[var(--accent-2)]">~{tempo.days.median} gün</dd>
            <dd className="text-[0.75rem] text-[var(--muted)]">
              çoğu {tempo.days.p25}–{tempo.days.p75} gün · {tempo.days.sample} ilan
            </dd>
          </div>
        )}
        {tempo.drop && (
          <div>
            <dt className="text-xs text-[var(--muted)]">Pazarlık payı</dt>
            <dd className="num mt-0.5 text-2xl font-semibold text-[var(--accent-2)]">%{tempo.drop.medianPct.toLocaleString("tr-TR")}</dd>
            <dd className="text-[0.75rem] text-[var(--muted)]">
              ilanların %{tempo.drop.share}&apos;inde indirim · {tempo.drop.sample} ilan
            </dd>
          </div>
        )}
      </dl>
      <p className="text-[0.8rem] leading-relaxed text-[var(--muted)]">
        Benzer ilanların kaynaktan kalkma süresi ve yayındayken yaptıkları indirimlerden hesaplanır. Yayından kalkma her
        zaman satış anlamına gelmez.
      </p>
    </section>
  );
}
