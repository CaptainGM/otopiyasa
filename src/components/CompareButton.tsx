"use client";

import { useEffect, useState } from "react";
import { isInCompare, toggleCompare, subscribeCompare, MAX_COMPARE } from "@/lib/compare-store";
import { Icon } from "@/components/Icon";

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
        className={`btn btn-secondary max-w-full ${active ? "!border-[var(--accent)] !text-[var(--accent)]" : ""}`}
      >
        <Icon name="compare" size={17} />
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
      className="photo-btn"
    >
      <Icon name="compare" size={15} strokeWidth={1.8} />
    </button>
  );
}
