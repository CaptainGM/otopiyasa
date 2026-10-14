"use client";

import { useState } from "react";

/**
 * Sarı "!" simgesi: dokununca (ya da tıklayınca) açıklama kutusu açılır, tekrar dokununca kapanır. Üzerine gelme ipucuna
 * bağlı değildir; dokunmatik ekranda da çalışır.
 */
export function InfoHint({ text, label }: { text: string; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-amber-400 text-sm font-bold text-slate-950 hover:bg-amber-300"
      >
        !
      </button>
      {open && (
        <span
          role="note"
          className="absolute left-0 top-full z-10 mt-2 w-72 max-w-[85vw] rounded-lg border border-amber-400/40 bg-slate-900 p-3 text-xs font-normal leading-relaxed text-amber-100 shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
  );
}
