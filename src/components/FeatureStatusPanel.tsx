"use client";

import { useEffect, useState } from "react";
import { useVisibleInterval } from "@/components/useVisibleInterval";
import { useWideScreen } from "@/components/useWideScreen";
import { formatRelativeTr } from "@/lib/utils";

interface Probe {
  key: string;
  label: string;
  group: string;
  ok: boolean;
  detail: string;
  ms: number;
  checkedAt: string;
  lastOkAt: string | null;
  informational: boolean;
  ai: boolean;
}

interface StatusData {
  results: Probe[];
  summary: { total: number; failing: number; allOk: boolean };
  checkedAt: string;
}

const GROUP_ORDER = ["Veri toplama", "Site özellikleri", "Hesap", "Denetim"];

function Mark({ ok }: { ok: boolean }) {
  return (
    <span
      className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${
        ok ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
      }`}
      aria-label={ok ? "çalışıyor" : "çalışmıyor"}
    >
      {ok ? "✓" : "✕"}
    </span>
  );
}

/** Yönetim paneli sağ sütunu: site özelliklerinin canlı durumu (yeşil tik / kırmızı çarpı). Web'e özel. */
export function FeatureStatusPanel() {
  const [data, setData] = useState<StatusData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Geniş ekranda sağ kenar boşluğunda hep açık; dar ekranda başlığa tıklayınca açılır (sayfayı aşağı itmesin).
  const wide = useWideScreen();
  const [expanded, setExpanded] = useState(false);

  async function load(force = false) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/feature-status${force ? "?force=1" : ""}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Durum alınamadı");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);
  // Her yenileme birkaç sorgu çalıştırır; Vercel işlemci kotası için sekme görünürken ve seyrek yenilenir.
  useVisibleInterval(() => load(), 120_000);

  const failing = data?.summary.failing ?? 0;
  const open = wide || expanded;

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 shadow-xl sm:p-5 min-[2160px]:max-h-[calc(100vh-2rem)] min-[2160px]:overflow-y-auto">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => !wide && setExpanded((v) => !v)}
          className={`text-left ${wide ? "cursor-default" : ""}`}
          aria-expanded={open}
        >
          <h2 className="text-lg font-black tracking-tight text-white">
            Site özellikleri
            {!wide && <span className="ml-2 text-xs font-semibold text-slate-500">{expanded ? "▲" : "▼"}</span>}
          </h2>
          <p className="text-[11px] text-slate-500">{data ? `Son kontrol: ${formatRelativeTr(data.checkedAt) || "az önce"}` : "Kontrol ediliyor…"}</p>
        </button>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={loading}
          className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-300 transition hover:bg-white/10 disabled:opacity-50"
        >
          {loading ? "Kontrol ediliyor…" : "Şimdi kontrol et"}
        </button>
      </div>

      {data && (
        <p
          className={`mt-3 rounded-lg px-3 py-2 text-xs font-bold ${
            data.summary.allOk ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300"
          }`}
        >
          {data.summary.allOk ? "Tüm özellikler çalışıyor" : `${failing} özellikte sorun var`}
        </p>
      )}
      {error && !data && <p className="mt-3 text-sm text-rose-300">Durum alınamadı: {error}</p>}

      <div className={`mt-3 space-y-4 ${open ? "" : "hidden"}`}>
        {data &&
          GROUP_ORDER.map((group) => {
            const rows = data.results.filter((r) => r.group === group);
            if (rows.length === 0) return null;
            return (
              <div key={group}>
                <h3 className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">{group}</h3>
                <ul className="space-y-2">
                  {rows.map((r) => (
                    <li key={r.key} className="flex gap-2.5">
                      <Mark ok={r.ok} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-tight text-white">
                          {r.label}
                          {r.ai && <span className="ml-1.5 rounded bg-violet-500/15 px-1 py-0.5 align-middle text-[9px] font-bold text-violet-300">YZ</span>}
                        </p>
                        <p className={`text-[11px] leading-snug ${r.ok ? "text-slate-500" : "text-rose-300/90"}`}>{r.detail}</p>
                        {r.ai && <p className="text-[10px] text-slate-600">yapay zekâ kotası için 30 dk&apos;da bir denenir · {formatRelativeTr(r.checkedAt)}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
      </div>
    </section>
  );
}
