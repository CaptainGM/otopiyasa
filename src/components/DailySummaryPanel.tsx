"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

interface SummaryDay extends DailySummaryData {
  watcherChecked: number;
  watcherArchived: number;
  watcherActiveSeconds: number;
}

interface RangeData {
  days: SummaryDay[];
  hasData: boolean;
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

const TR_DAY = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit", year: "numeric" });
const TR_WEEKDAY = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", weekday: "long" });

/** Türkiye gününü GG.AA.YYYY olarak verir (istemci saat diliminden bağımsız). */
function turkeyToday(): string {
  return TR_DAY.format(new Date());
}

function turkeyDaysAgo(days: number): string {
  return TR_DAY.format(new Date(Date.now() - days * 24 * 60 * 60 * 1000));
}

/** GG.AA.YYYY → Date (gösterim için); geçersizse null. */
function parseTrDate(dateStr: string): Date | null {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(dateStr);
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "12.10.2026" → "12.10.2026 · Pazartesi" */
function dayLabel(dateStr: string): string {
  const date = parseTrDate(dateStr);
  if (!date) return dateStr;
  return `${dateStr} · ${TR_WEEKDAY.format(date)}`;
}

/** GG.AA.YYYY → <input type="date"> için YYYY-AA-GG */
function toInputDate(dateStr: string): string {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(dateStr);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
}

function fromInputDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : "";
}

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

/** Bekçinin çalışma süresi: 3 sa 20 dk */
function formatActiveTime(seconds: number): string {
  if (!seconds) return "—";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours === 0) return `${minutes} dk`;
  return minutes === 0 ? `${hours} sa` : `${hours} sa ${minutes} dk`;
}

const COLUMNS: Array<{ key: "watcher" | "daemon" | "manual" | "total"; title: string; hint: string }> = [
  { key: "watcher", title: "Bekçi", hint: "evdeki bilgisayar, yalnız Arabam" },
  { key: "daemon", title: "Otonom", hint: "7/24 sunucu motoru" },
  { key: "manual", title: "Manuel", hint: "scrape.bat ve panelden elle" },
  { key: "total", title: "Toplam", hint: "veritabanındaki gerçek değişim" },
];

type Filter = { kind: "day"; date: string } | { kind: "range" };

export function DailySummaryPanel() {
  const today = useMemo(turkeyToday, []);
  const yesterday = useMemo(() => turkeyDaysAgo(1), []);
  const [filter, setFilter] = useState<Filter>({ kind: "day", date: today });
  const [day, setDay] = useState<DailySummaryData | null>(null);
  const [range, setRange] = useState<RangeData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const query = filter.kind === "range" ? "?range=14" : `?date=${encodeURIComponent(filter.date)}`;
      const res = await fetch(`/api/admin/daily-summary${query}&_t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      if (filter.kind === "range") {
        setRange(payload as RangeData);
        setDay(null);
      } else {
        setDay(payload as DailySummaryData);
        setRange(null);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Günlük özet alınamadı");
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);
  useVisibleInterval(load, 25000);

  const activeDate = filter.kind === "day" ? filter.date : null;
  const unattributed = day?.unattributedManual;

  // Gün gün tablonun toplamı: aralıktaki tüm günlerin toplamı (tek satırda özet).
  const rangeTotals = useMemo(() => {
    if (!range) return null;
    return range.days.reduce(
      (acc, d) => ({
        checked: acc.checked + d.watcherChecked,
        archived: acc.archived + d.watcherArchived,
        seconds: acc.seconds + d.watcherActiveSeconds,
        total: {
          added: acc.total.added + d.totals.total.added,
          removed: acc.total.removed + d.totals.total.removed,
          updated: acc.total.updated + d.totals.total.updated,
        },
      }),
      { checked: 0, archived: 0, seconds: 0, total: { added: 0, removed: 0, updated: 0 } }
    );
  }, [range]);

  const chipClass = (active: boolean) =>
    `cursor-pointer rounded-lg border px-3 py-1 text-xs font-bold transition ${
      active
        ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200"
        : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.07]"
    }`;

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 shadow-xl sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-black tracking-tight text-white">
          Günlük özet {day ? `(${day.date})` : range ? "(son 14 gün)" : ""}
        </h2>
        <p className="text-[11px] text-slate-500">
          {filter.kind === "range" ? "Gün gün ne değişti, kim yaptı" : "O gün her kaynakta ne değişti, kim yaptı"}
        </p>
      </div>

      {/* Gün filtresi: bugün / dün / seçilen gün / tümü (son 14 gün, gün gün) */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setFilter({ kind: "day", date: today })} className={chipClass(activeDate === today)}>
          Bugün
        </button>
        <button type="button" onClick={() => setFilter({ kind: "day", date: yesterday })} className={chipClass(activeDate === yesterday)}>
          Dün
        </button>

        <label className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1">
          <span className="text-xs font-bold text-slate-400">Gün seç</span>
          <input
            type="date"
            value={activeDate ? toInputDate(activeDate) : ""}
            max={toInputDate(today)}
            onChange={(event) => {
              const picked = fromInputDate(event.target.value);
              // Boş seçim (kullanıcı temizledi) görünümü değiştirmez.
              if (picked) setFilter({ kind: "day", date: picked });
            }}
            className="cursor-pointer rounded border border-white/10 bg-slate-900 px-2 py-0.5 text-xs text-slate-200 outline-none focus:border-emerald-400/50"
          />
        </label>

        <button type="button" onClick={() => setFilter({ kind: "range" })} className={chipClass(filter.kind === "range")}>
          Tümü (son 14 gün)
        </button>

        {activeDate && activeDate !== today && activeDate !== yesterday && (
          <span className="text-xs font-semibold text-slate-400">Seçili gün: {activeDate}</span>
        )}
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

      {error && !day && !range && <p className="mt-4 text-sm text-rose-300">Günlük özet alınamadı: {error}</p>}
      {!day && !range && !error && <p className="mt-4 text-sm text-slate-500">Yükleniyor…</p>}

      {/* GÜN GÜN: son 14 günün her biri ayrı satır */}
      {range && (
        <div className="mt-3 overflow-x-auto rounded-xl border border-white/5 bg-slate-900/80">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-right text-[11px] uppercase tracking-wider text-slate-400">
                <th className="px-3.5 py-2.5 text-left font-bold">Gün</th>
                <th className="px-3.5 py-2.5 font-bold">
                  <div>Bekçi</div>
                  <div className="mt-0.5 text-[10px] font-normal normal-case tracking-normal text-slate-500">kontrol / süre</div>
                </th>
                <th className="px-3.5 py-2.5 font-bold">Otonom</th>
                <th className="px-3.5 py-2.5 font-bold">Manuel</th>
                <th className="px-3.5 py-2.5 bg-white/[0.03] font-bold">
                  <div>Toplam</div>
                  <div className="mt-0.5 text-[10px] font-normal normal-case tracking-normal text-slate-500">gerçek değişim</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {range.days.map((d) => (
                <tr
                  key={d.date}
                  onClick={() => setFilter({ kind: "day", date: d.date })}
                  className="cursor-pointer border-t border-white/5 text-right transition hover:bg-white/[0.04]"
                  title="O günün ayrıntısını aç"
                >
                  <td className="px-3.5 py-2 text-left font-semibold text-white">
                    {dayLabel(d.date)}
                    {d.date === today && <span className="ml-2 text-[10px] font-bold text-emerald-300">bugün</span>}
                  </td>
                  <td className="px-3.5 py-2 text-slate-300 tabular-nums">
                    {d.watcherChecked === 0 ? (
                      <span className="text-slate-600">—</span>
                    ) : (
                      <>
                        <b className="text-white">{fmt(d.watcherChecked)}</b>
                        <span className="ml-1.5 text-[11px] text-slate-500">{formatActiveTime(d.watcherActiveSeconds)}</span>
                      </>
                    )}
                  </td>
                  <td className="px-3.5 py-2">
                    <DeltaCell delta={d.totals.daemon} />
                  </td>
                  <td className="px-3.5 py-2">
                    <DeltaCell delta={d.totals.manual} />
                  </td>
                  <td className="px-3.5 py-2 bg-white/[0.03]">
                    <DeltaCell delta={d.totals.total} bold />
                  </td>
                </tr>
              ))}
              {rangeTotals && (
                <tr className="border-t border-white/10 bg-white/[0.03] text-right">
                  <td className="px-3.5 py-2.5 text-left font-black text-white">Tümü ({range.days.length} gün)</td>
                  <td className="px-3.5 py-2.5 tabular-nums text-slate-200">
                    <b>{fmt(rangeTotals.checked)}</b>
                    <span className="ml-1.5 text-[11px] text-slate-500">{formatActiveTime(rangeTotals.seconds)}</span>
                  </td>
                  <td className="px-3.5 py-2.5">
                    <DeltaCell delta={range.days.reduce((acc, d) => ({ ...acc, added: acc.added + d.totals.daemon.added, removed: acc.removed + d.totals.daemon.removed, updated: acc.updated + d.totals.daemon.updated }), { added: 0, removed: 0, updated: 0 })} bold />
                  </td>
                  <td className="px-3.5 py-2.5">
                    <DeltaCell delta={range.days.reduce((acc, d) => ({ ...acc, added: acc.added + d.totals.manual.added, removed: acc.removed + d.totals.manual.removed, updated: acc.updated + d.totals.manual.updated }), { added: 0, removed: 0, updated: 0 })} bold />
                  </td>
                  <td className="px-3.5 py-2.5 bg-white/[0.03]">
                    <DeltaCell delta={rangeTotals.total} bold />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <p className="border-t border-white/5 px-3.5 py-2.5 text-[11px] leading-relaxed text-slate-500">
            Gün gün tablo: bir satıra tıklayınca o günün kaynak bazlı ayrıntısı açılır. + ve − veritabanında o gün gerçekten oluşan ve
            arşive alınan kayıtlardır. ~ güncellenen için gerçek sayaç yoktur, sütunların toplamıdır.
            {!range.hasData && " Seçilen aralıkta kayıt bulunamadı."}
          </p>
        </div>
      )}

      {/* TEK GÜN: kaynak bazlı ayrıntı */}
      {day && (
        <div className="mt-3 overflow-x-auto rounded-xl border border-white/5 bg-slate-900/80">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-right text-[11px] uppercase tracking-wider text-slate-400">
                <th className="px-3.5 py-2.5 text-left font-bold">Kaynak</th>
                <th className="px-3.5 py-2.5 font-bold">
                  <div>Aktif</div>
                  <div className="mt-0.5 text-[10px] font-normal normal-case tracking-normal text-slate-500">
                    {activeDate === today ? "şu an" : "gün sonu"}
                  </div>
                </th>
                {COLUMNS.map((col) => (
                  <th key={col.key} className="px-3.5 py-2.5 font-bold">
                    <div>{col.title}</div>
                    <div className="mt-0.5 text-[10px] font-normal normal-case tracking-normal text-slate-500">{col.hint}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {day.rows.map((row) => (
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
                <td className="px-3.5 py-2.5 font-bold text-slate-200 tabular-nums">{fmt(day.rows.reduce((n, r) => n + r.active, 0))}</td>
                {COLUMNS.map((col) => (
                  <td key={col.key} className="px-3.5 py-2.5">
                    <DeltaCell delta={day.totals[col.key]} bold />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          <p className="border-t border-white/5 px-3.5 py-2.5 text-[11px] leading-relaxed text-slate-500">
            Toplam sütunundaki + ve −, veritabanında {activeDate === today ? "bugün" : "o gün"} gerçekten oluşan ve arşive alınan kayıtlardır; ilk üç
            sütunun toplamından fazlaysa fark, kayıt tutmayan betiklerden (turbo, keşif betiği) gelir. ~ güncellenen için gerçek sayaç yoktur,
            sütunların toplamıdır.
            {unattributed && !isEmpty(unattributed) && (
              <>
                {" "}
                Kaynağı ayrılamayan manuel tarama kayıtları: <DeltaCell delta={unattributed} />
              </>
            )}
          </p>
        </div>
      )}
    </section>
  );
}
