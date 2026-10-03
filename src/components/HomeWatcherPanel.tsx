"use client";

import { useCallback, useEffect, useState } from "react";
import { formatRelativeTr, getTurkeyDateStr, getTurkeyYesterdayStr } from "@/lib/utils";
import { formatActiveTime, type DaySummary, type HourSlot, type WatcherStatus } from "@/lib/home-watcher-status";

interface WatcherData {
  watcher: WatcherStatus;
  today: DaySummary;
  days: DaySummary[];
  queue: {
    active: number;
    neverVerified: number;
    verifiedLast24h: number;
    estimate: { perActiveHour: number; activeHoursNeeded: number } | null;
  };
}

const STATE_STYLE: Record<WatcherStatus["state"], string> = {
  online: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  paused: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  offline: "border-slate-500/40 bg-slate-500/10 text-slate-300",
};

const nf = (n: number) => n.toLocaleString("tr-TR");

function dayLabel(dateStr: string) {
  if (dateStr === getTurkeyDateStr()) return `${dateStr} (bugün)`;
  if (dateStr === getTurkeyYesterdayStr()) return `${dateStr} (dün)`;
  return dateStr;
}

function Tile({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-[11px] uppercase tracking-widest text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-black ${tone}`}>{value}</p>
    </div>
  );
}

/**
 * Evdeki bilgisayarda arka planda çalışan Arabam bekçisinin canlı durumu, günlük özeti ve (güne tıklayınca)
 * saat saat dökümü. Bekçi her dakika sinyal verir; sinyal 3 dakikadan eskiyse "Kapalı" görünür.
 */
export function HomeWatcherPanel() {
  const [data, setData] = useState<WatcherData | null>(null);
  const [error, setError] = useState("");
  const [openDate, setOpenDate] = useState<string | null>(null);
  const [hours, setHours] = useState<HourSlot[] | null>(null);
  const [showLog, setShowLog] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/home-watcher", { cache: "no-store" });
      if (!res.ok) throw new Error();
      setData(await res.json());
      setError("");
    } catch {
      setError("Bekçi durumu alınamadı.");
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 30_000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!openDate) return;
    let active = true;
    setHours(null);
    fetch(`/api/admin/home-watcher?date=${encodeURIComponent(openDate)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => active && setHours(d.hours))
      .catch(() => active && setHours([]));
    return () => {
      active = false;
    };
  }, [openDate]);

  const w = data?.watcher;
  // Bugün için içinde bulunulan saatten sonrası "çalışmadı" değil "henüz gelmedi".
  const nowHourTr = Number(new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", hour12: false }).format(new Date())) % 24;
  const maxHour = hours ? Math.max(1, ...hours.map((h) => h.checked)) : 1;

  return (
    <section className="card space-y-5 p-5" aria-label="Arabam bekçisi">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">🏠 Arabam Bekçisi (ev bilgisayarı)</h2>
          <p className="text-sm text-slate-500">
            Bilgisayar açıkken Arabam ilanlarını ~10 saniyede bir kendi sayfasından kontrol eder; bilgisayar kapalıyken durur.
          </p>
        </div>
        {w && (
          <span className={`rounded-full border px-3 py-1 text-sm font-semibold ${STATE_STYLE[w.state]}`}>
            {w.state === "online" ? "● " : w.state === "paused" ? "⏸ " : "○ "}
            {w.label}
          </span>
        )}
      </div>

      {error && <p className="text-sm text-rose-300">{error}</p>}
      {!data && !error && <p className="text-sm text-slate-500">Yükleniyor…</p>}

      {data && w && (
        <>
          <div className="text-sm text-slate-400">
            {w.phase && <p className="text-slate-200">{w.phase}</p>}
            <p>
              {w.host ? `${w.host} · ` : ""}
              {w.lastHeartbeat ? `son sinyal ${formatRelativeTr(w.lastHeartbeat)}` : "henüz hiç sinyal gelmedi"}
              {w.state !== "offline" && w.gapSeconds ? ` · ilanlar arası ~${Math.round(w.gapSeconds)} sn` : ""}
            </p>
            {!w.lastHeartbeat && <p className="mt-1 text-slate-500">Bekçiyi kurmak için proje klasöründe arabam-bekci-kur.bat dosyasına çift tıkla.</p>}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Tile label="Bugün kontrol" value={nf(data.today.checked)} />
            <Tile label="Canlı çıkan" value={nf(data.today.alive)} tone="text-emerald-300" />
            <Tile label="Arşive taşınan" value={nf(data.today.archived)} tone="text-rose-300" />
            <Tile label="Engel / belirsiz" value={`${nf(data.today.blocked)} / ${nf(data.today.uncertain)}`} tone="text-amber-300" />
            <Tile label="Bugün çalışma süresi" value={formatActiveTime(data.today.activeSeconds)} />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">
            <p>
              Hiç doğrulanmamış: <strong>{nf(data.queue.neverVerified)}</strong> / {nf(data.queue.active)} aktif Arabam ilanı · son 24 saatte doğrulanan:{" "}
              <strong>{nf(data.queue.verifiedLast24h)}</strong>
            </p>
            {data.queue.estimate ? (
              <p className="mt-1 text-slate-400">
                Son günlerin hızıyla (saatte ~{nf(data.queue.estimate.perActiveHour)} ilan) hiç doğrulanmamışların bitmesi için yaklaşık{" "}
                {nf(data.queue.estimate.activeHoursNeeded)} saatlik çalışma gerekiyor (günde 5 saat açık kalırsa ~{nf(Math.ceil(data.queue.estimate.activeHoursNeeded / 5))} gün).
              </p>
            ) : (
              <p className="mt-1 text-slate-500">Tahmin için bekçinin biraz çalışması gerekiyor.</p>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-300">Günlük özet (güne tıkla → saat saat)</h3>
            {data.days.length === 0 ? (
              <p className="text-sm text-slate-500">Henüz kayıt yok.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-widest text-slate-500">
                      <th className="p-2">Gün</th>
                      <th className="p-2 text-right">Çalışma süresi</th>
                      <th className="p-2 text-right">Kontrol</th>
                      <th className="p-2 text-right">Canlı</th>
                      <th className="p-2 text-right">Arşive</th>
                      <th className="p-2 text-right">Engel</th>
                      <th className="p-2 text-right">Belirsiz</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.days.map((d) => (
                      <tr
                        key={d.dateStr}
                        onClick={() => setOpenDate(openDate === d.dateStr ? null : d.dateStr)}
                        className={`cursor-pointer border-t border-white/5 transition hover:bg-white/[0.04] ${openDate === d.dateStr ? "bg-white/[0.05]" : ""}`}
                      >
                        <td className="p-2 font-medium">{openDate === d.dateStr ? "▾ " : "▸ "}{dayLabel(d.dateStr)}</td>
                        <td className="p-2 text-right">{formatActiveTime(d.activeSeconds)}</td>
                        <td className="p-2 text-right font-semibold">{nf(d.checked)}</td>
                        <td className="p-2 text-right text-emerald-300">{nf(d.alive)}</td>
                        <td className="p-2 text-right text-rose-300">{nf(d.archived)}</td>
                        <td className="p-2 text-right text-amber-300">{nf(d.blocked)}</td>
                        <td className="p-2 text-right text-slate-400">{nf(d.uncertain)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {openDate && (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <h3 className="mb-2 text-sm font-semibold text-slate-300">{dayLabel(openDate)} · saat saat</h3>
              {!hours ? (
                <p className="text-sm text-slate-500">Yükleniyor…</p>
              ) : (
                <div className="space-y-1">
                  {hours.map((h) => {
                    const idle = h.checked === 0 && !(h.batches && h.batches > 0);
                    const future = openDate === getTurkeyDateStr() && h.hour > nowHourTr;
                    return (
                      <div key={h.hour} className="flex items-center gap-3 text-xs">
                        <span className="w-24 shrink-0 text-slate-500">{h.hourRange}</span>
                        <div className="h-3 flex-1 overflow-hidden rounded bg-white/5">
                          <div className="h-full rounded bg-emerald-400/70" style={{ width: `${(h.checked / maxHour) * 100}%` }} />
                        </div>
                        {future ? (
                          <span className="w-64 shrink-0 text-slate-700">henüz gelmedi</span>
                        ) : idle ? (
                          <span className="w-64 shrink-0 text-slate-600">çalışmadı (bilgisayar kapalı olabilir)</span>
                        ) : (
                          <span className="w-64 shrink-0 text-slate-300">
                            <strong>{nf(h.checked)}</strong> kontrol · <span className="text-emerald-300">{nf(h.alive)} canlı</span> ·{" "}
                            <span className="text-rose-300">{nf(h.archived)} arşiv</span>
                            {h.blocked > 0 && <span className="text-amber-300"> · {nf(h.blocked)} engel</span>}
                            {h.pausedMinutes ? <span className="text-amber-300"> · {nf(h.pausedMinutes)} dk mola</span> : null}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {w.recentLogs.length > 0 && (
            <div>
              <button type="button" onClick={() => setShowLog((v) => !v)} className="text-sm font-semibold text-amber-300">
                {showLog ? "▾ Son günlük satırlarını gizle" : "▸ Son günlük satırlarını göster"}
              </button>
              {showLog && (
                <pre className="mt-2 max-h-64 overflow-auto rounded-xl bg-black/40 p-3 text-xs leading-relaxed text-slate-300">
                  {w.recentLogs.join("\n")}
                </pre>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
