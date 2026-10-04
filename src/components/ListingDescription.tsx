"use client";

import { useState } from "react";
import { formatListingDescription } from "@/lib/listing-description";

export function ListingDescription({ value }: { value: string }) {
  const [expanded, setExpanded] = useState(false);
  const description = formatListingDescription(value);
  if (!description) return null;

  const canExpand = description.length > 500;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-5">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-200">
        İlan açıklaması
      </h2>
      <div className={`relative ${canExpand && !expanded ? "max-h-56 overflow-hidden" : ""}`}>
        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-300">
          {description}
        </p>
        {canExpand && !expanded && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#111419] to-transparent"
          />
        )}
      </div>
      {canExpand && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
          className="mt-3 text-sm font-semibold text-amber-300 hover:text-amber-200"
        >
          {expanded ? "Daha az göster" : "Açıklamanın tamamını gör"}
        </button>
      )}
    </section>
  );
}
