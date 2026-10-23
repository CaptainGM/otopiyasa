"use client";

import { useEffect, useState, useMemo } from "react";
import { SourceBadge } from "@/components/SourceBadge";
import { formatPrice } from "@/lib/utils";

export interface ManualScrapeItem {
  _id: string;
  actor: string;
  source: string;
  label: string;
  scanned: number;
  inserted: number;
  updated: number;
  deleted: number;
  durationSeconds: number;
  status: "success" | "partial" | "error";
  message?: string;
  bySource?: Record<
    string,
    {
      fetched?: number;
      saved?: number;
      scanned?: number;
      inserted?: number;
      updated?: number;
      deleted?: number;
      items?: any[];
    }
  >;
  sampleVehicles?: Array<{
    _id?: string;
    brand: string;
    model: string;
    year: number;
    price: number;
    source: string;
    title?: string;
    imageUrl?: string;
    listingUrl?: string;
    reason?: string;
    round?: string;
    status?: string;
    action?: "inserted" | "updated" | "deleted";
  }>;
  createdAt: string;
}

interface ManualDetailModalProps {
  log: ManualScrapeItem | null;
  onClose: () => void;
}

const SOURCE_NAMES: Record<string, { label: string; bg: string; border: string; text: string }> = {
  otokoc: { label: "Otokoç 2. El (Koç)", bg: "bg-indigo-500/15", border: "border-indigo-500/30", text: "text-indigo-300" },
  dod: { label: "DOD (Doğuş)", bg: "bg-blue-500/15", border: "border-blue-500/30", text: "text-blue-300" },
  ikinciyeni: { label: "İkinciyeni (Anadolu)", bg: "bg-emerald-500/15", border: "border-emerald-500/30", text: "text-emerald-300" },
  vavacars: { label: "VavaCars", bg: "bg-purple-500/15", border: "border-purple-500/30", text: "text-purple-300" },
  otoplus: { label: "Otoplus", bg: "bg-rose-500/15", border: "border-rose-500/30", text: "text-rose-300" },
  otomerkezi: { label: "Otomerkezi", bg: "bg-sky-500/15", border: "border-sky-500/30", text: "text-sky-300" },
  carvak: { label: "Carvak", bg: "bg-teal-500/15", border: "border-teal-500/30", text: "text-teal-300" },
  arabam: { label: "Arabam.com", bg: "bg-amber-500/15", border: "border-amber-500/30", text: "text-amber-300" },
  sahibinden: { label: "Sahibinden", bg: "bg-yellow-500/15", border: "border-yellow-500/30", text: "text-yellow-300" },
};

export function ManualDetailModal({ log, onClose }: ManualDetailModalProps) {
  const [inspectingTur, setInspectingTur] = useState<{
    name: string;
    stats: any;
    cars: any[];
  } | null>(null);
  const [inspectedCar, setInspectedCar] = useState<any | null>(null);
  const [actionFilter, setActionFilter] = useState<"all" | "inserted" | "updated" | "deleted">("all");
  const [turFilter, setTurFilter] = useState<"all" | "has_dead" | "all_live">("all");
  const [turSearch, setTurSearch] = useState<string>("");
  const [visibleCount, setVisibleCount] = useState<number>(48);
  const [carSearch, setCarSearch] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [dynamicVehicles, setDynamicVehicles] = useState<any[] | null>(null);
  const [loadingVehicles, setLoadingVehicles] = useState<boolean>(false);
  const CARS_PER_PAGE = 24;

  useEffect(() => {
    if (!log?._id) return;
    const logId = log._id;
    setDynamicVehicles(null);
    let isCancelled = false;

    async function fetchFullVehicles() {
      try {
        setLoadingVehicles(true);
        const res = await fetch(`/api/admin/manual-scrapes/${logId}/vehicles`);
        if (res.ok) {
          const data = await res.json();
          if (!isCancelled && Array.isArray(data.vehicles) && data.vehicles.length > 0) {
            setDynamicVehicles(data.vehicles);
          }
        }
      } catch {
        // sessiz yut
      } finally {
        if (!isCancelled) setLoadingVehicles(false);
      }
    }

    fetchFullVehicles();
    return () => {
      isCancelled = true;
    };
  }, [log?._id]);

  useEffect(() => {
    if (!log) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (inspectedCar) {
          setInspectedCar(null);
        } else if (inspectingTur) {
          setInspectingTur(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [log, inspectedCar, inspectingTur, onClose]);

  const dateObj = useMemo(() => (log ? new Date(log.createdAt) : new Date()), [log]);
  const dateStr = useMemo(() => dateObj.toLocaleDateString("tr-TR"), [dateObj]);
  const timeStr = useMemo(() => dateObj.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }), [dateObj]);

  const bySourceEntries = useMemo(() => {
    if (!log?.bySource) return [];
    return Object.entries(log.bySource).sort(([a], [b]) => {
      const numA = parseInt(a.replace(/\D/g, ""), 10);
      const numB = parseInt(b.replace(/\D/g, ""), 10);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      return a.localeCompare(b);
    });
  }, [log?.bySource]);

  const allVehicles = useMemo(() => dynamicVehicles || log?.sampleVehicles || [], [dynamicVehicles, log?.sampleVehicles]);
  const isTurScrape = useMemo(() => bySourceEntries.some(([k]) => k.startsWith("Tur")), [bySourceEntries]);

  const getCarAction = (car: any): "inserted" | "updated" | "deleted" => {
    if (car.action) return car.action;
    if (car.status === "removed" || car.reason) return "deleted";
    if (log && log.updated > 0 && log.inserted === 0) return "updated";
    if (log?.label && (log.label.toLowerCase().includes("zenginleştir") || log.label.toLowerCase().includes("güncelle"))) return "updated";
    if (log && log.deleted > 0 && log.inserted === 0 && log.updated === 0) return "deleted";
    return "inserted";
  };

  const actionCounts = useMemo(() => {
    let inserted = 0;
    let updated = 0;
    let deleted = 0;
    for (const car of allVehicles) {
      const act = getCarAction(car);
      if (act === "inserted") inserted++;
      else if (act === "updated") updated++;
      else if (act === "deleted") deleted++;
    }
    return { inserted, updated, deleted };
  }, [allVehicles, log]);

  const filteredVehicles = useMemo(() => {
    let list = allVehicles;
    if (actionFilter !== "all") {
      list = list.filter((c) => getCarAction(c) === actionFilter);
    }
    const q = carSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((c) => {
        const text = `${c.brand || ""} ${c.model || ""} ${c.title || ""}`.toLowerCase();
        return text.includes(q);
      });
    }
    return list;
  }, [allVehicles, actionFilter, carSearch, log]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredVehicles.length / CARS_PER_PAGE));
  }, [filteredVehicles.length]);

  const validCurrentPage = useMemo(() => {
    return Math.min(Math.max(1, currentPage), totalPages);
  }, [currentPage, totalPages]);

  const paginatedVehicles = useMemo(() => {
    const start = (validCurrentPage - 1) * CARS_PER_PAGE;
    return filteredVehicles.slice(start, start + CARS_PER_PAGE);
  }, [filteredVehicles, validCurrentPage]);

  // O(1) Pre-index Map: 3.036 aracı bir defa haritalar.
  // Render sırasında her tur için 3000 elemanlık filter dönmesini engeller.
  const carsByRound = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const car of allVehicles) {
      const r = car.round || "Tur #1";
      const list = map.get(r);
      if (list) list.push(car);
      else map.set(r, [car]);
    }
    return map;
  }, [allVehicles]);

  const { deadCount, liveCount } = useMemo(() => {
    let dead = 0;
    let live = 0;
    for (const [_, stats] of bySourceEntries as [string, any][]) {
      const del = stats.deleted ?? stats.fetched ?? 0;
      if (del > 0) dead++;
      else live++;
    }
    return { deadCount: dead, liveCount: live };
  }, [bySourceEntries]);

  const filteredRounds = useMemo(() => {
    if (!isTurScrape) return bySourceEntries;
    const s = turSearch.trim().toLowerCase();
    return bySourceEntries.filter(([srcKey, stats]: [string, any]) => {
      const roundDeleted = stats.deleted ?? stats.fetched ?? 0;
      if (turFilter === "has_dead" && roundDeleted === 0) return false;
      if (turFilter === "all_live" && roundDeleted > 0) return false;
      if (s && !srcKey.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [bySourceEntries, isTurScrape, turFilter, turSearch]);

  const getCarsForRound = (roundKey: string, stats: any): any[] => {
    if (Array.isArray(stats?.items) && stats.items.length > 0) {
      return stats.items;
    }
    return carsByRound.get(roundKey) || [];
  };

  if (!log) return null;

  const speedPerSec =
    log.durationSeconds > 0 && log.scanned > 0
      ? (log.scanned / log.durationSeconds).toFixed(1)
      : null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 animate-fade-in">
        <div
          className="relative w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl border border-white/10 bg-slate-950 shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Üst Başlık Barı */}
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 bg-slate-900/80">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="flex h-3 w-3 rounded-full bg-amber-500 animate-pulse" />
                <h3 className="text-lg font-bold text-white">
                  {log.label || "Manuel Tarama Raporu"}
                </h3>
                <span className="rounded bg-white/10 border border-white/15 px-2 py-0.5 text-xs text-slate-300 font-mono">
                  {dateStr} {timeStr}
                </span>
                <span
                  className={`rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                    log.status === "success"
                      ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                      : log.status === "partial"
                      ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                      : "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                  }`}
                >
                  {log.status === "success" ? "Başarılı" : log.status === "partial" ? "Kısmi Başarı" : "Hata"}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Aktör: <strong className="text-amber-300">{log.actor}</strong> • Kaynak: <span className="text-slate-200">{log.source.toUpperCase()}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white transition text-base"
              aria-label="Kapat"
            >
              ✕
            </button>
          </div>

          {/* İçerik Alanı (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {/* 4 Ana Metrik Kartı */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-slate-900/80 border border-white/5 p-3.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Taranan İlan</p>
                <p className="text-2xl font-black text-white mt-1">{log.scanned.toLocaleString("tr-TR")}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Kontrol edilen toplam</p>
              </div>

              {log.deleted > 0 ? (
                <div className="rounded-xl bg-slate-900/80 border border-rose-500/30 p-3.5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-rose-400">Arşive Kaldırılan (Ölü)</p>
                  <p className="text-2xl font-black text-rose-400 mt-1">-{log.deleted.toLocaleString("tr-TR")}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Yayından kalkan ilanlar</p>
                </div>
              ) : (
                <div className="rounded-xl bg-slate-900/80 border border-white/5 p-3.5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">Yeni Eklenen</p>
                  <p className="text-2xl font-black text-emerald-400 mt-1">+{log.inserted.toLocaleString("tr-TR")}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">İlk kez veritabanına giren</p>
                </div>
              )}

              <div className="rounded-xl bg-slate-900/80 border border-white/5 p-3.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-sky-400">
                  {log.deleted > 0 ? "Doğrulanan (Canlı)" : "Güncellenen"}
                </p>
                <p className="text-2xl font-black text-sky-400 mt-1">{log.updated.toLocaleString("tr-TR")}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {log.deleted > 0 ? "Yayında olan aktif araçlar" : "Fiyat & bilgi eşitlenen"}
                </p>
              </div>

              <div className="rounded-xl bg-slate-900/80 border border-white/5 p-3.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-purple-400">Süre & Hız</p>
                <p className="text-2xl font-black text-purple-300 mt-1">{log.durationSeconds}s</p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {speedPerSec ? `~${speedPerSec} ilan / sn` : "Hızlı işlem"}
                </p>
              </div>
            </div>

            {/* Mesaj / Sistem Notu Varsa */}
            {log.message && (
              <div className="rounded-xl bg-white/[0.04] border border-white/10 p-3.5 text-xs text-slate-300 flex items-start gap-2.5">
                <span className="text-base">ℹ️</span>
                <div>
                  <p className="font-semibold text-white">Sistem Raporu / Yanıt Mesajı:</p>
                  <p className="text-slate-400 mt-0.5">{log.message}</p>
                </div>
              </div>
            )}

            {/* 1. Bölüm: Tur Bazlı veya Kaynak Bazlı Görünüm */}
            <div>
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <span>{isTurScrape ? "🔄" : "🌐"}</span>
                  <span>
                    {isTurScrape
                      ? `Tur Bazlı İlerleme ve Süpürme Geçmişi (${bySourceEntries.length} Tur)`
                      : "Kaynak Bazlı Tarama & Kayıt Detayı"}
                  </span>
                </h4>

                {isTurScrape && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Hızlı Filtre Butonları */}
                    <div className="flex items-center rounded-lg bg-white/5 p-1 border border-white/10 text-xs">
                      <button
                        onClick={() => {
                          setTurFilter("all");
                          setVisibleCount(48);
                        }}
                        className={`rounded px-2.5 py-1 font-semibold transition cursor-pointer ${
                          turFilter === "all"
                            ? "bg-purple-600 text-white shadow"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        Tümü ({bySourceEntries.length})
                      </button>
                      <button
                        onClick={() => {
                          setTurFilter("has_dead");
                          setVisibleCount(48);
                        }}
                        className={`rounded px-2.5 py-1 font-semibold transition cursor-pointer ${
                          turFilter === "has_dead"
                            ? "bg-rose-600 text-white shadow"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        🚫 Ölü İlanlı ({deadCount})
                      </button>
                      <button
                        onClick={() => {
                          setTurFilter("all_live");
                          setVisibleCount(48);
                        }}
                        className={`rounded px-2.5 py-1 font-semibold transition cursor-pointer ${
                          turFilter === "all_live"
                            ? "bg-emerald-600 text-white shadow"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        🟢 Tamamı Canlı ({liveCount})
                      </button>
                    </div>

                    {/* Tur No Arama Kutusu */}
                    <input
                      type="text"
                      placeholder="Tur ara (örn: 5)..."
                      value={turSearch}
                      onChange={(e) => {
                        setTurSearch(e.target.value);
                        setVisibleCount(48);
                      }}
                      className="rounded-lg bg-slate-900 border border-white/10 px-3 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 w-36"
                    />
                  </div>
                )}
              </div>

              {bySourceEntries.length === 0 ? (
                <div className="rounded-xl bg-white/[0.02] border border-white/5 p-4 text-xs text-slate-400">
                  Bu işlem tek bir kaynak üzerinden gerçekleştirildi veya tur kırılımı kaydı bulunmuyor.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[58vh] overflow-y-auto pr-1">
                    {filteredRounds.slice(0, visibleCount).map(([srcKey, stats]: [string, any]) => {
                      const isTur = srcKey.startsWith("Tur");

                      if (isTur) {
                        const roundDeleted = stats.deleted ?? stats.fetched ?? 0;
                        const roundActive = stats.updated ?? stats.saved ?? 0;
                        const roundScanned = stats.scanned ?? roundDeleted + roundActive;

                        return (
                          <div
                            key={srcKey}
                            style={{ contentVisibility: "auto" }}
                            className="rounded-xl p-3.5 flex flex-col justify-between border bg-purple-950/20 border-purple-500/30 hover:border-purple-400/80 hover:bg-purple-900/30 shadow-sm"
                          >
                            <div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-purple-200 flex items-center gap-1.5">
                                  <span>🔄</span>
                                  <span>{srcKey}</span>
                                </span>
                                {roundDeleted > 0 ? (
                                  <span className="rounded bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[10px] font-bold px-1.5 py-0.5">
                                    -{roundDeleted} Ölü
                                  </span>
                                ) : (
                                  <span className="rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold px-1.5 py-0.5">
                                    🟢 Canlı
                                  </span>
                                )}
                              </div>

                              <div className="mt-3 space-y-1 text-xs">
                                <div className="flex items-baseline justify-between">
                                  <span className="text-slate-400">Taranan:</span>
                                  <span className="font-bold text-white">{roundScanned}</span>
                                </div>
                                <div className="flex items-baseline justify-between">
                                  <span className="text-slate-400">🟢 Canlı:</span>
                                  <span className="font-bold text-emerald-400">+{roundActive}</span>
                                </div>
                                <div className="flex items-baseline justify-between">
                                  <span className="text-slate-400">🚫 Arşive Giden:</span>
                                  <span className="font-bold text-rose-400">-{roundDeleted}</span>
                                </div>
                              </div>
                            </div>

                            {/* Tura Özel İncele Butonu */}
                            <button
                              onClick={() => {
                                const cars = getCarsForRound(srcKey, stats);
                                setInspectingTur({
                                  name: srcKey,
                                  stats,
                                  cars,
                                });
                              }}
                              className={`w-full mt-3 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                                roundDeleted > 0
                                  ? "bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 shadow-sm"
                                  : "bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10"
                              }`}
                            >
                              <span>{roundDeleted > 0 ? `🚫 ${roundDeleted} Ölü İlanı İncele` : "İncele"}</span>
                              <span>➔</span>
                            </button>
                          </div>
                        );
                      }

                      const meta = SOURCE_NAMES[srcKey.toLowerCase()] || {
                        label: srcKey.toUpperCase(),
                        bg: "bg-white/5",
                        border: "border-white/10",
                        text: "text-slate-300",
                      };
                      return (
                        <div
                          key={srcKey}
                          className={`rounded-xl ${meta.bg} border ${meta.border} p-3.5 flex flex-col justify-between`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`text-xs font-bold ${meta.text}`}>{meta.label}</span>
                            <SourceBadge source={srcKey as any} />
                          </div>
                          <div className="mt-3 flex items-baseline justify-between text-xs">
                            <span className="text-slate-400">Çekilen:</span>
                            <span className="font-bold text-white">{stats.fetched ?? stats.scanned ?? 0}</span>
                          </div>
                          <div className="mt-1 flex items-baseline justify-between text-xs">
                            <span className="text-slate-400">Kaydedilen:</span>
                            <span className="font-bold text-emerald-400">+{stats.saved ?? stats.inserted ?? 0}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Daha Fazla Göster Butonu */}
                  {isTurScrape && filteredRounds.length > visibleCount && (
                    <div className="flex justify-center pt-2">
                      <button
                        onClick={() => setVisibleCount((prev) => prev + 48)}
                        className="rounded-xl bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/30 text-purple-200 px-5 py-2 text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-sm"
                      >
                        <span>⬇️</span>
                        <span>
                          Daha Fazla Tur Göster ({visibleCount} / {filteredRounds.length} gösteriliyor - Kalan{" "}
                          {filteredRounds.length - visibleCount})
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>


            {/* Bilgi Kutusu veya Standart Taramalar İçin Örnek Araç Listesi */}
            {isTurScrape ? (
              <div className="rounded-xl bg-purple-950/25 border border-purple-500/20 p-4 text-xs text-slate-300 flex items-start gap-3">
                <span className="text-xl">⚡</span>
                <div>
                  <p className="font-bold text-white">Yüksek Hızlı & Sıfır Kasma Tur İnceleme:</p>
                  <p className="text-slate-400 mt-0.5">
                    Tarayıcının donmaması için 3.036 aracın tamamı aynı anda ekrana basılmaz.
                    Yukarıdaki listeden dilediğiniz turun üzerindeki{" "}
                    <strong className="text-rose-400">&quot;Ölü İlanı İncele ➔&quot;</strong> butonuna tıklayarak
                    yalnızca o tura ait kaldırılan araçları anında görüntüleyebilirsiniz.
                  </p>
                </div>
              </div>
            ) : (
              allVehicles.length > 0 && (
                <div className="pt-2 border-t border-white/10 space-y-3">
                  {/* Başlık, Arama ve Filtre Sekmeleri */}
                  <div className="space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span>🚗</span>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                          İşlenen Araçlar ({filteredVehicles.length} / {allVehicles.length})
                        </h4>
                        {loadingVehicles && (
                          <span className="text-[11px] text-amber-400 font-semibold animate-pulse">
                            ⏳ Veritabanından tüm liste yükleniyor...
                          </span>
                        )}
                      </div>

                      {/* Araç Arama Kutusu */}
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Marka veya model ara..."
                          value={carSearch}
                          onChange={(e) => {
                            setCarSearch(e.target.value);
                            setCurrentPage(1);
                          }}
                          className="w-full sm:w-56 rounded-lg bg-slate-900 border border-white/10 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/80 transition"
                        />
                        {carSearch && (
                          <button
                            onClick={() => {
                              setCarSearch("");
                              setCurrentPage(1);
                            }}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 4 İnteraktif Filtre Sekmesi */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        onClick={() => {
                          setActionFilter("all");
                          setCurrentPage(1);
                        }}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                          actionFilter === "all"
                            ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                            : "bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10"
                        }`}
                      >
                        <span>📋</span>
                        <span>Tümü ({allVehicles.length})</span>
                      </button>

                      <button
                        onClick={() => {
                          setActionFilter("inserted");
                          setCurrentPage(1);
                        }}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                          actionFilter === "inserted"
                            ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                            : actionCounts.inserted > 0
                            ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : "bg-white/[0.02] text-slate-500 border border-white/5"
                        }`}
                      >
                        <span>✨</span>
                        <span>Yeni Eklenenler ({actionCounts.inserted})</span>
                      </button>

                      <button
                        onClick={() => {
                          setActionFilter("updated");
                          setCurrentPage(1);
                        }}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                          actionFilter === "updated"
                            ? "bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20"
                            : actionCounts.updated > 0
                            ? "bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30"
                            : "bg-white/[0.02] text-slate-500 border border-white/5"
                        }`}
                      >
                        <span>🔄</span>
                        <span>Güncellenenler ({actionCounts.updated})</span>
                      </button>

                      <button
                        onClick={() => {
                          setActionFilter("deleted");
                          setCurrentPage(1);
                        }}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                          actionFilter === "deleted"
                            ? "bg-rose-500 text-slate-950 shadow-md shadow-rose-500/20"
                            : actionCounts.deleted > 0
                            ? "bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30"
                            : "bg-white/[0.02] text-slate-500 border border-white/5"
                        }`}
                      >
                        <span>🚫</span>
                        <span>Kaldırılanlar ({actionCounts.deleted})</span>
                      </button>
                    </div>
                  </div>

                  {/* Araç Kartları Grid */}
                  {filteredVehicles.length === 0 ? (
                    <div className="rounded-xl bg-white/[0.02] border border-white/5 p-8 text-center text-xs text-slate-400 space-y-1">
                      <p className="text-xl">🔍</p>
                      <p className="font-semibold text-white">Bu filtreye uygun araç bulunamadı.</p>
                      <p className="text-slate-500">Arama kelimesini değiştirebilir veya başka bir sekmeyi seçebilirsiniz.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {paginatedVehicles.map((car, idx) => {
                        const act = getCarAction(car);
                        const isDead = act === "deleted";
                        const isUpd = act === "updated";
                        return (
                          <div
                            key={car._id || idx}
                            onClick={() => setInspectedCar(car)}
                            className={`rounded-xl bg-slate-900/70 border p-3 flex gap-3 items-center cursor-pointer transition group shadow-sm ${
                              isDead
                                ? "border-white/10 hover:border-rose-500/50 hover:bg-slate-900"
                                : isUpd
                                ? "border-white/10 hover:border-sky-500/50 hover:bg-slate-900"
                                : "border-white/10 hover:border-emerald-500/50 hover:bg-slate-900"
                            }`}
                          >
                            {car.imageUrl ? (
                              <img
                                src={car.imageUrl}
                                alt={car.title || `${car.brand} ${car.model}`}
                                loading="lazy"
                                decoding="async"
                                className="w-16 h-14 object-cover rounded-lg bg-slate-800 shrink-0 border border-white/10 group-hover:scale-105 transition duration-200"
                              />
                            ) : (
                              <div className="w-16 h-14 rounded-lg bg-slate-800 flex items-center justify-center text-xl shrink-0 border border-white/10">
                                🚗
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1">
                                <p className="text-xs font-bold text-white truncate">{car.brand} {car.model}</p>
                                <span
                                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                    isDead
                                      ? "text-rose-300 bg-rose-500/15 border-rose-500/30"
                                      : isUpd
                                      ? "text-sky-300 bg-sky-500/15 border-sky-500/30"
                                      : "text-emerald-300 bg-emerald-500/15 border-emerald-500/30"
                                  }`}
                                >
                                  {isDead ? "🚫 Kaldırıldı" : isUpd ? "🔄 Güncellendi" : "✨ Yeni İlan"}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 truncate">{car.year > 0 ? `${car.year} Model` : car.title}</p>
                              <p className={`text-xs font-black mt-1 ${isDead ? "text-rose-400" : isUpd ? "text-sky-400" : "text-amber-400"}`}>
                                {formatPrice(car.price)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Sayfalama (Pagination) Kontrolleri */}
                  {totalPages > 1 && (
                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-white/5 text-xs">
                      <span className="text-slate-400">
                        Toplam <strong className="text-white">{filteredVehicles.length}</strong> araç •{" "}
                        Sayfa <strong className="text-amber-400">{validCurrentPage}</strong> / {totalPages}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={validCurrentPage <= 1}
                          className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none text-slate-300 transition text-xs font-semibold cursor-pointer"
                        >
                          ◀ Önceki
                        </button>

                        {/* Akıllı Sayfa Numaraları */}
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                          .filter((p) => {
                            if (totalPages <= 7) return true;
                            if (p === 1 || p === totalPages) return true;
                            if (Math.abs(p - validCurrentPage) <= 1) return true;
                            return false;
                          })
                          .map((p, idx, arr) => {
                            const prev = arr[idx - 1];
                            const showEllipsis = prev && p - prev > 1;
                            return (
                              <span key={p} className="flex items-center gap-1">
                                {showEllipsis && <span className="text-slate-600 px-1">...</span>}
                                <button
                                  onClick={() => setCurrentPage(p)}
                                  className={`w-7 h-7 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center ${
                                    p === validCurrentPage
                                      ? "bg-amber-500 text-slate-950 shadow"
                                      : "bg-white/5 hover:bg-white/10 text-slate-300"
                                  }`}
                                >
                                  {p}
                                </button>
                              </span>
                            );
                          })}

                        <button
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          disabled={validCurrentPage >= totalPages}
                          className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none text-slate-300 transition text-xs font-semibold cursor-pointer"
                        >
                          Sonraki ▶
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            )}
          </div>

          {/* Alt Kapat Barı */}
          <div className="border-t border-white/10 px-5 py-3 bg-slate-900/80 flex items-center justify-between text-xs text-slate-400">
            <span>
              Kayıt ID: <span className="font-mono text-slate-500">{log._id}</span> • Toplam Kayıtlı Araç:{" "}
              <strong className="text-white">{allVehicles.length}</strong>
              {actionCounts.inserted > 0 && <span className="text-emerald-400 ml-2">+{actionCounts.inserted} Yeni</span>}
              {actionCounts.updated > 0 && <span className="text-sky-400 ml-2">~{actionCounts.updated} Güncel</span>}
              {actionCounts.deleted > 0 && <span className="text-rose-400 ml-2">-{actionCounts.deleted} Kaldırılan</span>}
            </span>
            <button
              onClick={onClose}
              className="rounded-lg bg-white/10 hover:bg-white/15 px-4 py-1.5 font-semibold text-white transition cursor-pointer"
            >
              Kapat
            </button>
          </div>
        </div>
      </div>

      {/* SEÇİLİ TURUN ÖLÜ İLANLARINI İNCELEME MODALI */}
      {inspectingTur && (
        <div
          className="fixed inset-0 z-[55] flex items-center justify-center p-3 sm:p-5 bg-black/85 animate-fade-in"
          onClick={() => setInspectingTur(null)}
        >
          <div
            className="relative w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl border border-purple-500/40 bg-slate-950 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 bg-slate-900/90">
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => setInspectingTur(null)}
                  className="rounded-lg bg-white/10 hover:bg-white/15 px-3 py-1.5 text-xs font-semibold text-white transition flex items-center gap-1.5 cursor-pointer"
                >
                  <span>←</span>
                  <span>Tüm Turlara Dön</span>
                </button>
                <div className="flex items-center gap-2">
                  <span className="flex h-2.5 w-2.5 rounded-full bg-purple-400" />
                  <h3 className="text-base font-bold text-white">
                    {inspectingTur.name} - Kaldırılan Ölü İlanlar
                  </h3>
                  <span className="rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 px-2 py-0.5 text-xs font-bold">
                    {inspectingTur.cars.length} Araç
                  </span>
                </div>
              </div>
              <button
                onClick={() => setInspectingTur(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-white/10 text-base transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Tur Özeti Şeridi */}
            <div className="px-5 py-2.5 bg-purple-950/30 border-b border-white/5 flex items-center justify-between text-xs text-slate-300 flex-wrap gap-2">
              <div className="flex items-center gap-4">
                <span>Taranan İlan: <strong className="text-white">{inspectingTur.stats.scanned || 100}</strong></span>
                <span>🟢 Doğrulanan Canlı: <strong className="text-emerald-400">+{inspectingTur.stats.updated ?? inspectingTur.stats.saved ?? 0}</strong></span>
                <span>🚫 Arşive Taşınan: <strong className="text-rose-400">-{inspectingTur.cars.length}</strong></span>
              </div>
              <span className="text-[11px] text-slate-400">
                Araca tıklayarak detaylı arşiv ve orijinal ilan linkine gidebilirsiniz.
              </span>
            </div>

            {/* Araç Kartları Grid */}
            <div className="flex-1 overflow-y-auto p-5">
              {inspectingTur.cars.length === 0 ? (
                <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-12 text-center text-xs text-slate-400 space-y-2">
                  <div className="text-3xl">🟢</div>
                  <p className="font-semibold text-white text-sm">Bu Turda Kaldırılan Ölü İlan Yok</p>
                  <p>Bu 100 ilanlık partideki tüm araçların sitede canlı ve yayında olduğu doğrulandı.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {inspectingTur.cars.map((car: any, idx: number) => (
                    <div
                      key={car._id || idx}
                      onClick={() => setInspectedCar(car)}
                      className="rounded-xl bg-slate-900/80 border border-white/10 hover:border-rose-500/50 hover:bg-slate-900 p-3 flex gap-3 items-center cursor-pointer transition group shadow-sm hover:shadow-rose-950/30"
                    >
                      {car.imageUrl ? (
                        <img
                          src={car.imageUrl}
                          alt={car.title || `${car.brand} ${car.model}`}
                          loading="lazy"
                          decoding="async"
                          className="w-16 h-14 object-cover rounded-lg bg-slate-800 shrink-0 border border-white/10 group-hover:border-rose-500/40 transition"
                        />
                      ) : (
                        <div className="w-16 h-14 rounded-lg bg-slate-800 flex items-center justify-center text-xl shrink-0 border border-white/10">
                          🚗
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-xs font-bold text-white truncate group-hover:text-amber-300 transition">
                            {car.brand} {car.model}
                          </p>
                          <SourceBadge source={car.source as any} />
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                          {car.year > 0 ? `${car.year} Model` : car.title || "İlan"}
                        </p>
                        <div className="mt-1 flex items-center justify-between">
                          <span className="text-xs font-black text-rose-400">
                            {formatPrice(car.price)}
                          </span>
                          <span className="text-[10px] font-bold text-rose-300 bg-rose-500/15 border border-rose-500/30 rounded px-1.5 py-0.5">
                            🚫 Ölü İlan
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Alt Bar */}
            <div className="border-t border-white/10 px-5 py-3 bg-slate-900/80 flex items-center justify-between text-xs text-slate-400">
              <span>{inspectingTur.name} içerisinde toplam {inspectingTur.cars.length} araç listeleniyor.</span>
              <button
                onClick={() => setInspectingTur(null)}
                className="rounded-lg bg-white/10 hover:bg-white/15 px-4 py-1.5 font-semibold text-white transition cursor-pointer"
              >
                Geri Dön
              </button>
            </div>
          </div>
        </div>
      )}

      {/* İNCELENEN ARAÇ DETAY POPUP MODALI */}
      {inspectedCar && (() => {
        const act = getCarAction(inspectedCar);
        const isDead = act === "deleted";
        const isUpd = act === "updated";
        return (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 animate-fade-in"
            onClick={() => setInspectedCar(null)}
          >
            <div
              className={`relative w-full max-w-lg rounded-2xl border bg-slate-950 p-6 shadow-2xl space-y-4 ${
                isDead ? "border-rose-500/30" : isUpd ? "border-sky-500/40" : "border-emerald-500/40"
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Araç Başlığı */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded text-[11px] font-black px-2 py-0.5 border ${
                        isDead
                          ? "bg-rose-500/20 border-rose-500/40 text-rose-300"
                          : isUpd
                          ? "bg-sky-500/20 border-sky-500/40 text-sky-300"
                          : "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                      }`}
                    >
                      {isDead
                        ? "🚫 PİYASA ARŞİVİNE KALDIRILDI"
                        : isUpd
                        ? "🔄 BİLGİ & GALERİ GÜNCELLENDİ"
                        : "🟢 VERİTABANINDA AKTİF & CANLI İLAN"}
                    </span>
                    <SourceBadge source={inspectedCar.source as any} />
                    {inspectedCar.round && (
                      <span className="rounded bg-purple-500/20 border border-purple-500/30 text-purple-300 text-[11px] font-bold px-1.5 py-0.5">
                        {inspectedCar.round}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-white mt-2">
                    {inspectedCar.title || `${inspectedCar.brand} ${inspectedCar.model}`}
                  </h3>
                </div>
                <button
                  onClick={() => setInspectedCar(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-white/10 text-lg transition cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Fotoğraf */}
              {inspectedCar.imageUrl ? (
                <div className="w-full h-56 rounded-xl overflow-hidden bg-slate-900 border border-white/10 relative">
                  <img
                    src={inspectedCar.imageUrl}
                    alt={inspectedCar.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-full h-40 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-center text-4xl">
                  🚗
                </div>
              )}

              {/* Bilgi Kutuları */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-lg bg-slate-900 border border-white/10 p-2.5">
                  <p className="text-[11px] text-slate-400">Fiyat</p>
                  <p className={`text-sm sm:text-base font-black mt-0.5 truncate ${isDead ? "text-rose-400" : isUpd ? "text-sky-400" : "text-amber-400"}`}>
                    {formatPrice(inspectedCar.price)}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-900 border border-white/10 p-2.5">
                  <p className="text-[11px] text-slate-400">Model Yılı</p>
                  <p className="text-sm sm:text-base font-bold text-white mt-0.5">{inspectedCar.year || "-"}</p>
                </div>
                <div className="rounded-lg bg-slate-900 border border-white/10 p-2.5">
                  <p className="text-[11px] text-slate-400">Galeri</p>
                  <p className="text-sm sm:text-base font-bold text-sky-400 mt-0.5">
                    {inspectedCar.imagesCount ? `📸 ${inspectedCar.imagesCount} HD` : "📸 1 Foto"}
                  </p>
                </div>
              </div>

              {/* Teknik Özellikler Özeti (Varsa) */}
              {inspectedCar.specs && (
                <div className="rounded-lg bg-slate-900/60 border border-white/10 px-3 py-1.5 text-[11px] text-slate-300 flex items-center gap-2">
                  <span>⚙️</span>
                  <span className="font-medium text-slate-200">{inspectedCar.specs}</span>
                </div>
              )}

              {/* Durum / Açıklama Kutusu */}
              {isDead ? (
                <div className="rounded-xl bg-rose-950/30 border border-rose-500/30 p-3 text-xs">
                  <p className="font-semibold text-rose-300 flex items-center gap-1.5">
                    <span>⚠️</span>
                    <span>Arşivleme / Yayından Kalkma Nedeni:</span>
                  </p>
                  <p className="text-slate-300 mt-1">
                    {inspectedCar.reason || "İlan yayından kaldırılmış veya arama sayfasına yönlendirilmiştir."}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Bu araç veritabanından tamamen silinmemiş, piyasa değerleme geçmişini bozmamak adına <strong>status: removed</strong> ile Piyasa Arşivi&apos;ne çekilmiştir.
                  </p>
                </div>
              ) : isUpd ? (
                <div className="rounded-xl bg-sky-950/30 border border-sky-500/30 p-3.5 text-xs space-y-2.5">
                  <p className="font-semibold text-sky-300 flex items-center gap-1.5">
                    <span>🔄</span>
                    <span>Neler Güncellendi & Zenginleştirildi?</span>
                  </p>
                  <div className="space-y-1.5">
                    {inspectedCar.changes && inspectedCar.changes.length > 0 ? (
                      inspectedCar.changes.map((ch: string, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-slate-200">
                          <span className="text-sky-400 font-bold">✓</span>
                          <span>{ch}</span>
                        </div>
                      ))
                    ) : (
                      <>
                        <div className="flex items-center gap-2 text-slate-200">
                          <span className="text-sky-400 font-bold">✓</span>
                          <span>📸 <strong>Tam Galeri:</strong> {inspectedCar.imagesCount ? `${inspectedCar.imagesCount} adet` : "15-35 adet"} yüksek çözünürlüklü HD fotoğraf eklendi</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-200">
                          <span className="text-sky-400 font-bold">✓</span>
                          <span>📝 <strong>Satıcı Açıklaması:</strong> Araç sahibinin detaylı ilan metni eşitlendi</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-200">
                          <span className="text-sky-400 font-bold">✓</span>
                          <span>🛠️ <strong>Hasar & Ekspertiz:</strong> Boyalı/değişen parça ve tramer matrisi eşitlendi</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-200">
                          <span className="text-sky-400 font-bold">✓</span>
                          <span>💰 <strong>Fiyat Doğrulaması:</strong> Güncel satış bedeli kontrol edilip aktif tutuldu</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Satıcı Açıklaması Snippet (Varsa) */}
                  {inspectedCar.descriptionSnippet && (
                    <div className="rounded-lg bg-black/40 border border-white/5 p-2.5 text-[11px] text-slate-300 space-y-0.5">
                      <p className="font-semibold text-amber-300 flex items-center gap-1">
                        <span>📝</span>
                        <span>Satıcı İlan Açıklaması:</span>
                      </p>
                      <p className="italic text-slate-400 line-clamp-3">&quot;{inspectedCar.descriptionSnippet}&quot;</p>
                    </div>
                  )}

                  {/* Hasar / Boya / Ekspertiz Durumu (Varsa) */}
                  {inspectedCar.damageSummary && inspectedCar.damageSummary !== "Belirtilmemiş" && (
                    <div className="rounded-lg bg-black/40 border border-white/5 p-2.5 text-[11px] text-slate-300 space-y-0.5">
                      <p className="font-semibold text-sky-300 flex items-center gap-1">
                        <span>🛠️</span>
                        <span>Hasar & Ekspertiz Raporu:</span>
                      </p>
                      <p className="text-slate-200 font-medium">{inspectedCar.damageSummary}</p>
                    </div>
                  )}

                  {inspectedCar.reason && (
                    <p className="text-[11px] text-slate-400 pt-1.5 border-t border-white/10 font-mono">
                      {inspectedCar.reason}
                    </p>
                  )}
                </div>
              ) : (
                <div className="rounded-xl bg-emerald-950/30 border border-emerald-500/30 p-3.5 text-xs space-y-2">
                  <p className="font-semibold text-emerald-300 flex items-center gap-1.5">
                    <span>✅</span>
                    <span>Canlı Yayında & Veritabanında Kayıtlı</span>
                  </p>
                  <p className="text-slate-300">
                    Bu araç başarıyla taranarak veritabanına eklenmiştir. Aşağıdaki butonlardan OtoPiyasa detay sayfasını veya kaynak sitedeki orijinal ilanı inceleyebilirsiniz.
                  </p>
                  {inspectedCar.descriptionSnippet && (
                    <div className="rounded-lg bg-black/40 border border-white/5 p-2.5 text-[11px] text-slate-300 space-y-0.5">
                      <p className="font-semibold text-amber-300 flex items-center gap-1">
                        <span>📝</span>
                        <span>İlan Açıklaması:</span>
                      </p>
                      <p className="italic text-slate-400 line-clamp-3">&quot;{inspectedCar.descriptionSnippet}&quot;</p>
                    </div>
                  )}
                </div>
              )}

              {/* Doğrudan Bağlantılar */}
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <a
                  href={inspectedCar._id ? `/cars/${inspectedCar._id}` : `/cars?q=${encodeURIComponent(`${inspectedCar.brand || ""} ${inspectedCar.model || ""}`.trim())}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex-1 rounded-xl text-center py-2.5 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm ${
                    isDead
                      ? "bg-amber-500 hover:bg-amber-400 text-slate-950"
                      : isUpd
                      ? "bg-sky-500 hover:bg-sky-400 text-slate-950"
                      : "bg-emerald-500 hover:bg-emerald-400 text-slate-950"
                  }`}
                >
                  <span>🚗</span>
                  <span>{isDead ? "OtoPiyasa Arşiv Kaydını Aç" : "OtoPiyasa'da İlanı Görüntüle"}</span>
                </a>
                {inspectedCar.listingUrl && (
                  <a
                    href={inspectedCar.listingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-center py-2.5 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <span>🔗</span>
                    <span>Orijinal İlanı Aç</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
