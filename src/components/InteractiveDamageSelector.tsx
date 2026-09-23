"use client";

import { useState, useMemo } from "react";
import type { Condition } from "@/lib/price-prediction";

export type PartState = "orijinal" | "boyali" | "degisen";

export interface CarPart {
  id: string;
  name: string;
  state: PartState;
}

const INITIAL_PARTS: CarPart[] = [
  { id: "kaput", name: "Ön Kaput", state: "orijinal" },
  { id: "tavan", name: "Tavan", state: "orijinal" },
  { id: "bagaj", name: "Bagaj Kapağı", state: "orijinal" },
  { id: "sol_on_camurluk", name: "Sol Ön Çamurluk", state: "orijinal" },
  { id: "sol_on_kapi", name: "Sol Ön Kapı", state: "orijinal" },
  { id: "sol_arka_kapi", name: "Sol Arka Kapı", state: "orijinal" },
  { id: "sol_arka_camurluk", name: "Sol Arka Çamurluk", state: "orijinal" },
  { id: "sag_on_camurluk", name: "Sağ Ön Çamurluk", state: "orijinal" },
  { id: "sag_on_kapi", name: "Sağ Ön Kapı", state: "orijinal" },
  { id: "sag_arka_kapi", name: "Sağ Arka Kapı", state: "orijinal" },
  { id: "sag_arka_camurluk", name: "Sağ Arka Çamurluk", state: "orijinal" },
];

const STATE_COLORS: Record<PartState, { bg: string; text: string; border: string; label: string }> = {
  orijinal: { bg: "bg-emerald-500/15", text: "text-emerald-300", border: "border-emerald-500/30", label: "Orijinal" },
  boyali: { bg: "bg-amber-500/15", text: "text-amber-300", border: "border-amber-500/30", label: "Boyalı" },
  degisen: { bg: "bg-rose-500/15", text: "text-rose-300", border: "border-rose-500/30", label: "Değişen" },
};

interface InteractiveDamageSelectorProps {
  condition: Condition;
  onChange: (condition: Condition, summaryNote?: string) => void;
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
          <span className="text-lg mb-1">✨</span>
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
          <span className="text-lg mb-1">🎨</span>
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
          <span className="text-lg mb-1">⚠️</span>
          <span className="text-xs">Değişen / Hasarlı</span>
          <span className="text-[10px] opacity-60 mt-0.5">Parça Değişimi Var</span>
        </button>
      </div>

      {/* İnteraktif Parça Şeması (Açılır Panel) */}
      {showDiagram && (
        <div className="rounded-2xl border border-white/15 bg-slate-950/80 p-4 space-y-4 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
            <div>
              <p className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>🚗</span>
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
            <div className="flex items-center gap-2 text-xs">
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

          {/* Parça Kartları / Izgara */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            {parts.map((p) => {
              const meta = STATE_COLORS[p.state];
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => togglePart(p.id)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border transition text-left ${meta.bg} ${meta.border} hover:scale-[1.02]`}
                >
                  <span className="font-medium text-slate-200 truncate pr-2">{p.name}</span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${meta.text}`}>
                    {meta.label}
                  </span>
                </button>
              );
            })}
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
              🔄 Tüm Parçaları Orijinal Yap
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default InteractiveDamageSelector;
