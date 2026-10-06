"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const MiniMapInner = dynamic(() => import("@/components/MiniMapInner"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-white/5" />,
});

interface Props {
  lat: number;
  lng: number;
  /** İlçe konumu için 12, yalnızca il merkezi bilindiğinde 9 gibi bir değer. */
  zoom?: number;
  /** Haritanın altındaki not (ör. "yaklaşık konum"). */
  note?: string;
}

/**
 * Küçük önizleme harita; tıklayınca tam ekran, sürüklenebilir büyük harita açılır
 * (Esc, ✕ ya da boşluğa tıklama kapatır).
 */
export function MiniMap({ lat, lng, zoom = 12, note }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <>
      <div className="relative h-48 overflow-hidden rounded-xl border border-white/10">
        <MiniMapInner lat={lat} lng={lng} zoom={zoom} interactive={false} />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Haritayı büyüt"
          className="absolute inset-0 z-[500] flex items-start justify-end bg-transparent p-2 transition hover:bg-black/10"
        >
          <span className="rounded-lg bg-slate-900/85 px-2.5 py-1 text-xs font-bold text-amber-300 shadow">⤢ Büyüt</span>
        </button>
      </div>
      {note && <p className="mt-1 text-[11px] text-slate-500">{note}</p>}

      {open && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/75 p-3 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label="İlan konumu"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative h-full max-h-[760px] w-full max-w-5xl overflow-hidden rounded-2xl border border-white/15 bg-slate-900 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <MiniMapInner lat={lat} lng={lng} zoom={zoom} interactive />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Haritayı kapat"
              className="absolute right-3 top-3 z-[1100] rounded-full bg-slate-900/90 px-3 py-1.5 text-sm font-bold text-white shadow hover:bg-slate-800"
            >
              ✕ Kapat
            </button>
            {note && (
              <p className="absolute bottom-3 left-3 z-[1100] rounded-md bg-slate-900/85 px-2 py-1 text-[11px] text-slate-300">{note}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
