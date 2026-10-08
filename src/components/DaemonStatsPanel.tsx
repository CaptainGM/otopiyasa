"use client";

import { useEffect, useState, useRef } from "react";
import { HourlyDetailModal } from "@/components/HourlyDetailModal";
import { formatRelativeTr, getTurkeyDateStr, getTurkeyYesterdayStr } from "@/lib/utils";
import type { DaemonStatus } from "@/lib/daemon-status";
import { useVisibleInterval } from "@/components/useVisibleInterval";

type DaemonInfo = DaemonStatus;

interface SyncState {
  source: string;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastStatus: "ok" | "incomplete" | "breaker" | "failed" | null;
  lastMessage: string;
  seen: number | null;
  inserted: number;
  updated: number;
  reactivated: number;
  archived: number;
  markedMissing: number;
}

const SYNC_LABELS: Record<string, string> = {
  vavacars: "VavaCars",
  carvak: "Carvak",
  otoplus: "Otoplus",
  otomerkezi: "Otomerkezi",
  ikinciyeni: "İkinciyeni",
  otokoc: "Otokoç",
  dod: "DOD",
  "arabam-sitemap": "Arabam sitemap",
};

const SYNC_STATUS: Record<string, { label: string; cls: string }> = {
  ok: { label: "Tamam", cls: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30" },
  incomplete: { label: "Eksik tarama", cls: "text-amber-300 bg-amber-500/10 border-amber-500/30" },
  breaker: { label: "Güvenlik freni", cls: "text-orange-300 bg-orange-500/10 border-orange-500/30" },
  failed: { label: "Başarısız", cls: "text-rose-300 bg-rose-500/10 border-rose-500/30" },
};

interface SourceTotals {
  scanned: number;
  inserted: number;
  updated: number;
  deleted: number;
}

interface TodayTotals {
  date: string;
  scanned: number;
  inserted: number;
  updated: number;
  deleted: number;
  /** Kaynak bazında bugünün toplamı (motorun yeni eklediği / güncellediği / arşive taşıdığı). */
  bySource?: Record<string, SourceTotals>;
}

const SOURCE_LABELS: Record<string, string> = {
  arabam: "Arabam",
  dod: "DOD",
  otokoc: "Otokoç",
  otoplus: "Otoplus",
  otomerkezi: "Otomerkezi",
  carvak: "Carvak",
  vavacars: "VavaCars",
  ikinciyeni: "İkinciyeni",
};

interface HourlyStat {
  _id: string;
  timestamp: string;
  dateStr: string;
  hourRange: string;
  scanned: number;
  inserted: number;
  updated: number;
  deleted: number;
  bySource?: {
    arabam?: { scanned: number; inserted: number; updated: number; deleted: number };
    otomerkezi?: { scanned: number; inserted: number; updated: number; deleted: number };
    vavacars?: { scanned: number; inserted: number; updated: number; deleted: number };
    otoplus?: { scanned: number; inserted: number; updated: number; deleted: number };
    carvak?: { scanned: number; inserted: number; updated: number; deleted: number };
    otokoc?: { scanned: number; inserted: number; updated: number; deleted: number };
    dod?: { scanned: number; inserted: number; updated: number; deleted: number };
    ikinciyeni?: { scanned: number; inserted: number; updated: number; deleted: number };
  };
  lastUpdated: string;
}

export interface DaemonStatsPanelProps {
  initialDaemon?: DaemonInfo | null;
  initialToday?: TodayTotals | null;
  initialHourly?: HourlyStat[];
}

export function DaemonStatsPanel({ initialDaemon, initialToday, initialHourly }: DaemonStatsPanelProps = {}) {
  const [daemon, setDaemon] = useState<DaemonInfo | null>(initialDaemon || null);
  const [today, setToday] = useState<TodayTotals | null>(initialToday || null);
  const [activeBySource, setActiveBySource] = useState<Record<string, number>>({});
  const [hourly, setHourly] = useState<HourlyStat[]>(initialHourly || []);
  const [selectedSlot, setSelectedSlot] = useState<HourlyStat | null>(null);
  const [loading, setLoading] = useState(!initialDaemon && !initialHourly?.length);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [syncStates, setSyncStates] = useState<SyncState[]>([]);

  // Son manuel buton tıklamasını takip et (arka plan sorgusu arayüzü geri döndürmesin)
  const pendingActionRef = useRef<"start" | "stop" | "restart" | null>(null);
  const lastActionTimeRef = useRef<number>(0);

  // Canlı Terminal Konsolu Durumları
  const [showTerminal, setShowTerminal] = useState(true);
  const [copiedLogs, setCopiedLogs] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);

  // Tarih Filtreleme: "today" (varsayılan) | "yesterday" | "custom" | "all"
  const [dateFilter, setDateFilter] = useState<"today" | "yesterday" | "custom" | "all">("today");
  const [customDate, setCustomDate] = useState<string>("");

  const todayStr = today?.date || getTurkeyDateStr();
  const yesterdayStr = getTurkeyYesterdayStr();

  const formattedCustomDate = customDate
    ? customDate.split("-").reverse().join(".")
    : "";

  const filteredHourly = hourly.filter((row) => {
    if (dateFilter === "today") return row.dateStr === todayStr;
    if (dateFilter === "yesterday") return row.dateStr === yesterdayStr;
    if (dateFilter === "custom") return formattedCustomDate ? row.dateStr === formattedCustomDate : true;
    return true; // "all"
  });

  const todayCount = hourly.filter((r) => r.dateStr === todayStr).length;
  const yesterdayCount = hourly.filter((r) => r.dateStr === yesterdayStr).length;

  async function fetchStats() {
    try {
      const res = await fetch(`/api/admin/daemon-stats?_t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
      });
      if (res.ok) {
        const data = await res.json();

        // Son 6 saniyedeki buton komutu henüz okunmamış olabilir; yalnızca KOMUT gösterilir. Çevrimiçi/kapalı
        // durumu her zaman motorun kendi sinyalinden gelir (eskiden "Başlat"a basınca sunucu kapalıyken de
        // sahte kalp atışıyla "çevrimiçi" görünüyordu).
        const timeSinceAction = Date.now() - lastActionTimeRef.current;
        if (timeSinceAction < 6000 && pendingActionRef.current) {
          const isStop = pendingActionRef.current === "stop";
          if (data.daemon) data.daemon = { ...data.daemon, command: isStop ? "stop" : "run" };
        } else {
          pendingActionRef.current = null;
        }

        setDaemon(data.daemon);
        setToday(data.today);
        setActiveBySource(data.activeBySource || {});
        setHourly(data.hourly || []);
        setSyncStates(data.syncStates || []);
        setLastRefreshed(new Date());

        // Üst sayaçları sayfayı F5 yapmaya gerek kalmadan canlı güncelle
        if (typeof data.activeCount === "number") {
          const el = document.getElementById("admin-stat-active");
          if (el) el.textContent = data.activeCount.toLocaleString("tr-TR");
        }
        if (typeof data.archivedCount === "number") {
          const el = document.getElementById("admin-stat-archive");
          if (el) el.textContent = data.archivedCount.toLocaleString("tr-TR");
          const badge = document.getElementById("admin-badge-archive");
          if (badge) badge.textContent = data.archivedCount.toLocaleString("tr-TR");
        }
      }
    } catch (err) {
      console.error("Metrikler yüklenemedi:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Kaynak senkron tablosu sunucudan gelmediği için ilk yüklemede hemen çekilir.
    fetchStats();
  }, []);
  useVisibleInterval(fetchStats, 25000);

  const [controlling, setControlling] = useState(false);
  const currentMode = daemon?.mode || "hybrid";

  async function handleDaemonControl(action: "start" | "stop" | "restart") {
    lastActionTimeRef.current = Date.now();
    pendingActionRef.current = action;
    setControlling(true);

    // Komut gönderildi bilgisi gösterilir; motorun çalışıp çalışmadığı bir sonraki sinyalde netleşir.
    setDaemon((prev) =>
      prev
        ? {
            ...prev,
            command: action === "stop" ? "stop" : "run",
            currentPhase:
              action === "stop"
                ? "🛑 Durdurma komutu gönderildi, motorun onayı bekleniyor..."
                : action === "restart"
                  ? "🔄 Yeniden başlatma komutu gönderildi, motorun onayı bekleniyor..."
                  : "🚀 Başlatma komutu gönderildi, motorun onayı bekleniyor...",
          }
        : null
    );

    try {
      const res = await fetch(`/api/admin/daemon/control?_t=${Date.now()}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        const data = await res.json();
        setDaemon((prev) => (prev ? { ...prev, command: data.command, mode: data.mode || prev.mode } : null));
        // Motor komutu en geç bir sonraki döngüde okur; gerçek durum birkaç saniye sonra yeniden çekilir.
        setTimeout(() => void fetchStats(), 7000);
      }
    } catch (err) {
      console.error("Daemon control hatası:", err);
    } finally {
      setControlling(false);
    }
  }

  async function handleModeChange(newMode: "hybrid" | "new_only" | "sweep_only") {
    if (controlling) return;
    if (daemon) {
      setDaemon({ ...daemon, mode: newMode });
    }
    setControlling(true);
    try {
      const res = await fetch("/api/admin/daemon/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_mode", mode: newMode }),
      });
      if (res.ok) {
        await fetchStats();
      }
    } catch (err) {
      console.error("Daemon mode hatası:", err);
    } finally {
      setControlling(false);
    }
  }

  return (
    <div className="card space-y-6 p-5 sm:p-6 border border-emerald-500/20 bg-slate-950/40 relative overflow-hidden">
      {/* Arka plan dekoratif yeşil ışıma */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />

      {/* Başlık ve Durum */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-2xl border transition ${
              daemon?.isOnline
                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400 shadow-lg shadow-emerald-500/10"
                : "bg-rose-500/15 border-rose-500/30 text-rose-400 shadow-lg shadow-rose-500/10"
            }`}
          >
            <span className="text-2xl">{daemon?.isOnline ? "🤖" : "🛑"}</span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-black tracking-tight text-white">
                7/24 Otonom Scraper & Saatlik Takip
              </h2>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
                  daemon?.isOnline
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                    : "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                }`}
              >
                {daemon?.isOnline ? "7/24 CANLI AKTİF" : daemon?.status === "stopped" ? "DURDURULDU" : "SİNYAL YOK"}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider border ${
                  currentMode === "new_only"
                    ? "bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/10"
                    : currentMode === "sweep_only"
                    ? "bg-purple-500/15 text-purple-300 border-purple-500/40 shadow-sm shadow-purple-500/10"
                    : "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                }`}
              >
                {currentMode === "new_only"
                  ? "🚀 SADECE YENİ İLAN"
                  : currentMode === "sweep_only"
                  ? "🧹 SADECE ÖLÜ TEMİZLEME"
                  : "⚖️ HİBRİT MOD"}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {daemon?.host || "bilinmiyor"} • Bellek: {daemon?.memoryMb != null ? `${daemon.memoryMb} MB` : "—"} • Döngü: #
              {daemon?.cycle || 0}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {daemon?.isOnline ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleDaemonControl("restart")}
                disabled={controlling}
                className="flex items-center gap-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 px-3 py-1.5 text-xs font-bold text-amber-300 transition shadow-sm cursor-pointer disabled:opacity-50"
                title="Daemon sürecini PM2 ile yeniden başlatır ve GitHub'dan taze kod çeker"
              >
                <span>🔄</span>
                <span>{controlling ? "İşleniyor..." : "Yeniden Başlat"}</span>
              </button>
              <button
                onClick={() => handleDaemonControl("stop")}
                disabled={controlling}
                className="flex items-center gap-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 px-3 py-1.5 text-xs font-bold text-rose-300 transition shadow-sm cursor-pointer disabled:opacity-50"
                title="Daemon motorunu uzaktan hemen durdurur"
              >
                <span>🛑</span>
                <span>{controlling ? "Durduruluyor..." : "Motoru Durdur"}</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => handleDaemonControl("start")}
              disabled={controlling}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 px-3 py-1.5 text-xs font-bold text-emerald-300 transition shadow-sm cursor-pointer disabled:opacity-50"
              title="Daemon motorunu yeniden başlatır"
            >
              <span>▶️</span>
              <span>{controlling ? "Başlatılıyor..." : "Motoru Başlat"}</span>
            </button>
          )}

          <button
            onClick={() => fetchStats()}
            className="flex items-center gap-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 transition"
          >
            <span>🔄</span>
            <span>Yenile ({lastRefreshed.toLocaleTimeString("tr-TR")})</span>
          </button>
        </div>
      </div>

      {/* 7/24 Otonom Çalışma Modu Seçici Barı */}
      <div className="rounded-xl bg-slate-900/90 border border-white/10 p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <span className="text-xs font-bold text-white flex items-center gap-1.5 shrink-0">
            <span>⚙️</span>
            <span>Motor Çalışma Modu:</span>
          </span>
          <span className="text-[11px] text-slate-400">
            {currentMode === "new_only" && (
              <span className="text-amber-300 font-semibold">
                🚀 Sadece yeni ilan keşfi (envanter senkronu ve doğrulama atlanır)
              </span>
            )}
            {currentMode === "sweep_only" && (
              <span className="text-purple-300 font-semibold">
                🧹 Sadece envanter senkronu ve doğrulama (yeni ilan keşfi durur)
              </span>
            )}
            {currentMode === "hybrid" && (
              <span className="text-emerald-300 font-semibold">
                ⚖️ Hibrit (her tur yeni ilan keşfi + sırası gelen kaynağın tam envanter senkronu)
              </span>
            )}
          </span>
        </div>

        {/* 3 Butonlu Segmented Seçici */}
        <div className="inline-flex rounded-xl bg-black/50 p-1 border border-white/10 gap-1 shrink-0 self-start md:self-auto">
          <button
            onClick={() => handleModeChange("new_only")}
            disabled={controlling}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer disabled:opacity-50 ${
              currentMode === "new_only"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/25 ring-1 ring-amber-400"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
            title="PC'nizde 'temizle-olu-ilanlari.bat' çalışırken bu moda alın. Otonom motor sadece yeni araçları keşfeder, çakışma ve boşa tarama olmaz!"
          >
            <span>🚀</span>
            <span>Sadece Yeni İlan</span>
          </button>

          <button
            onClick={() => handleModeChange("hybrid")}
            disabled={controlling}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer disabled:opacity-50 ${
              currentMode === "hybrid"
                ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/25 ring-1 ring-emerald-400"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
            title="Standart dengeli mod: Hem yeni ilanları keşfeder hem de eski ilanları kontrol eder."
          >
            <span>⚖️</span>
            <span>Hibrit (Dengeli)</span>
          </button>

          <button
            onClick={() => handleModeChange("sweep_only")}
            disabled={controlling}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer disabled:opacity-50 ${
              currentMode === "sweep_only"
                ? "bg-purple-600 text-white shadow-md shadow-purple-600/25 ring-1 ring-purple-400"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
            title="Sadece ölü ilan temizliği: Yeni çekmeyi durdurur, eski ilanları denetler."
          >
            <span>🧹</span>
            <span>Sadece Ölü Temizliği</span>
          </button>
        </div>
      </div>

      {/* Güncel Aşama Bilgi Şeridi */}
      <div className="rounded-xl bg-emerald-950/30 border border-emerald-500/20 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400 font-bold">Şu Anki İşlem:</span>
          <span className="text-slate-200 font-mono font-medium">
            {daemon?.currentPhase || "Hazır"}
          </span>
        </div>
        <div className="text-slate-400">
          Son Kalp Atışı:{" "}
          <span className="text-slate-300 font-medium">
            {daemon?.lastHeartbeat
              ? new Date(daemon.lastHeartbeat).toLocaleTimeString("tr-TR")
              : "Bilinmiyor"}
          </span>
        </div>
      </div>

      {/* Kaynak Senkron Durumu: her kaynağın tüm envanteri en son ne zaman doğrulandı */}
      <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-white">🔎 Kaynak Senkron Durumu</h3>
          <span className="text-[11px] text-slate-400">
            Her kaynağın tüm ilan listesi belirli aralıklarla baştan sona taranır; satılanlar arşive, geri gelenler yayına alınır.
          </span>
        </div>
        {syncStates.length === 0 ? (
          <p className="text-xs text-slate-400">Henüz senkron kaydı yok (motor ilk turunu tamamlayınca görünür).</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-400">
                  <th className="py-1.5 pr-3 font-semibold">Kaynak</th>
                  <th className="py-1.5 pr-3 font-semibold">Son çalışma</th>
                  <th className="py-1.5 pr-3 font-semibold">Durum</th>
                  <th className="py-1.5 pr-3 font-semibold text-right">Görülen</th>
                  <th className="py-1.5 pr-3 font-semibold text-right">Güncellenen</th>
                  <th className="py-1.5 pr-3 font-semibold text-right">Geri alınan</th>
                  <th className="py-1.5 pr-3 font-semibold text-right">Arşivlenen</th>
                  <th className="py-1.5 font-semibold text-right">İzlemede</th>
                </tr>
              </thead>
              <tbody>
                {syncStates.map((s) => {
                  const st = s.lastStatus ? SYNC_STATUS[s.lastStatus] : null;
                  return (
                    <tr key={s.source} className="border-t border-white/5 align-top" title={s.lastMessage}>
                      <td className="py-1.5 pr-3 font-semibold text-slate-200">{SYNC_LABELS[s.source] || s.source}</td>
                      <td className="py-1.5 pr-3 text-slate-300">{s.lastRunAt ? formatRelativeTr(s.lastRunAt) : "—"}</td>
                      <td className="py-1.5 pr-3">
                        {st ? <span className={`rounded-md border px-1.5 py-0.5 font-semibold ${st.cls}`}>{st.label}</span> : "—"}
                      </td>
                      <td className="py-1.5 pr-3 text-right text-slate-200">{s.seen ?? "—"}</td>
                      <td className="py-1.5 pr-3 text-right text-sky-300">{s.updated}</td>
                      <td className="py-1.5 pr-3 text-right text-emerald-300">{s.reactivated}</td>
                      <td className="py-1.5 pr-3 text-right text-rose-300">{s.archived}</td>
                      <td className="py-1.5 text-right text-amber-300">{s.markedMissing}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Canlı Terminal & Sunucu Logları (PM2 Canlı Akış Konsolu) */}
      <div className="rounded-xl bg-slate-950/90 border border-slate-800 shadow-lg overflow-hidden transition-all">
        {/* Terminal Üst Barı */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <span className="flex h-2.5 w-2.5 relative">
              {daemon?.isOnline && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span
                className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  daemon?.isOnline ? "bg-emerald-500" : "bg-rose-500"
                }`}
              ></span>
            </span>
            <span className="font-mono text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <span>🖥️</span>
              <span>Canlı Sunucu Logları & PM2 Konsolu</span>
            </span>
            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-400">
              {daemon?.recentLogs?.length || 0} Satır
            </span>
          </div>

          <div className="flex items-center gap-2">
            {daemon?.recentLogs && daemon.recentLogs.length > 0 && (
              <button
                onClick={() => {
                  const text = (daemon.recentLogs || []).join("\n");
                  navigator.clipboard.writeText(text);
                  setCopiedLogs(true);
                  setTimeout(() => setCopiedLogs(false), 2000);
                }}
                className="rounded bg-white/5 hover:bg-white/10 px-2 py-1 text-[11px] font-mono text-slate-300 transition flex items-center gap-1 cursor-pointer"
                title="Tüm logları panoya kopyalar"
              >
                <span>{copiedLogs ? "✅ Kopyalandı" : "📋 Kopyala"}</span>
              </button>
            )}

            <button
              onClick={() => setShowTerminal(!showTerminal)}
              className="rounded bg-white/5 hover:bg-white/10 px-2 py-1 text-[11px] font-mono text-slate-400 hover:text-white transition cursor-pointer"
            >
              {showTerminal ? "▲ Gizle" : "▼ Göster"}
            </button>
          </div>
        </div>

        {/* Terminal İçerik Penceresi */}
        {showTerminal && (
          <div
            ref={terminalRef}
            className="p-3.5 bg-black/95 font-mono text-[11px] leading-relaxed max-h-64 overflow-y-auto divide-y divide-white/5 select-text"
          >
            {daemon?.recentLogs && daemon.recentLogs.length > 0 ? (
              daemon.recentLogs.map((line, idx) => {
                let colorClass = "text-slate-300";
                if (line.includes("✅")) colorClass = "text-emerald-400 font-medium";
                else if (line.includes("🚀") || line.includes("EŞZAMANLI")) colorClass = "text-cyan-400 font-semibold";
                else if (line.includes("⏸️") || line.includes("MOLA")) colorClass = "text-amber-300 font-semibold";
                else if (line.includes("⚠️") || line.includes("Hata") || line.includes("429") || line.includes("403")) colorClass = "text-rose-400 font-semibold";
                else if (line.includes("Tarama:") || line.includes("çekiliyor") || line.includes("inceleniyor")) colorClass = "text-sky-300";

                return (
                  <div key={idx} className={`py-0.5 hover:bg-white/5 px-1 rounded transition-colors ${colorClass}`}>
                    {line}
                  </div>
                );
              })
            ) : (
              <div className="py-4 text-center text-slate-500 italic">
                {daemon?.isOnline
                  ? "Sunucu aktif çalışıyor. Canlı log akışı bir sonraki döngüde yüklenecek..."
                  : "Sunucu çevrimdışı veya henüz log üretilmedi."}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bugünün Hızlı Toplamları (4 Kart) */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
          Otonom motor — bugünün özeti ({today?.date || new Date().toLocaleDateString("tr-TR")})
        </h3>
        <p className="-mt-2 mb-3 text-[11px] text-slate-500">
          Yalnızca sunucudaki 7/24 motorun işi. Bekçi ve elle yapılan taramalar dahil toplam için sayfanın en üstündeki günlük özete bak.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-slate-900/80 border border-white/5 p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Taranan İlan</p>
            <p className="text-2xl font-black text-white mt-1">
              {(today?.scanned || 0).toLocaleString("tr-TR")}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Toplam kontrol edilen</p>
          </div>

          <div className="rounded-xl bg-slate-900/80 border border-white/5 p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">Yeni Eklenen</p>
            <p className="text-2xl font-black text-emerald-400 mt-1">
              +{(today?.inserted || 0).toLocaleString("tr-TR")}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Veritabanına ilk kez giren</p>
          </div>

          <div className="rounded-xl bg-slate-900/80 border border-white/5 p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-sky-400">Güncellenen</p>
            <p className="text-2xl font-black text-sky-400 mt-1">
              {(today?.updated || 0).toLocaleString("tr-TR")}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Fiyat değişimi & doğrulama</p>
          </div>

          <div className="rounded-xl bg-slate-900/80 border border-white/5 p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-rose-400">Temizlenen</p>
            <p className="text-2xl font-black text-rose-400 mt-1">
              {(today?.deleted || 0).toLocaleString("tr-TR")}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Satılan / kaldırılan ilan</p>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          &quot;Taranan&quot; aynı ilanların her turda yeniden sayılmasıdır; gerçek iş aşağıdaki kaynak tablosundadır.
        </p>

        {/* Kaynaklara göre: aktif envanter ve bugün motorun yaptığı iş */}
        {(Object.keys(activeBySource).length > 0 || Object.keys(today?.bySource || {}).length > 0) && (
          <div className="mt-4 overflow-x-auto rounded-xl border border-white/5 bg-slate-900/80">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400">
                  <th className="px-3.5 py-2.5 font-bold">Kaynak</th>
                  <th className="px-3.5 py-2.5 text-right font-bold">Aktif ilan</th>
                  <th className="px-3.5 py-2.5 text-right font-bold text-emerald-400">Bugün yeni</th>
                  <th className="px-3.5 py-2.5 text-right font-bold text-sky-400">Güncellenen</th>
                  <th className="px-3.5 py-2.5 text-right font-bold text-rose-400">Arşive taşınan</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(SOURCE_LABELS)
                  .filter((key) => key in activeBySource || key in (today?.bySource || {}))
                  .sort((a, b) => (activeBySource[b] || 0) - (activeBySource[a] || 0))
                  .map((key) => {
                    const row = today?.bySource?.[key];
                    return (
                      <tr key={key} className="border-t border-white/5">
                        <td className="px-3.5 py-2 font-semibold text-white">{SOURCE_LABELS[key]}</td>
                        <td className="px-3.5 py-2 text-right text-slate-300">{(activeBySource[key] || 0).toLocaleString("tr-TR")}</td>
                        <td className="px-3.5 py-2 text-right font-bold text-emerald-400">{(row?.inserted || 0).toLocaleString("tr-TR")}</td>
                        <td className="px-3.5 py-2 text-right text-sky-400">{(row?.updated || 0).toLocaleString("tr-TR")}</td>
                        <td className="px-3.5 py-2 text-right text-rose-400">{(row?.deleted || 0).toLocaleString("tr-TR")}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
            <p className="border-t border-white/5 px-3.5 py-2.5 text-[11px] leading-relaxed text-slate-500">
              Arabam sunucudan çekilemiyor (Cloudflare engeli); Arabam ilanlarını bilgisayardaki bekçi ve elle tarama besliyor. Diğer
              kaynaklar küçük olduğu için günde birkaç on yeni ilan normaldir.
            </p>
          </div>
        )}
      </div>

      {/* Saatlik İstatistik Tablosu */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>⏱️</span>
              <span>Saat Saat Tarama & Güncelleme Raporu</span>
            </h3>
            <span className="text-xs text-slate-500">
              ({filteredHourly.length} saat listeleniyor)
            </span>
          </div>

          {/* Tarih Filtreleme Sekmeleri */}
          <div className="flex items-center gap-1.5 bg-slate-900/90 border border-white/10 rounded-lg p-1 text-xs flex-wrap">
            <button
              onClick={() => setDateFilter("today")}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                dateFilter === "today"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Bugün ({todayCount})
            </button>
            <button
              onClick={() => setDateFilter("yesterday")}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                dateFilter === "yesterday"
                  ? "bg-sky-500/20 text-sky-300 border border-sky-500/30 font-bold shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Dün ({yesterdayCount})
            </button>

            {/* Manuel Tarih Seçici */}
            <div className="relative flex items-center">
              <input
                type="date"
                value={customDate}
                onChange={(e) => {
                  setCustomDate(e.target.value);
                  if (e.target.value) setDateFilter("custom");
                }}
                className={`bg-slate-800 border px-2 py-0.5 rounded text-xs text-slate-200 focus:outline-none transition ${
                  dateFilter === "custom"
                    ? "border-amber-500/50 text-amber-300 ring-1 ring-amber-500/30 font-bold"
                    : "border-white/10 text-slate-400"
                }`}
                title="İstediğin bir tarihi seç"
              />
            </div>

            <button
              onClick={() => setDateFilter("all")}
              className={`px-2 py-1 rounded-md font-medium transition ${
                dateFilter === "all"
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold shadow-sm"
                  : "text-slate-500 hover:text-white"
              }`}
            >
              Tümü ({hourly.length})
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm text-slate-500 animate-pulse">
            Saatlik metrikler yükleniyor...
          </div>
        ) : filteredHourly.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 p-8 text-center">
            <p className="text-sm text-slate-400">
              {dateFilter === "today"
                ? "Bugün için henüz saatlik metrik kaydı oluşmadı."
                : dateFilter === "yesterday"
                ? "Dün için kayıtlı saatlik metrik bulunamadı."
                : dateFilter === "custom" && formattedCustomDate
                ? `${formattedCustomDate} tarihinde saatlik metrik kaydı bulunamadı.`
                : "Seçili tarih filtresine uygun saatlik kayıt bulunamadı."}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Farklı bir tarih seçebilir ya da tüm geçmişi listelemek için "Tümü" butonuna tıklayabilirsin.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-900/40">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-white/5 text-[11px] uppercase tracking-wider text-slate-400 border-b border-white/10">
                <tr>
                  <th className="py-3 px-4">Zaman Aralığı</th>
                  <th className="py-3 px-3 text-right">Taranan İlan</th>
                  <th className="py-3 px-3 text-right">Yeni İlan</th>
                  <th className="py-3 px-3 text-right">Güncellenen</th>
                  <th className="py-3 px-3 text-right">Kaldırılan</th>
                  <th className="py-3 px-4">Kaynak Dağılımı</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredHourly.map((row) => (
                  <tr
                    key={row._id}
                    onClick={() => setSelectedSlot(row)}
                    className="hover:bg-white/[0.06] transition cursor-pointer group"
                    title="Bu saat diliminin araç detaylarını, fiyat değişimlerini ve kaldırılanları görmek için tıkla"
                  >
                    <td className="py-3 px-4 font-mono font-medium text-slate-200">
                      <div className="flex items-center gap-2">
                        <div>
                          <span className="text-emerald-400 font-bold">{row.dateStr}</span>{" "}
                          <span className="text-slate-400">{row.hourRange}</span>
                        </div>
                        <span className="opacity-0 group-hover:opacity-100 rounded-md bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 text-[10px] text-emerald-300 font-bold transition">
                          İncele ➔
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-semibold text-white">
                      {row.scanned.toLocaleString("tr-TR")}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-emerald-400">
                      {row.inserted > 0 ? `+${row.inserted}` : "0"}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-sky-400">
                      {row.updated.toLocaleString("tr-TR")}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-rose-400">
                      {row.deleted > 0 ? `-${row.deleted}` : "0"}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {row.bySource?.arabam && (row.bySource.arabam.scanned > 0 || row.bySource.arabam.updated > 0) && (
                          <span className="rounded bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-300 font-medium">
                            Arabam: {row.bySource.arabam.scanned}
                          </span>
                        )}
                        {row.bySource?.otomerkezi && (row.bySource.otomerkezi.scanned > 0 || row.bySource.otomerkezi.updated > 0) && (
                          <span className="rounded bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 text-[10px] text-blue-300 font-medium">
                            Otomerkezi: {row.bySource.otomerkezi.scanned}
                          </span>
                        )}
                        {row.bySource?.vavacars && row.bySource.vavacars.scanned > 0 && (
                          <span className="rounded bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 text-[10px] text-purple-300 font-medium">
                            VavaCars: {row.bySource.vavacars.scanned}
                          </span>
                        )}
                        {row.bySource?.otoplus && (row.bySource.otoplus.scanned > 0 || (row.bySource.otoplus.inserted ?? 0) > 0) && (
                          <span className="rounded bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 text-[10px] text-rose-300 font-medium">
                            Otoplus: {row.bySource.otoplus.scanned}
                          </span>
                        )}
                        {row.bySource?.carvak && (row.bySource.carvak.scanned > 0 || (row.bySource.carvak.inserted ?? 0) > 0) && (
                          <span className="rounded bg-teal-500/10 border border-teal-500/20 px-1.5 py-0.5 text-[10px] text-teal-300 font-medium">
                            Carvak: {row.bySource.carvak.scanned}
                          </span>
                        )}
                        {row.bySource?.otokoc && (row.bySource.otokoc.scanned > 0 || (row.bySource.otokoc.inserted ?? 0) > 0) && (
                          <span className="rounded bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 text-[10px] text-indigo-300 font-medium">
                            Otokoç: {row.bySource.otokoc.scanned}
                          </span>
                        )}
                        {row.bySource?.dod && (row.bySource.dod.scanned > 0 || (row.bySource.dod.inserted ?? 0) > 0) && (
                          <span className="rounded bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 text-[10px] text-blue-300 font-medium">
                            DOD: {row.bySource.dod.scanned}
                          </span>
                        )}
                        {row.bySource?.ikinciyeni && (row.bySource.ikinciyeni.scanned > 0 || (row.bySource.ikinciyeni.inserted ?? 0) > 0) && (
                          <span className="rounded bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-300 font-medium">
                            İkinciyeni: {row.bySource.ikinciyeni.scanned}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* Tıklanan Saat Diliminin Canlı Detay Modalı */}
      {selectedSlot && (
        <HourlyDetailModal
          slot={selectedSlot}
          onClose={() => setSelectedSlot(null)}
        />
      )}
    </div>
  );
}
