"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ManualDetailModal, ManualScrapeItem } from "@/components/ManualDetailModal";

interface TodayManualTotals {
  date: string;
  scanned: number;
  inserted: number;
  updated: number;
  durationSeconds: number;
  operations: number;
}

export function ScrapePanel({
  initialLogs,
  initialToday,
}: {
  initialLogs?: ManualScrapeItem[];
  initialToday?: TodayManualTotals;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [logs, setLogs] = useState<ManualScrapeItem[]>(initialLogs || []);
  const [today, setToday] = useState<TodayManualTotals | null>(initialToday || null);
  const [refreshingLogs, setRefreshingLogs] = useState(false);
  const [selectedLog, setSelectedLog] = useState<ManualScrapeItem | null>(null);
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "yesterday" | "custom">("all");
  const [customDate, setCustomDate] = useState<string>("");

  async function loadLogs() {
    setRefreshingLogs(true);
    try {
      const res = await fetch("/api/admin/manual-scrapes");
      if (res.ok) {
        const data = await res.json();
        if (data.logs) setLogs(data.logs);
        if (data.today) setToday(data.today);
      }
    } catch {
      // sessiz yakala
    } finally {
      setRefreshingLogs(false);
    }
  }

  useEffect(() => {
    if (!initialLogs || initialLogs.length === 0) {
      loadLogs();
    }
  }, []);

  const now = new Date();
  const todayStr = useMemo(() => now.toLocaleDateString("tr-TR"), []);
  const yesterdayStr = useMemo(() => {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    return y.toLocaleDateString("tr-TR");
  }, []);

  const formattedCustomDate = customDate
    ? customDate.split("-").reverse().join(".")
    : "";

  const todayCount = useMemo(
    () => logs.filter((l) => new Date(l.createdAt).toLocaleDateString("tr-TR") === todayStr).length,
    [logs, todayStr]
  );
  const yesterdayCount = useMemo(
    () => logs.filter((l) => new Date(l.createdAt).toLocaleDateString("tr-TR") === yesterdayStr).length,
    [logs, yesterdayStr]
  );

  // Tarih filtresine göre loglar
  const filteredLogs = useMemo(() => {
    if (dateFilter === "all") return logs;
    return logs.filter((log) => {
      const logDateStr = new Date(log.createdAt).toLocaleDateString("tr-TR");
      if (dateFilter === "today") return logDateStr === todayStr;
      if (dateFilter === "yesterday") return logDateStr === yesterdayStr;
      if (dateFilter === "custom") return formattedCustomDate ? logDateStr === formattedCustomDate : true;
      return true;
    });
  }, [logs, dateFilter, todayStr, yesterdayStr, formattedCustomDate]);

  // Loglardan hesaplanan bugünün toplamları (eğer API'den gelmediyse yerel fallback)
  const effectiveToday = useMemo(() => {
    if (today) return today;
    let sc = 0;
    let ins = 0;
    let upd = 0;
    let dur = 0;
    let ops = 0;
    for (const l of logs) {
      const d = new Date(l.createdAt).toLocaleDateString("tr-TR");
      if (d === todayStr) {
        sc += l.scanned || 0;
        ins += l.inserted || 0;
        upd += l.updated || 0;
        dur += l.durationSeconds || 0;
        ops += 1;
      }
    }
    return {
      date: todayStr,
      scanned: sc,
      inserted: ins,
      updated: upd,
      durationSeconds: Math.round(dur * 10) / 10,
      operations: ops,
    };
  }, [today, logs, todayStr]);

  async function run(
    source:
      | "demo"
      | "all"
      | "sahibinden"
      | "arabam"
      | "otomerkezi"
      | "vavacars"
      | "otoplus"
      | "carvak"
      | "otokoc"
      | "dod"
      | "ikinciyeni",
    limit?: number,
    mode?: string
  ) {
    const key = (mode || source) + (limit ? `-${limit}` : "");
    setLoading(key);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/scrape/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, query: "otomobil", limit, mode }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Veri çekme başarısız.");
        return;
      }

      setMessage(
        `${data.message || "İşlem bitti."} Yeni eklenen: +${data.inserted ?? 0}, güncellenen: ${data.updated ?? 0}.`
      );
      await loadLogs();
      router.refresh();
    } catch {
      setError("API'ye bağlanılamadı.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="card space-y-6 p-6 border border-amber-500/20 bg-slate-950/40 relative overflow-hidden">
      {/* Dekoratif Arka Plan Işıması */}
      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-56 h-56 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* BAŞLIK & AÇIKLAMA */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-3 w-3 rounded-full bg-amber-500 animate-pulse" />
            <h3 className="text-xl font-black tracking-tight text-white">
              Manuel Veri Çekme & Denetim Paneli
            </h3>
            <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-xs font-bold text-amber-300">
              8 PLATFORM AKTİF
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            İstediğin an 8 kurumsal platformdan taze ilan toplayabilir, fiyatları senkronlayabilir ve tüm geçmişi inceleyebilirsin.
          </p>
        </div>
        <button
          onClick={loadLogs}
          disabled={refreshingLogs}
          className="self-start sm:self-auto flex items-center gap-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 transition"
        >
          <span>🔄</span>
          <span>{refreshingLogs ? "Yenileniyor..." : "Kayıtları Yenile"}</span>
        </button>
      </div>

      {/* BUGÜNÜN MANUEL ÇEKİM ÖZETİ (4 KART - AYNI GÜN MANTIĞI) */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
          <span>📅</span>
          <span>Bugünün Manuel Çekim Özeti ({effectiveToday.date})</span>
        </h4>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-slate-900/80 border border-white/5 p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Taranan İlan</p>
            <p className="text-2xl font-black text-white mt-1">
              {effectiveToday.scanned.toLocaleString("tr-TR")}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Bugün manuel taranan</p>
          </div>

          <div className="rounded-xl bg-slate-900/80 border border-white/5 p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">Yeni Eklenen</p>
            <p className="text-2xl font-black text-emerald-400 mt-1">
              +{effectiveToday.inserted.toLocaleString("tr-TR")}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">DB'ye yeni giren taze ilan</p>
          </div>

          <div className="rounded-xl bg-slate-900/80 border border-white/5 p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-sky-400">Güncellenen</p>
            <p className="text-2xl font-black text-sky-400 mt-1">
              {effectiveToday.updated.toLocaleString("tr-TR")}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Fiyat & bilgi eşitlenen</p>
          </div>

          <div className="rounded-xl bg-slate-900/80 border border-white/5 p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-400">İşlem & Süre</p>
            <p className="text-2xl font-black text-amber-300 mt-1">
              {effectiveToday.operations} İşlem
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Toplam {effectiveToday.durationSeconds}s süre
            </p>
          </div>
        </div>
      </div>

      {/* BUTON GRUPLARI */}
      <div className="space-y-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
            1. Çoklu Kaynak Çekimi (8 Kurumsal Platform)
          </span>
          <div className="flex flex-wrap gap-2.5 mt-2">
            <button
              onClick={() => run("all", 50)}
              disabled={!!loading}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 px-4 py-2.5 text-xs font-bold text-slate-950 transition shadow-lg shadow-amber-500/20 disabled:opacity-50"
            >
              <span>🚀</span>
              <span>{loading === "all-50" ? "8 Kaynak Taranıyor..." : "+ 8 Kaynaktan Yeni İlan Çek"}</span>
            </button>

            <button
              onClick={() => run("all", 20, "price-refresh")}
              disabled={!!loading}
              className="flex items-center gap-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 px-3.5 py-2.5 text-xs font-bold text-sky-300 transition disabled:opacity-50"
            >
              <span>⚡</span>
              <span>{loading === "price-refresh-20" ? "Senkronlanıyor..." : "Fiyatları Eşitle & Doğrula"}</span>
            </button>

            <button
              onClick={() => run("all", 20, "rare-model")}
              disabled={!!loading}
              className="flex items-center gap-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 px-3.5 py-2.5 text-xs font-bold text-purple-300 transition disabled:opacity-50"
              title="Veritabanında az ilanı olan modelleri tespit edip çeker (Yapay zeka fiyat tahminini güçlendirir)"
            >
              <span>🧠</span>
              <span>{loading === "rare-model-20" ? "Modeller Çekiliyor..." : "Nadir Modelleri Doldur (AI)"}</span>
            </button>

            <button
              onClick={() => run("arabam", 25, "enrich-arabam")}
              disabled={!!loading}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 px-3.5 py-2.5 text-xs font-bold text-emerald-300 transition disabled:opacity-50"
              title="Mevcut ilanların tüm HD fotoğraflarını, satıcı açıklamasını ve hasar matrisini çeker"
            >
              <span>📸</span>
              <span>{loading === "enrich-arabam-25" ? "Zenginleştiriliyor..." : "Galeri & Detay Zenginleştir (25)"}</span>
            </button>
          </div>
        </div>

        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            2. Tekil Kurumsal Kaynaklar (8 Platform)
          </span>
          <div className="flex flex-wrap gap-2 mt-2">
            <button
              onClick={() => run("otokoc", 30)}
              disabled={!!loading}
              className="rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 px-3 py-1.5 text-xs font-semibold text-indigo-300 transition disabled:opacity-50"
            >
              {loading === "otokoc-30" ? "Taranıyor..." : "Otokoç 2. El (Koç)"}
            </button>
            <button
              onClick={() => run("dod", 25)}
              disabled={!!loading}
              className="rounded-lg bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 px-3 py-1.5 text-xs font-semibold text-blue-300 transition disabled:opacity-50"
            >
              {loading === "dod-25" ? "Taranıyor..." : "DOD (Doğuş)"}
            </button>
            <button
              onClick={() => run("ikinciyeni", 25)}
              disabled={!!loading}
              className="rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition disabled:opacity-50"
            >
              {loading === "ikinciyeni-25" ? "Taranıyor..." : "İkinciyeni (Anadolu)"}
            </button>
            <button
              onClick={() => run("vavacars", 30)}
              disabled={!!loading}
              className="rounded-lg bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 px-3 py-1.5 text-xs font-semibold text-purple-300 transition disabled:opacity-50"
            >
              {loading === "vavacars-30" ? "Taranıyor..." : "VavaCars"}
            </button>
            <button
              onClick={() => run("otoplus", 30)}
              disabled={!!loading}
              className="rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 px-3 py-1.5 text-xs font-semibold text-rose-300 transition disabled:opacity-50"
            >
              {loading === "otoplus-30" ? "Taranıyor..." : "Otoplus"}
            </button>
            <button
              onClick={() => run("otomerkezi", 30)}
              disabled={!!loading}
              className="rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 px-3 py-1.5 text-xs font-semibold text-sky-300 transition disabled:opacity-50"
            >
              {loading === "otomerkezi-30" ? "Taranıyor..." : "Otomerkezi"}
            </button>
            <button
              onClick={() => run("carvak", 20)}
              disabled={!!loading}
              className="rounded-lg bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 px-3 py-1.5 text-xs font-semibold text-teal-300 transition disabled:opacity-50"
            >
              {loading === "carvak-20" ? "Taranıyor..." : "Carvak"}
            </button>
            <button
              onClick={() => run("arabam", 20)}
              disabled={!!loading}
              className="rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 transition disabled:opacity-50"
            >
              {loading === "arabam-20" ? "Taranıyor..." : "Arabam.com"}
            </button>
          </div>
        </div>
      </div>

      {message && (
        <div className="rounded-xl bg-emerald-950/40 border border-emerald-500/30 p-3 text-xs text-emerald-300 font-medium animate-fade-in">
          ✅ {message}
        </div>
      )}
      {error && (
        <div className="rounded-xl bg-rose-950/40 border border-rose-500/30 p-3 text-xs text-rose-300 font-medium animate-fade-in">
          ❌ {error}
        </div>
      )}

      {/* MANUEL DENETİM & GEÇMİŞ TABLOSU */}
      <div className="border-t border-white/10 pt-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <span>📋</span>
            <span>Manuel Tarama Denetim Kayıtları (Kim, Ne Zaman, Hangi Kaynaktan)</span>
          </h4>

          {/* Tarih Filtreleme Sekmeleri */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-white/10 rounded-lg p-1 text-xs flex-wrap">
            <button
              onClick={() => setDateFilter("all")}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                dateFilter === "all"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Tümü ({logs.length})
            </button>
            <button
              onClick={() => setDateFilter("today")}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                dateFilter === "today"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Bugün ({todayCount})
            </button>
            <button
              onClick={() => setDateFilter("yesterday")}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                dateFilter === "yesterday"
                  ? "bg-sky-500/20 text-sky-300 border border-sky-500/30 font-bold"
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
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-xs text-slate-500">
            {dateFilter === "today"
              ? "Bugün henüz manuel bir tarama işlemi yapılmadı. Yukarıdaki butonlardan birine tıkladığında anında kaydı buraya düşer."
              : dateFilter === "yesterday"
              ? "Dün için kayıtlı manuel tarama denetim kaydı bulunamadı."
              : dateFilter === "custom" && formattedCustomDate
              ? `${formattedCustomDate} tarihinde manuel tarama kaydı bulunamadı.`
              : "Seçili filtreye uygun manuel tarama kaydı bulunamadı."}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-900/40">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-white/5 text-[11px] uppercase tracking-wider text-slate-400 border-b border-white/10">
                <tr>
                  <th className="py-2.5 px-3">Tarih & Saat</th>
                  <th className="py-2.5 px-3">Yönetici / Aktör</th>
                  <th className="py-2.5 px-3">İşlem Başlığı</th>
                  <th className="py-2.5 px-3">Taranan Kaynaklar</th>
                  <th className="py-2.5 px-3 text-right">Taranan</th>
                  <th className="py-2.5 px-3 text-right">Yeni İlan</th>
                  <th className="py-2.5 px-3 text-right">Güncellenen</th>
                  <th className="py-2.5 px-3 text-right">Kaldırılan</th>
                  <th className="py-2.5 px-3 text-right">Süre</th>
                  <th className="py-2.5 px-3 text-center">İncele</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredLogs.map((log) => {
                  const dateObj = new Date(log.createdAt);
                  const dateStr = dateObj.toLocaleDateString("tr-TR");
                  const timeStr = dateObj.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

                  // Aktör stili (Yönetici vs Terminal vs Web vs Mobil)
                  const isManager = log.actor.toLowerCase().includes("yönetici") || log.actor.toLowerCase() === "admin";
                  const isTerminal = log.actor.toLowerCase().includes("terminal");
                  const isWeb = log.actor.toLowerCase().includes("web");
                  const isMobile = log.actor.toLowerCase().includes("mobil");

                  // Kaynak etiketleri (bySource varsa ya da source'a göre)
                  const sourceKeys = log.bySource
                    ? Object.keys(log.bySource)
                    : log.source === "all"
                    ? ["8 Kaynak"]
                    : [log.source];

                  return (
                    <tr
                      key={log._id}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-white/[0.06] transition cursor-pointer group"
                      title="Detayları, kaynak dağılımını ve çekilen örnek araçları görmek için tıkla"
                    >
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-400 font-mono">
                        <span className="text-white font-medium">{dateStr}</span>{" "}
                        <span className="text-slate-400">{timeStr}</span>
                      </td>

                      <td className="py-2.5 px-3">
                        <span
                          className={`rounded px-2 py-0.5 text-[11px] font-semibold border ${
                            isManager
                              ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                              : isTerminal
                              ? "bg-purple-500/15 text-purple-300 border-purple-500/30"
                              : isWeb
                              ? "bg-sky-500/15 text-sky-300 border-sky-500/30"
                              : isMobile
                              ? "bg-teal-500/15 text-teal-300 border-teal-500/30"
                              : "bg-white/5 text-slate-300 border-white/10"
                          }`}
                        >
                          {log.actor}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-slate-300">
                        <span className="font-semibold text-white group-hover:text-amber-300 transition">
                          {log.label}
                        </span>
                      </td>

                      {/* Kaynak Dağılımı Çipleri */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1 flex-wrap">
                          {sourceKeys.some((k) => k.startsWith("Tur")) ? (
                            <span className="rounded bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 text-[10px] text-purple-300 font-bold">
                              🔄 {sourceKeys.length} Tur ({log.deleted > 0 ? `-${log.deleted} Ölü` : `${log.updated} Canlı`})
                            </span>
                          ) : sourceKeys.length === 0 || log.source === "all" ? (
                            <span className="rounded bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-300 font-medium">
                              8 Kurumsal Platform
                            </span>
                          ) : (
                            sourceKeys.map((k) => (
                              <span
                                key={k}
                                className="rounded bg-white/5 border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-300 font-medium"
                              >
                                {k.toUpperCase()}
                              </span>
                            ))
                          )}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-white">
                        {log.scanned.toLocaleString("tr-TR")}
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                        {log.inserted > 0 ? `+${log.inserted}` : "0"}
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono font-bold text-sky-400">
                        {log.updated > 0 ? log.updated : "0"}
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-400">
                        {log.deleted > 0 ? `-${log.deleted}` : "0"}
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono text-slate-400">
                        {log.durationSeconds > 0 ? `${log.durationSeconds}s` : "<1s"}
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        <span className="rounded bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[11px] font-bold text-amber-300 group-hover:bg-amber-500 group-hover:text-slate-950 transition">
                          İncele ➔
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DETAY MODALI */}
      {selectedLog && (
        <ManualDetailModal
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
        />
      )}
    </div>
  );
}
