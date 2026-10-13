"use client";

import { useState, useMemo } from "react";
import type { Condition } from "@/lib/price-prediction";

import { INITIAL_PARTS, labelAnchor, LABEL_COLUMN, REGIONS, VIEW_H, VIEW_W, type CarPart, type PartState } from "@/lib/car-parts-layout";

const STATE_COLORS: Record<PartState, { bg: string; text: string; border: string; label: string }> = {
  orijinal: { bg: "bg-emerald-500/15", text: "text-emerald-300", border: "border-emerald-500/30", label: "Orijinal" },
  boyali: { bg: "bg-amber-500/15", text: "text-amber-300", border: "border-amber-500/30", label: "Boyalı" },
  degisen: { bg: "bg-rose-500/15", text: "text-rose-300", border: "border-rose-500/30", label: "Değişen" },
};

/** Şemadaki bölge ve ok renkleri (SVG dolgusu/çizgisi). */
const STATE_SVG: Record<PartState, { fill: string; stroke: string }> = {
  orijinal: { fill: "rgba(16,185,129,0.28)", stroke: "#10b981" },
  boyali: { fill: "rgba(234,178,74,0.55)", stroke: "#eab24a" },
  degisen: { fill: "rgba(239,68,68,0.62)", stroke: "#ef4444" },
};

interface InteractiveDamageSelectorProps {
  condition: Condition;
  onChange: (condition: Condition, summaryNote?: string) => void;
}

/**
 * Araç şablonu: bölgeler duruma göre renklenir, her bölgeden bir ok parça adına gider. Hem bölgeye hem etikete dokunmak
 * durumu değiştirir. Etiketler SVG'nin dışında HTML'dir: şema küçülünce yazı küçülmez, ad hiçbir ekranda kesilmez.
 */
function CarPartsDiagram({ parts, onToggle }: { parts: CarPart[]; onToggle: (id: string) => void }) {
  const stateOf = (id: string): PartState => parts.find((p) => p.id === id)?.state ?? "orijinal";
  const nameOf = (id: string) => parts.find((p) => p.id === id)?.name ?? id;
  return (
    <div className="relative mx-auto w-full max-w-[380px]" style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}` }}>
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="absolute inset-0 h-full w-full" role="group" aria-label="Araç parça şeması">
        {/* gövde, camlar ve tekerlekler (yalnızca süs) */}
        <path
          d="M170 52 C200 52 222 64 224 94 L226 150 L226 250 L224 312 C222 340 200 354 170 354 C140 354 118 340 116 312 L114 250 L114 150 L116 94 C118 64 140 52 170 52 Z"
          fill="rgba(30,41,59,0.55)"
          stroke="rgba(148,163,184,0.45)"
          strokeWidth="1.5"
        />
        <path d="M150 131 L190 131 L186 142 L154 142 Z" fill="rgba(100,116,139,0.45)" />
        <path d="M154 241 L186 241 L190 252 L150 252 Z" fill="rgba(100,116,139,0.45)" />
        <g fill="rgba(15,23,42,0.95)" stroke="rgba(148,163,184,0.35)" strokeWidth="1">
          <rect x="108" y="86" width="9" height="30" rx="4" />
          <rect x="223" y="86" width="9" height="30" rx="4" />
          <rect x="108" y="286" width="9" height="30" rx="4" />
          <rect x="223" y="286" width="9" height="30" rx="4" />
        </g>

        {REGIONS.map((region) => {
          const state = stateOf(region.id);
          const color = STATE_SVG[state];
          const anchor = labelAnchor(region);
          return (
            <g key={region.id}>
              <line
                x1={anchor.x}
                y1={anchor.y}
                x2={region.target.x}
                y2={region.target.y}
                stroke={color.stroke}
                strokeWidth="1.6"
                strokeDasharray="3 3"
                style={{ pointerEvents: "none" }}
              />
              <rect
                x={region.x}
                y={region.y}
                width={region.w}
                height={region.h}
                rx={region.r}
                fill={color.fill}
                stroke={color.stroke}
                strokeWidth="1.5"
                className="cursor-pointer transition-opacity hover:opacity-80"
                role="button"
                tabIndex={0}
                aria-label={`${nameOf(region.id)}: ${STATE_COLORS[state].label}. Değiştirmek için dokun.`}
                onClick={() => onToggle(region.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onToggle(region.id);
                  }
                }}
              />
              <circle cx={region.target.x} cy={region.target.y} r="3.5" fill={color.stroke} style={{ pointerEvents: "none" }} />
            </g>
          );
        })}
      </svg>

      {REGIONS.map((region) => {
        const state = stateOf(region.id);
        const meta = STATE_COLORS[state];
        const { side, y } = region.label;
        const position =
          side === "left"
            ? { left: 0, width: `${LABEL_COLUMN * 100}%` }
            : side === "right"
            ? { right: 0, width: `${LABEL_COLUMN * 100}%` }
            : { left: "50%" };
        const align = side === "left" ? "items-end text-right" : side === "right" ? "items-start text-left" : "items-center text-center";
        return (
          <button
            key={region.id}
            type="button"
            onClick={() => onToggle(region.id)}
            className={`absolute flex ${side === "top" || side === "bottom" ? "-translate-x-1/2" : ""} -translate-y-1/2 flex-col gap-0.5 rounded-lg border px-1.5 py-1 ${align} ${meta.bg} ${meta.border} transition hover:brightness-125`}
            style={{ top: `${(y / VIEW_H) * 100}%`, ...position }}
          >
            <span className="text-[11px] font-semibold leading-tight text-slate-100 max-[360px]:text-[9.5px]">{nameOf(region.id)}</span>
            {/* 340 px altında durum sözcüğü gizlenir: etiket renkli (renk durumu söyler, ayrıntı yukarıdaki listede); yer kalmıyor. */}
            <span className={`text-[9px] font-bold uppercase tracking-wider max-[340px]:hidden ${meta.text}`}>{meta.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function InteractiveDamageSelector({
  condition,
  onChange,
}: InteractiveDamageSelectorProps) {
  const [showDiagram, setShowDiagram] = useState(false);
  const [parts, setParts] = useState<CarPart[]>(INITIAL_PARTS);

  // Parça durumunu döngüsel değiştir (Orijinal -> Boyalı -> Değişen -> Orijinal)
  function togglePart(id: string) {
    const updated = parts.map((p) => {
      if (p.id !== id) return p;
      const nextState: PartState =
        p.state === "orijinal" ? "boyali" : p.state === "boyali" ? "degisen" : "orijinal";
      return { ...p, state: nextState };
    });
    setParts(updated);

    // Otomatik condition ve özet hesapla
    const degisenCount = updated.filter((p) => p.state === "degisen").length;
    const boyaliCount = updated.filter((p) => p.state === "boyali").length;

    let derivedCondition: Condition = "clean";
    if (degisenCount > 0) {
      derivedCondition = "damaged";
    } else if (boyaliCount > 0) {
      derivedCondition = "painted";
    }

    const note =
      degisenCount === 0 && boyaliCount === 0
        ? "Tüm parçalar orijinal"
        : [
            degisenCount > 0 ? `${degisenCount} parça değişen` : null,
            boyaliCount > 0 ? `${boyaliCount} parça boyalı` : null,
          ]
            .filter(Boolean)
            .join(", ");

    onChange(derivedCondition, note);
  }

  // Hızlı önayar seçimi
  function selectPreset(c: Condition) {
    onChange(c);
    if (c === "clean") {
      setParts(parts.map((p) => ({ ...p, state: "orijinal" })));
    } else if (c === "painted") {
      // Örnek 2 parça boyalı yap
      setParts(
        parts.map((p) =>
          p.id === "sag_on_camurluk" || p.id === "sag_on_kapi"
            ? { ...p, state: "boyali" }
            : { ...p, state: "orijinal" }
        )
      );
    } else if (c === "damaged") {
      // Örnek değişen parça yap
      setParts(
        parts.map((p) =>
          p.id === "kaput"
            ? { ...p, state: "degisen" }
            : p.id === "sag_on_camurluk"
            ? { ...p, state: "boyali" }
            : { ...p, state: "orijinal" }
        )
      );
    }
  }

  const stats = useMemo(() => {
    const degisen = parts.filter((p) => p.state === "degisen").length;
    const boyali = parts.filter((p) => p.state === "boyali").length;
    const orijinal = parts.filter((p) => p.state === "orijinal").length;
    return { degisen, boyali, orijinal };
  }, [parts]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-slate-300">
          Araç Hasar & Ekspertiz Durumu
        </label>
        <button
          type="button"
          onClick={() => setShowDiagram(!showDiagram)}
          className="text-xs font-semibold text-amber-400 hover:text-amber-300 transition flex items-center gap-1"
        >
          <span>{showDiagram ? "▲ Şemayı Gizle" : "▼ Detaylı Parça Şeması (Ekspertiz)"}</span>
        </button>
      </div>

      {/* 3 Hızlı Durum Kartı / Çipi */}
      <div className="grid grid-cols-3 gap-2.5">
        <button
          type="button"
          onClick={() => selectPreset("clean")}
          className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition ${
            condition === "clean" && !showDiagram
              ? "bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-lg shadow-emerald-500/10 font-bold"
              : "bg-slate-900/60 border-white/10 text-slate-400 hover:border-white/20"
          }`}
        >
          <span className="text-xs">Hatasız / Orijinal</span>
          <span className="text-[10px] opacity-60 mt-0.5">Boya / Değişen Yok</span>
        </button>

        <button
          type="button"
          onClick={() => selectPreset("painted")}
          className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition ${
            condition === "painted" && !showDiagram
              ? "bg-amber-500/20 border-amber-400 text-amber-300 shadow-lg shadow-amber-500/10 font-bold"
              : "bg-slate-900/60 border-white/10 text-slate-400 hover:border-white/20"
          }`}
        >
          <span className="text-xs">Boyalı</span>
          <span className="text-[10px] opacity-60 mt-0.5">Çizik / Lokal Boya</span>
        </button>

        <button
          type="button"
          onClick={() => selectPreset("damaged")}
          className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition ${
            condition === "damaged" && !showDiagram
              ? "bg-rose-500/20 border-rose-400 text-rose-300 shadow-lg shadow-rose-500/10 font-bold"
              : "bg-slate-900/60 border-white/10 text-slate-400 hover:border-white/20"
          }`}
        >
          <span className="text-xs">Değişen / Hasarlı</span>
          <span className="text-[10px] opacity-60 mt-0.5">Parça Değişimi Var</span>
        </button>
      </div>

      {/* İnteraktif Parça Şeması (Açılır Panel) */}
      {showDiagram && (
        <div className="rounded-2xl border border-white/15 bg-slate-950/80 p-3 sm:p-4 space-y-4 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
            <div>
              <p className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>İnteraktif Araç Parça Seçici</span>
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Parçaya her tıkladığında durumu değişir:{" "}
                <strong className="text-emerald-400">Orijinal</strong> ➔{" "}
                <strong className="text-amber-400">Boyalı</strong> ➔{" "}
                <strong className="text-rose-400">Değişen</strong>
              </p>
            </div>

            {/* Parça Durum Sayaçları */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-emerald-300 font-semibold">
                {stats.orijinal} Orijinal
              </span>
              <span className="rounded bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-amber-300 font-semibold">
                {stats.boyali} Boyalı
              </span>
              <span className="rounded bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 text-rose-300 font-semibold">
                {stats.degisen} Değişen
              </span>
            </div>
          </div>

          {/* Parça listesi: adlar kesilmez, sığmayan ad alt satıra geçer */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {parts.map((p) => {
              const meta = STATE_COLORS[p.state];
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => togglePart(p.id)}
                  className={`flex flex-col items-start gap-1 p-2.5 rounded-xl border transition text-left ${meta.bg} ${meta.border} hover:scale-[1.02]`}
                >
                  <span className="text-[13px] font-medium leading-tight text-slate-200">{p.name}</span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${meta.text}`}>
                    {meta.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Araç şablonu: bölgelerden çıkan oklar parça adlarına gider */}
          <div className="border-t border-white/10 pt-4">
            <p className="mb-3 text-center text-[11px] text-slate-400">Araç şablonu: bölgeye ya da yazıya dokunarak durumu değiştir</p>
            <CarPartsDiagram parts={parts} onToggle={togglePart} />
          </div>

          {/* Sıfırlama Butonu */}
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => {
                setParts(parts.map((p) => ({ ...p, state: "orijinal" })));
                onChange("clean", "Tüm parçalar orijinal");
              }}
              className="text-[11px] text-slate-400 hover:text-white transition"
            >
              Tüm Parçaları Orijinal Yap
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default InteractiveDamageSelector;
