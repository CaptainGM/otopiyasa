"use client";

import { useEffect, useState } from "react";
import { isInCompare, toggleCompare, subscribeCompare, MAX_COMPARE } from "@/lib/compare-store";

export function CompareButton({
  carId,
  variant = "icon",
}: {
  carId: string;
  variant?: "icon" | "full";
}) {
  const [active, setActive] = useState(false);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    setActive(isInCompare(carId));
    return subscribeCompare(() => setActive(isInCompare(carId)));
  }, [carId]);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const { full } = toggleCompare(carId);
    if (full) {
      setFlash(true);
      setTimeout(() => setFlash(false), 1500);
    }
  }

  if (variant === "full") {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-pressed={active}
        title={flash ? `En fazla ${MAX_COMPARE} araç karşılaştırılabilir` : undefined}
        className={`inline-flex min-h-10 max-w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition sm:px-4 sm:text-sm ${
          active
            ? "border-amber-400/50 bg-amber-400/15 text-amber-200 hover:bg-amber-400/20"
            : "border-white/15 bg-white/5 text-slate-200 hover:border-amber-400/40 hover:text-amber-200"
        }`}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M3 7h13m0 0-3-3m3 3-3 3M21 17H8m0 0 3 3m-3-3 3-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="min-w-0 whitespace-normal text-center">
          {flash ? `En fazla ${MAX_COMPARE} araç` : active ? "Eklendi · kaldır" : <><span className="sm:hidden">Karşılaştır</span><span className="hidden sm:inline">Karşılaştırmaya ekle</span></>}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title={
        flash
          ? `En fazla ${MAX_COMPARE} araç karşılaştırılabilir`
          : active
            ? "Karşılaştırmadan çıkar"
            : "Karşılaştırmaya ekle"
      }
      aria-label={active ? "Karşılaştırmadan çıkar" : "Karşılaştırmaya ekle"}
      aria-pressed={active}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-full border backdrop-blur-sm transition ${
        active
          ? "border-amber-400 bg-amber-400 text-[#221202]"
          : "border-white/20 bg-black/50 text-white hover:bg-black/70"
      }`}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M3 7h13m0 0-3-3m3 3-3 3M21 17H8m0 0 3 3m-3-3 3-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
