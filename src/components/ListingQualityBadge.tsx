"use client";

import Link from "next/link";
import { useState } from "react";
import type { ListingCompleteness } from "@/lib/listing-completeness";

/**
 * İlan kalitesi rozeti: puan görünür, dokununca kalemler açılır (üzerine gelmek gerekmez).
 * Puan ilanın bilgi tamlığını ölçer; aracın durumunu ya da satıcının güvenilirliğini ölçmez.
 */
export function ListingQualityBadge({ quality }: { quality: ListingCompleteness }) {
  const [open, setOpen] = useState(false);
  const tone = quality.score >= 80 ? "text-[var(--cheap)]" : quality.score >= 50 ? "text-amber-300" : "text-rose-300";

  return (
    <div className="ml-auto w-full max-w-xs text-right">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="badge inline-flex items-center gap-1.5"
      >
        İlan kalitesi <strong className={`num ${tone}`}>{quality.score}/100</strong>
        <span className="text-[var(--muted)]" aria-hidden>
          {open ? "▲" : "▼"}
        </span>
      </button>
      {open && (
        <div className="surface-2 mt-2 p-3 text-left text-xs">
          <ul className="space-y-2">
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
