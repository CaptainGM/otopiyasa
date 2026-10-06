"use client";

import { useEffect, useState } from "react";
import { Car } from "@/types";

/** Model yanıtındaki **kalın** işaretlerini gerçek kalın yazıya çevirir (ham yıldız görünmesin). */
function renderSummary(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
      <strong key={i} className="font-semibold text-amber-200">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part.replace(/\*+/g, "")
    )
  );
}

export function CompareAiSummary({ items }: { items: Car[] }) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [open, setOpen] = useState(true);
  // Telefonda önce 4 satır görünür (tablo ekranın altında kalmasın), dokununca tamamı açılır.
  const [expanded, setExpanded] = useState(false);

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
      body: JSON.stringify({ ids: ids.split(",") }),
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
    <div>
      {open ? (
        <div className="card border border-amber-400/30 bg-[var(--bg-soft)] p-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-base font-semibold text-amber-300">
              AI Önerisi
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Kapat"
              className="px-1 text-lg text-slate-500 transition hover:text-[var(--text)]"
            >
              ✕
            </button>
          </div>
          {loading ? (
            <p className="flex items-center gap-2 py-1 text-base text-slate-400">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-amber-300/40 border-t-amber-300" />
              Araçlar analiz ediliyor...
            </p>
          ) : (
            <>
              <p
                className={`whitespace-pre-line text-base leading-7 text-slate-100 md:text-[17px] md:leading-8 ${
                  expanded ? "" : "line-clamp-4 md:line-clamp-none"
                }`}
              >
                {summary ? renderSummary(summary) : null}
              </p>
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-1 text-sm font-semibold text-amber-300 md:hidden"
              >
                {expanded ? "Daha az göster ▲" : "Devamını oku ▼"}
              </button>
            </>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="btn btn-secondary rounded-full"
        >
          AI Önerisi
        </button>
      )}
    </div>
  );
}
