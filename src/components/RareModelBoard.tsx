"use client";

import { useEffect, useState } from "react";
import { useWideScreen } from "@/components/useWideScreen";
import { formatRelativeTr } from "@/lib/utils";

interface Row {
  brand: string;
  model: string;
  count: number;
  sourceCount: number | null;
  note: string;
}

type Scope = "missing" | "all";

interface PageData {
  page: number;
  pages: number;
  pageSize: number;
  total: number;
  rows: Row[];
  scope: Scope;
  counts: { missing: number; all: number };
  updatedAt: string;
  catalogAt: string | null;
}

/** Yönetim paneli sol sütunu: sitede en az ilanı olan marka/modeller (sayfa başına 15, altta sayfa kaydırma). Web'e özel. */
export function RareModelBoard() {
  const wide = useWideScreen();
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(1);
  const [scope, setScope] = useState<Scope>("missing");
  const [data, setData] = useState<PageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const open = wide || expanded;

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    fetch(`/api/admin/rare-models?page=${page}&scope=${scope}`, { cache: "no-store" })
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
  }, [open, page, scope]);

  const go = (target: number) => setPage(Math.max(1, Math.min(data?.pages ?? 1, target)));
  const changeScope = (next: Scope) => {
    if (next === scope) return;
    setScope(next);
    setPage(1);
  };
  const firstIndex = data ? (data.page - 1) * data.pageSize : 0;
  const catalogAge = data?.catalogAt ? Math.max(0, Math.floor((Date.now() - new Date(data.catalogAt).getTime()) / 86_400_000)) : null;

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 shadow-xl sm:p-5">
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
        <p className="text-[11px] text-slate-500">Sitede görünen (aktif) ilan sayısı{data ? ` · ${data.total.toLocaleString("tr-TR")} model` : ""}</p>
      </button>

      {open && (
        <>
          <div className="mt-3 inline-flex rounded-lg border border-white/10 p-0.5 text-xs font-semibold" role="group" aria-label="Liste kapsamı">
            {(["missing", "all"] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => changeScope(key)}
                aria-pressed={scope === key}
                className={`rounded-md px-2.5 py-1 ${scope === key ? "bg-white/15 text-white" : "text-slate-400 hover:text-slate-200"}`}
              >
                {key === "missing" ? "Yalnız eksik olanlar" : "Tümü"}
                {data && <span className="ml-1 tabular-nums text-slate-500">{data.counts[key].toLocaleString("tr-TR")}</span>}
              </button>
            ))}
          </div>

          {error && !data && <p className="mt-3 text-sm text-rose-300">Liste alınamadı: {error}</p>}

          <div className="mt-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="w-8 pb-2 font-bold">#</th>
                  <th className="pb-2 font-bold">Marka / model</th>
                  <th className="pb-2 text-right font-bold">Adet</th>
                </tr>
              </thead>
              <tbody className={loading ? "opacity-50" : ""}>
                {data?.rows.map((row, index) => (
                  <tr key={`${row.brand}-${row.model}`} className="border-t border-white/5 align-top">
                    <td className="py-2.5 text-[13px] tabular-nums text-slate-600">{firstIndex + index + 1}</td>
                    <td className="py-2.5 pr-3">
                      <div className="text-base font-bold leading-tight text-white">{row.model}</div>
                      <div className="mt-0.5 text-[13px] leading-tight text-slate-400">{row.brand}</div>
                      {row.note && <div className="mt-1 text-xs leading-snug text-slate-500">{row.note}</div>}
                    </td>
                    <td className="whitespace-nowrap py-2.5 pl-1 text-right tabular-nums">
                      <div className={`text-xl font-black leading-none ${row.count === 0 ? "text-rose-400" : row.count < 5 ? "text-amber-300" : "text-slate-200"}`}>{row.count}</div>
                      {row.sourceCount !== null && <div className="mt-1 text-xs text-slate-500">kaynakta ~{row.sourceCount.toLocaleString("tr-TR")}</div>}
                    </td>
                  </tr>
                ))}
                {data && data.rows.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-xs text-slate-500">
                      {scope === "missing" ? "Kaynakta olup bizde eksik model kalmadı." : "Liste boş."}
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
          {data && (
            <p className="mt-3 text-xs leading-snug text-slate-500">
              Liste 5 dakikada bir tazelenir · {formatRelativeTr(data.updatedAt) || "az önce"}
              {catalogAge !== null && (
                <>
                  <br />
                  &quot;Kaynakta&quot; sayıları {catalogAge === 0 ? "bugün" : `${catalogAge} gün önce`} okundu (scrape.bat 22 yeniler); kaynakta değişmiş olabilir.
                </>
              )}
            </p>
          )}
        </>
      )}
    </section>
  );
}
