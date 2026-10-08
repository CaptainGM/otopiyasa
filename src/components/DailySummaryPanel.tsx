"use client";

import { useEffect, useState } from "react";
import { useVisibleInterval } from "@/components/useVisibleInterval";

interface Delta {
  added: number;
  removed: number;
  updated: number;
}

interface SummaryRow {
  source: string;
  active: number;
  watcher: Delta;
  daemon: Delta;
  manual: Delta;
  total: Delta;
}

interface DailySummaryData {
  date: string;
  rows: SummaryRow[];
  totals: { watcher: Delta; daemon: Delta; manual: Delta; total: Delta };
  unattributedManual: Delta;
}

const SOURCE_LABELS: Record<string, string> = {
  arabam: "Arabam",
  otokoc: "Otokoç",
  dod: "DOD",
  otoplus: "Otoplus",
  otomerkezi: "Otomerkezi",
  carvak: "Carvak",
  vavacars: "VavaCars",
  ikinciyeni: "İkinciyeni",
};

const fmt = (n: number) => n.toLocaleString("tr-TR");
const isEmpty = (d: Delta) => d.added === 0 && d.removed === 0 && d.updated === 0;

/** + yeşil, − kırmızı, ~ sarı; sıfır olanlar gösterilmez, hepsi sıfırsa tire. */
function DeltaCell({ delta, bold = false }: { delta: Delta; bold?: boolean }) {
  if (isEmpty(delta)) return <span className="text-slate-600">—</span>;
  return (
    <span className={`inline-flex items-center justify-end gap-2 whitespace-nowrap tabular-nums ${bold ? "font-black" : "font-semibold"}`}>
      {delta.added > 0 && <span className="text-emerald-400">+{fmt(delta.added)}</span>}
      {delta.removed > 0 && <span className="text-rose-400">−{fmt(delta.removed)}</span>}
      {delta.updated > 0 && <span className="text-yellow-300">~{fmt(delta.updated)}</span>}
    </span>
  );
}

const COLUMNS: Array<{ key: "watcher" | "daemon" | "manual" | "total"; title: string; hint: string }> = [
  { key: "watcher", title: "Bekçi", hint: "evdeki bilgisayar, yalnız Arabam" },
  { key: "daemon", title: "Otonom", hint: "7/24 sunucu motoru" },
  { key: "manual", title: "Manuel", hint: "scrape.bat ve panelden elle" },
  { key: "total", title: "Toplam", hint: "veritabanındaki gerçek değişim" },
];

export function DailySummaryPanel() {
  const [data, setData] = useState<DailySummaryData | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch(`/api/admin/daily-summary?_t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Günlük özet alınamadı");
    }
  }

  useEffect(() => {
    load();
  }, []);
  useVisibleInterval(load, 25000);

  const unattributed = data?.unattributedManual;

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 shadow-xl sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-black tracking-tight text-white">Günlük özet {data ? `(${data.date})` : ""}</h2>
        <p className="text-[11px] text-slate-500">Bugün her kaynakta ne değişti, kim yaptı</p>
      </div>

      {/* Açıklama: tablodaki işaretler */}
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
        <span className="inline-flex items-center gap-1.5 text-slate-300">
          <b className="text-base leading-none text-emerald-400">+</b> yeni eklenen ilan
        </span>
        <span className="inline-flex items-center gap-1.5 text-slate-300">
          <b className="text-base leading-none text-rose-400">−</b> arşive alınan / kaynaktan kalkan ilan
        </span>
        <span className="inline-flex items-center gap-1.5 text-slate-300">
          <b className="text-base leading-none text-yellow-300">~</b> güncellenen ilan (fiyat / bilgi değişti)
        </span>
      </div>

      {!data && !error && <p className="mt-4 text-sm text-slate-500">Yükleniyor…</p>}
      {error && !data && <p className="mt-4 text-sm text-rose-300">Günlük özet alınamadı: {error}</p>}

      {data && (
        <div className="mt-3 overflow-x-auto rounded-xl border border-white/5 bg-slate-900/80">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-right text-[11px] uppercase tracking-wider text-slate-400">
                <th className="px-3.5 py-2.5 text-left font-bold">Kaynak</th>
                <th className="px-3.5 py-2.5 font-bold">Aktif</th>
                {COLUMNS.map((col) => (
                  <th key={col.key} className="px-3.5 py-2.5 font-bold">
                    <div>{col.title}</div>
                    <div className="mt-0.5 text-[10px] font-normal normal-case tracking-normal text-slate-500">{col.hint}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.source} className="border-t border-white/5 text-right">
                  <td className="px-3.5 py-2 text-left font-semibold text-white">{SOURCE_LABELS[row.source] || row.source}</td>
                  <td className="px-3.5 py-2 text-slate-300 tabular-nums">{fmt(row.active)}</td>
                  {COLUMNS.map((col) => (
                    <td key={col.key} className={`px-3.5 py-2 ${col.key === "total" ? "bg-white/[0.03]" : ""}`}>
                      <DeltaCell delta={row[col.key]} />
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-t border-white/10 bg-white/[0.03] text-right">
                <td className="px-3.5 py-2.5 text-left font-black text-white">Tümü</td>
                <td className="px-3.5 py-2.5 font-bold text-slate-200 tabular-nums">{fmt(data.rows.reduce((n, r) => n + r.active, 0))}</td>
                {COLUMNS.map((col) => (
                  <td key={col.key} className="px-3.5 py-2.5">
                    <DeltaCell delta={data.totals[col.key]} bold />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          <p className="border-t border-white/5 px-3.5 py-2.5 text-[11px] leading-relaxed text-slate-500">
            Toplam sütunundaki + ve −, veritabanında bugün gerçekten oluşan ve arşive alınan kayıtlardır; ilk üç sütunun toplamından fazlaysa
            fark, kayıt tutmayan betiklerden (turbo, keşif betiği) gelir. ~ güncellenen için gerçek sayaç yoktur, sütunların toplamıdır.
            {unattributed && !isEmpty(unattributed) && (
              <>
                {" "}
                Kaynağı ayrılamayan eski manuel tarama kayıtları: <DeltaCell delta={unattributed} />
              </>
            )}
          </p>
        </div>
      )}
    </section>
  );
}
