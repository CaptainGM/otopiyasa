"use client";

import { useEffect, useState, useTransition, useRef } from "react";
import { HourlyDetailModal } from "@/components/HourlyDetailModal";

interface DaemonInfo {
  isOnline: boolean;
  host: string;
  currentPhase: string;
  cycle: number;
  memoryMb: number;
  uptimeSeconds: number;
  lastHeartbeat: string | null;
  status: "online" | "idle" | "stopped";
  mode?: "hybrid" | "new_only" | "sweep_only";
  command?: "run" | "stop";
  recentLogs?: string[];
}

interface TodayTotals {
  date: string;
  scanned: number;
  inserted: number;
  updated: number;
  deleted: number;
}

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
  const [hourly, setHourly] = useState<HourlyStat[]>(initialHourly || []);
  const [selectedSlot, setSelectedSlot] = useState<HourlyStat | null>(null);
  const [loading, setLoading] = useState(!initialDaemon && !initialHourly?.length);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [isPending, startTransition] = useTransition();

  // Canlı Terminal Konsolu Durumları
  const [showTerminal, setShowTerminal] = useState(true);
  const [copiedLogs, setCopiedLogs] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);

  // Tarih Filtreleme: "today" (varsayılan) | "yesterday" | "custom" | "all"
  const [dateFilter, setDateFilter] = useState<"today" | "yesterday" | "custom" | "all">("today");
  const [customDate, setCustomDate] = useState<string>("");

  const now = new Date();
  const todayStr = today?.date || now.toLocaleDateString("tr-TR");
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toLocaleDateString("tr-TR");

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
      const res = await fetch("/api/admin/daemon-stats");
      if (res.ok) {
        const data = await res.json();
        setDaemon(data.daemon);
        setToday(data.today);
        setHourly(data.hourly || []);
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
    fetchStats();
    // Her 25 saniyede bir kalp atışıyla eşzamanlı otomatik canlı güncelleme
    const timer = setInterval(fetchStats, 25000);
    return () => clearInterval(timer);
  }, []);

  async function handleSeedSample() {
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/daemon-stats", { method: "POST" });
        if (res.ok) {
          await fetchStats();
        }
      } catch {}
    });
  }

  const [controlling, setControlling] = useState(false);
  const currentMode = daemon?.mode || "hybrid";

  async function handleDaemonControl(action: "start" | "stop") {
    setControlling(true);
    try {
      const res = await fetch("/api/admin/daemon/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        await fetchStats();
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
                {daemon?.isOnline ? "7/24 CANLI AKTİF" : "DURDURULDU"}
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
              {daemon?.host} • Bellek: {daemon?.memoryMb || 45} MB RAM • Döngü: #{daemon?.cycle || 1}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {daemon?.isOnline ? (
            <button
              onClick={() => handleDaemonControl("stop")}
              disabled={controlling}
              className="flex items-center gap-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 px-3 py-1.5 text-xs font-bold text-rose-300 transition shadow-sm cursor-pointer disabled:opacity-50"
              title="Daemon motorunu uzaktan hemen durdurur"
            >
              <span>🛑</span>
              <span>{controlling ? "Durduruluyor..." : "Motoru Durdur"}</span>
            </button>
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

          {hourly.length === 0 && (
            <button
              onClick={handleSeedSample}
              disabled={isPending}
              className="rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition"
              title="Grafik ve tabloyu hemen görmek için örnek saatlik veri oluşturur"
            >
              {isPending ? "Oluşturuluyor..." : "⚡ Örnek Geçmiş Üret"}
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
                🚀 Sadece Yeni İlanlar (Ölü temizliği atlanır, 100% kapasite taze araç keşfine ayrılır)
              </span>
            )}
            {currentMode === "sweep_only" && (
              <span className="text-purple-300 font-semibold">
                🧹 Sadece Ölü İlan Temizliği (Yeni çekme durdurulur, eski ilanlar denetlenir)
              </span>
            )}
            {currentMode === "hybrid" && (
              <span className="text-emerald-300 font-semibold">
                ⚖️ Hibrit (Hem yeni araçlar taranır hem eski ilanlar doğrulanır)
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

      {/* Sadece Yeni İlan Modu İçin Bilgilendirici İpucu */}
      {currentMode === "new_only" && (
        <div className="rounded-xl bg-amber-950/20 border border-amber-500/30 p-3 text-xs text-amber-200/90 flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2.5">
            <span className="text-base shrink-0">💡</span>
            <span>
              <strong>Tavsiye Edilen Çalışma:</strong> Bilgisayarınızda{" "}
              <code className="text-white bg-black/40 px-1 py-0.5 rounded font-mono">
                temizle-olu-ilanlari.bat
              </code>{" "}
              çalışırken otonom motor arka planda yalnızca yeni araçları çeker. Böylece 13.000+ boşa tarama önlenir ve havuz sürekli yeni ilanlarla beslenir!
            </span>
          </div>
        </div>
      )}

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
          Bugünün Özeti ({today?.date || new Date().toLocaleDateString("tr-TR")})
        </h3>
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
