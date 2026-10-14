"use client";

import type { PriceGuard, SellDamage, SellEstimate } from "@/lib/sell-estimate";

/** /api/sell/estimate yanıtı: aralık, hasar bilgisi, uyarılar ve kuralların eşikleri. */
export interface SellEstimateResponse extends SellEstimate {
  damageKnown: boolean;
  warnings: string[];
}

export type EstimateView =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; data: SellEstimateResponse };

const tl = (value: number) => `${Math.round(value).toLocaleString("tr-TR")} TL`;

interface Props {
  view: EstimateView;
  damage: SellDamage | "";
  guard: PriceGuard | null;
}

/** Satış formundaki piyasa fiyat aralığı. Aralık yalnızca güvenilir olduğunda gösterilir; değilse neden söylenir. */
export function SellEstimateCard({ view, damage, guard }: Props) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm" aria-live="polite">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Piyasa fiyat aralığı</p>

      {view.status === "idle" && (
        <p className="mt-1 text-slate-400">
          Marka, model, yıl, kilometre, yakıt, vites ve hasar durumunu seçince benzer ilanlara göre aralık burada görünür.
        </p>
      )}
      {view.status === "loading" && <p className="mt-1 text-slate-400">Benzer ilanlar kontrol ediliyor…</p>}
      {view.status === "error" && <p className="mt-1 text-rose-300">{view.error}</p>}

      {view.status === "ready" && (
        <>
          {view.data.confident && view.data.tier ? (
            <>
              <p className="mt-1 text-lg font-bold text-slate-100">
                {tl(view.data.tier.p25)} – {tl(view.data.tier.p75)}
              </p>
              <p className="text-slate-300">Orta değer: {tl(view.data.tier.median)}</p>
              <p className="mt-1 text-xs text-slate-400">
                {view.data.tier.n} benzer ilana göre · {view.data.tier.label}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Benzer ilanlar yalnızca hasar durumuna göre ayrılır, boya durumu ayrıca ayrılmaz. Bu bir tahmindir, değer garantisi değildir.
              </p>
            </>
          ) : (
            <>
              <p className="mt-1 text-slate-300">{view.data.reason}</p>
              {damage === "hasarli" && (
                <p className="mt-1 text-xs text-slate-500">
                  Hasarlı araçlarda benzer ilan sayısı az olduğu için aralık çoğu zaman çıkmaz.
                </p>
              )}
            </>
          )}

          {view.data.warnings.map((warning) => (
            <p key={warning} className="mt-2 text-xs text-amber-300">{warning}</p>
          ))}

          {guard?.level === "block" && (
            <div className="mt-3 rounded-lg border border-rose-400/30 bg-rose-500/10 p-3 text-rose-200">{guard.message}</div>
          )}
          {guard?.level === "warn" && (
            <div className="mt-3 rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-amber-200">{guard.message}</div>
          )}
        </>
      )}
    </div>
  );
}
