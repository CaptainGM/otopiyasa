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
  const [turFilter, setTurFilter] = useState<"all" | "has_dead" | "all_live">("all");
  const [turSearch, setTurSearch] = useState<string>("");
  const [visibleCount, setVisibleCount] = useState<number>(48);

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

  const allVehicles = useMemo(() => log?.sampleVehicles || [], [log?.sampleVehicles]);
  const isTurScrape = useMemo(() => bySourceEntries.some(([k]) => k.startsWith("Tur")), [bySourceEntries]);

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
                <div className="pt-2 border-t border-white/10">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                    <span>🚗</span>
                    <span>Örnek İşlenen Araçlar ({Math.min(allVehicles.length, 48)} Araç)</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {allVehicles.slice(0, 48).map((car, idx) => (
                      <div
                        key={car._id || idx}
                        onClick={() => setInspectedCar(car)}
                        className="rounded-xl bg-slate-900/70 border border-white/10 hover:border-amber-500/50 hover:bg-slate-900 p-3 flex gap-3 items-center cursor-pointer transition group shadow-sm"
                      >
                        {car.imageUrl ? (
                          <img
                            src={car.imageUrl}
                            alt={car.title || `${car.brand} ${car.model}`}
                            loading="lazy"
                            decoding="async"
                            className="w-16 h-14 object-cover rounded-lg bg-slate-800 shrink-0 border border-white/10"
                          />
                        ) : (
                          <div className="w-16 h-14 rounded-lg bg-slate-800 flex items-center justify-center text-xl shrink-0 border border-white/10">
                            🚗
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-white truncate">{car.brand} {car.model}</p>
                          <p className="text-[11px] text-slate-400 truncate">{car.year > 0 ? `${car.year} Model` : car.title}</p>
                          <p className="text-xs font-black text-amber-400 mt-1">{formatPrice(car.price)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>

          {/* Alt Kapat Barı */}
          <div className="border-t border-white/10 px-5 py-3 bg-slate-900/80 flex items-center justify-between text-xs text-slate-400">
            <span>
              Kayıt ID: <span className="font-mono text-slate-500">{log._id}</span> • Toplam Arşivlenen Araç:{" "}
              <strong className="text-rose-400">{allVehicles.length}</strong>
            </span>
            <button
              onClick={onClose}
              className="rounded-lg bg-white/10 hover:bg-white/15 px-4 py-1.5 font-semibold text-white transition"
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
      {inspectedCar && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 animate-fade-in"
          onClick={() => setInspectedCar(null)}
        >
          <div
            className="relative w-full max-w-lg rounded-2xl border border-rose-500/30 bg-slate-950 p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Araç Başlığı */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[11px] font-black px-2 py-0.5">
                    🚫 PİYASA ARŞİVİNE KALDIRILDI
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
                className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-white/10 text-lg transition"
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
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-slate-900 border border-white/10 p-2.5">
                <p className="text-[11px] text-slate-400">Fiyat</p>
                <p className="text-base font-black text-rose-400 mt-0.5">{formatPrice(inspectedCar.price)}</p>
              </div>
              <div className="rounded-lg bg-slate-900 border border-white/10 p-2.5">
                <p className="text-[11px] text-slate-400">Model Yılı</p>
                <p className="text-base font-bold text-white mt-0.5">{inspectedCar.year || "-"}</p>
              </div>
            </div>

            {/* Kaldırılma Nedeni */}
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

            {/* Doğrudan Bağlantılar */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              {inspectedCar._id && (
                <a
                  href={`/cars/${inspectedCar._id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-center py-2 text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <span>🚗</span>
                  <span>OtoPiyasa Arşiv Kaydını Aç</span>
                </a>
              )}
              {inspectedCar.listingUrl && (
                <a
                  href={inspectedCar.listingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 rounded-xl bg-white/10 hover:bg-white/15 text-white text-center py-2 text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <span>🔗</span>
                  <span>Orijinal İlan Sayfasını Aç</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
