"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ListingCompleteness } from "@/lib/listing-completeness";

/**
 * İlan kalitesi rozeti: yuvarlak, yalnızca puan. Dokununca açılan panel başlıkta "İlan kalitesi {puan}" yazar ve puanın
 * nedenini kalem kalem gösterir. Puan ilanın bilgi tamlığını ölçer; aracın durumunu ya da satıcının güvenilirliğini ölçmez.
 */
export function ListingQualityBadge({ quality }: { quality: ListingCompleteness }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const tone =
    quality.score >= 80 ? "border-[var(--cheap)] text-[var(--cheap)]" : quality.score >= 50 ? "border-amber-300 text-amber-300" : "border-rose-300 text-rose-300";

  // Panel dışına dokunulunca ya da Escape'e basılınca kapanır.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={`${quality.score} puan, nedenini görmek için dokun`}
        className={`num flex h-14 w-14 items-center justify-center rounded-full border-2 bg-black/60 text-xl font-bold ${tone}`}
      >
        {quality.score}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={`İlan kalitesi ${quality.score}`}
          className="surface-2 absolute left-0 top-full z-20 mt-2 w-72 max-w-[calc(100vw-2rem)] p-3 text-left text-xs"
        >
          <p className="text-sm font-semibold">İlan kalitesi {quality.score}</p>
          <p className="mt-1 leading-relaxed text-[var(--muted)]">
            Puan, aşağıdaki dört kalemin toplamıdır. Her kalemin en fazla puanı yanındadır.
          </p>
          <ul className="mt-3 space-y-2">
            {quality.items.map((item) => (
              <li key={item.key} className="flex items-start justify-between gap-3">
                <span>
                  <span className="block font-medium">{item.label}</span>
                  <span className="block text-[var(--muted)]">{item.note}</span>
                </span>
                <span className="num shrink-0 font-semibold">
                  {item.earned}/{item.max}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 leading-relaxed text-[var(--muted)]">
            Bu puan ilanın ne kadar eksiksiz bilgi verdiğini ölçer; aracın durumunu ya da satıcının güvenilirliğini ölçmez.{" "}
            <Link href="/gizlilik#ilan-kalitesi" className="underline">
              Nasıl hesaplanır?
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
