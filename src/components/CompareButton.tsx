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
        className={`btn ${active ? "btn-primary" : "btn-secondary"}`}
      >
        {active ? "Karşılaştırmadan çıkar" : "Karşılaştırmaya ekle"}
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
      aria-label="Karşılaştırmaya ekle"
      className={`inline-flex h-7 w-7 items-center justify-center rounded-full border backdrop-blur-sm transition ${
        active
          ? "border-amber-400 bg-amber-400 text-[#221202]"
          : "border-white/20 bg-black/50 text-white hover:bg-black/70"
      }`}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
        {active ? (
          <path d="M5 12l4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          
          <>
            <rect x="4" y="5" width="6.5" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
            <rect x="13.5" y="5" width="6.5" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
          </>
        )}
      </svg>
    </button>
  );
}
