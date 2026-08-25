"use client";

import { useEffect, useState } from "react";
import { Car } from "@/types";


export function CompareAiSummary({ items }: { items: Car[] }) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [open, setOpen] = useState(true);

  const ids = items.map((c) => c._id).join(",");

  useEffect(() => {
    if (items.length < 2) return;
    let active = true;
    setLoading(true);
    setSummary(null);
    setUnavailable(false);


    fetch("/api/compare/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: items.map((c) => c._id) }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        if (d.summary) setSummary(d.summary);
        else setUnavailable(true);
      })
      .catch(() => active && setUnavailable(true))
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  
  }, [ids]);

  if (items.length < 2 || unavailable) return null;

  return (
    <div className="fixed bottom-24 right-4 z-40 w-[min(92vw,340px)]">
      {open ? (
        <div className="card border border-amber-400/30 bg-[var(--bg-soft)] p-4 shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-amber-300">
              🤖 AI Önerisi
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Kapat"
              className="text-slate-500 transition hover:text-[var(--text)]"
            >
              ✕
            </button>
          </div>
          {loading ? (
            <p className="flex items-center gap-2 py-1 text-sm text-slate-400">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-amber-300/40 border-t-amber-300" />
              Araçlar analiz ediliyor...
            </p>
          ) : (
            <p className="whitespace-pre-line text-sm leading-relaxed text-slate-200">
              {summary}
            </p>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="btn btn-primary rounded-full shadow-2xl"
        >
          🤖 AI Önerisi
        </button>
      )}
    </div>
  );
}
