"use client";

import { useEffect, useState } from "react";
import { useWideScreen } from "@/components/useWideScreen";
import { formatRelativeTr } from "@/lib/utils";

interface Row {
  brand: string;
  model: string;
  count: number;
  sourceCount: number | null;
}

interface PageData {
  page: number;
  pages: number;
  pageSize: number;
  total: number;
  rows: Row[];
  updatedAt: string;
}

/** Yönetim paneli sol sütunu: sitede en az ilanı olan marka/modeller (sayfa başına 15, altta sayfa kaydırma). Web'e özel. */
export function RareModelBoard() {
  const wide = useWideScreen();
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const open = wide || expanded;

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    fetch(`/api/admin/rare-models?page=${page}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as PageData;
      })
      .then((json) => {
        if (!active) return;
        setData(json);
        setError(null);
        // Sunucu sayfa numarasını sınırlamış olabilir (liste kısaldıysa).
        if (json.page !== page) setPage(json.page);
      })
      .catch((err) => active && setError(err instanceof Error ? err.message : "Liste alınamadı"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [open, page]);

  const go = (target: number) => setPage(Math.max(1, Math.min(data?.pages ?? 1, target)));
  const firstIndex = data ? (data.page - 1) * data.pageSize : 0;

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 shadow-xl sm:p-5 min-[2160px]:flex min-[2160px]:max-h-[calc(100vh-2rem)] min-[2160px]:flex-col">
      <button
        type="button"
        onClick={() => !wide && setExpanded((v) => !v)}
        className={`text-left ${wide ? "cursor-default" : ""}`}
        aria-expanded={open}
      >
        <h2 className="text-lg font-black tracking-tight text-white">
          En az ilanlı modeller
          {!wide && <span className="ml-2 text-xs font-semibold text-slate-500">{expanded ? "▲" : "▼"}</span>}
        </h2>
        <p className="text-[11px] text-slate-500">
          Sitede görünen (aktif) ilan sayısı{data ? ` · ${data.total.toLocaleString("tr-TR")} model` : ""}
        </p>
      </button>

      {open && (
        <>
          {error && !data && <p className="mt-3 text-sm text-rose-300">Liste alınamadı: {error}</p>}

          <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="w-6 pb-1.5 font-bold">#</th>
                  <th className="pb-1.5 font-bold">Marka / model</th>
                  <th className="pb-1.5 text-right font-bold">Adet</th>
                </tr>
              </thead>
              <tbody className={loading ? "opacity-50" : ""}>
                {data?.rows.map((row, index) => (
                  <tr key={`${row.brand}-${row.model}`} className="border-t border-white/5">
                    <td className="py-1.5 text-[11px] tabular-nums text-slate-600">{firstIndex + index + 1}</td>
                    <td className="py-1.5 pr-2">
                      <div className="font-semibold leading-tight text-white">{row.model}</div>
                      <div className="text-[11px] leading-tight text-slate-500">{row.brand}</div>
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      <div className={`font-black ${row.count === 0 ? "text-rose-400" : row.count < 5 ? "text-amber-300" : "text-slate-200"}`}>{row.count}</div>
                      {row.sourceCount !== null && <div className="text-[10px] text-slate-500">kaynakta ~{row.sourceCount.toLocaleString("tr-TR")}</div>}
                    </td>
                  </tr>
                ))}
                {data && data.rows.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-xs text-slate-500">
                      Liste boş.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {data && (
            <div className="mt-3 flex items-center justify-between gap-1 border-t border-white/10 pt-3 text-xs">
              <div className="flex gap-1">
                <button type="button" onClick={() => go(1)} disabled={data.page <= 1 || loading} className="rounded-md border border-white/10 px-2 py-1 text-slate-300 hover:bg-white/10 disabled:opacity-30" aria-label="İlk sayfa">
                  «
                </button>
                <button type="button" onClick={() => go(data.page - 1)} disabled={data.page <= 1 || loading} className="rounded-md border border-white/10 px-2.5 py-1 text-slate-300 hover:bg-white/10 disabled:opacity-30">
                  ‹ Önceki
                </button>
              </div>
              <span className="tabular-nums text-slate-400">
                {data.page} / {data.pages}
              </span>
              <div className="flex gap-1">
                <button type="button" onClick={() => go(data.page + 1)} disabled={data.page >= data.pages || loading} className="rounded-md border border-white/10 px-2.5 py-1 text-slate-300 hover:bg-white/10 disabled:opacity-30">
                  Sonraki ›
                </button>
                <button type="button" onClick={() => go(data.pages)} disabled={data.page >= data.pages || loading} className="rounded-md border border-white/10 px-2 py-1 text-slate-300 hover:bg-white/10 disabled:opacity-30" aria-label="Son sayfa">
                  »
                </button>
              </div>
            </div>
          )}
          {data && <p className="mt-2 text-[10px] text-slate-600">Liste 5 dakikada bir tazelenir · {formatRelativeTr(data.updatedAt) || "az önce"}</p>}
        </>
      )}
    </section>
  );
}
