"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SourceBadge } from "@/components/SourceBadge";
import { formatPrice } from "@/lib/utils";

interface HourlyDetailModalProps {
  slot: {
    _id: string;
    dateStr: string;
    hourRange: string;
    scanned: number;
    inserted: number;
    updated: number;
    deleted: number;
    bySource?: any;
  } | null;
  onClose: () => void;
}

export function HourlyDetailModal({ slot, onClose }: HourlyDetailModalProps) {
  const [activeTab, setActiveTab] = useState<"summary" | "removed" | "price" | "new">("summary");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    removedCars: any[];
    priceChanged: any[];
    newCars: any[];
  }>({
    removedCars: [],
    priceChanged: [],
    newCars: [],
  });
  const [summary, setSummary] = useState<any>(null);
  const [diagnostics, setDiagnostics] = useState<any>(null);

  useEffect(() => {
    if (!slot) return;
    setLoading(true);
    let active = true;

    fetch(`/api/admin/daemon-stats/detail?id=${slot._id}`)
      .then((res) => res.json())
      .then((json) => {
        if (active && json.success) {
          setData({
            removedCars: json.removedCars || [],
            priceChanged: json.priceChanged || [],
            newCars: json.newCars || [],
          });
          setSummary(json.summary || null);
          setDiagnostics(json.diagnostics || null);
        }
      })
      .catch((err) => console.error("Detay yüklenemedi:", err))
      .finally(() => {
        if (active) setLoading(false);
      });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      active = false;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [slot, onClose]);

  if (!slot) return null;

  const displayScanned = summary?.scanned ?? slot.scanned;
  const displayInserted = summary?.realNewCount ?? summary?.inserted ?? slot.inserted;
  const displayUpdated = summary?.updated ?? slot.updated;
  const displayDeleted = summary?.realRemovedCount ?? summary?.deleted ?? slot.deleted;
  const displayPriceCount = summary?.realPriceChangedCount ?? data.priceChanged.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-white/10 bg-slate-950 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Üst Başlık Barı */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 bg-slate-900/60">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
              <h3 className="text-lg font-bold text-white">
                {slot.dateStr} {slot.hourRange} Tarama & Güncelleme Detayı
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Bu saat diliminde veritabanında gerçekleşen canlı işlemler ve araç hareketleri
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white transition"
            aria-label="Kapat"
          >
            ✕
          </button>
        </div>

        {/* 4'lü Özet Kartları (Canlı DB & Stat Senkron) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-4 border-b border-white/5 bg-slate-900/20 text-xs">
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-center">
            <span className="text-slate-400">Taranan İlan</span>
            <p className="text-lg font-black text-white mt-0.5">{displayScanned.toLocaleString("tr-TR")}</p>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
            <span className="text-emerald-400 font-semibold">Yeni Eklenen</span>
            <p className="text-lg font-black text-emerald-300 mt-0.5">+{displayInserted}</p>
          </div>
          <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3 text-center">
            <span className="text-sky-400 font-semibold">Güncellenen</span>
            <p className="text-lg font-black text-sky-300 mt-0.5">{displayUpdated.toLocaleString("tr-TR")}</p>
          </div>
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-center">
            <span className="text-rose-400 font-semibold">Temizlenen / Satılan</span>
            <p className="text-lg font-black text-rose-300 mt-0.5">-{displayDeleted}</p>
          </div>
        </div>

        {/* Ağ & Cloudflare İstek Sağlık Kartı */}
        {diagnostics && (
          <div
            className={`mx-4 mt-3 p-3 rounded-xl border text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
              diagnostics.healthStatus === "warning"
                ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                : "border-emerald-500/20 bg-emerald-500/5 text-emerald-200"
            }`}
          >
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 font-bold">
                <span>{diagnostics.healthStatus === "warning" ? "⚠️" : "🟢"}</span>
                <span className={diagnostics.healthStatus === "warning" ? "text-amber-300 font-bold" : "text-emerald-300 font-bold"}>
                  {diagnostics.statusLabel}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                {diagnostics.explanation}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 text-[11px] font-mono">
              <span className="px-2 py-1 rounded bg-black/40 border border-white/10 text-white">
                Başarılı: <strong>{diagnostics.successRequests}</strong>
              </span>
              {diagnostics.failedRequests > 0 && (
                <span className="px-2 py-1 rounded bg-rose-500/20 border border-rose-500/30 text-rose-300">
                  Hata / Engel: <strong>{diagnostics.failedRequests}</strong>
                </span>
              )}
            </div>
          </div>
        )}

        {/* Sekmeler */}
        <div className="flex items-center gap-2 border-b border-white/10 px-4 pt-3 bg-slate-900/40 overflow-x-auto text-xs">
          <button
            onClick={() => setActiveTab("summary")}
            className={`pb-2.5 px-3 font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === "summary"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            📊 Kaynak Dağılımı
          </button>
          <button
            onClick={() => setActiveTab("removed")}
            className={`pb-2.5 px-3 font-semibold border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === "removed"
                ? "border-rose-500 text-rose-400"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            <span>🗑️ Kaldırılan / Satılan</span>
            <span className="rounded-full bg-rose-500/20 px-1.5 py-0.2 text-[10px] text-rose-300">
              {displayDeleted}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("price")}
            className={`pb-2.5 px-3 font-semibold border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === "price"
                ? "border-sky-500 text-sky-400"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            <span>📉 Fiyatı Değişenler</span>
            <span className="rounded-full bg-sky-500/20 px-1.5 py-0.2 text-[10px] text-sky-300">
              {displayPriceCount}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("new")}
            className={`pb-2.5 px-3 font-semibold border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === "new"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            <span>✨ Yeni Eklenenler</span>
            <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.2 text-[10px] text-emerald-300">
              {displayInserted}
            </span>
          </button>
        </div>

        {/* Sekme İçerikleri */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {loading ? (
            <div className="py-16 text-center text-slate-400 text-sm flex flex-col items-center gap-3">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
              <span>Veritabanı kayıtları inceleniyor...</span>
            </div>
          ) : (
            <>
              {/* 1. SEKME: Kaynak Dağılımı Tablosu */}
              {activeTab === "summary" && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Sitelere Göre Ayrıştırılmış İstatistik
                  </h4>
                  <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-900/40">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-white/5 text-[11px] uppercase tracking-wider text-slate-400 border-b border-white/10">
                        <tr>
                          <th className="py-2.5 px-3">Kaynak</th>
                          <th className="py-2.5 px-3 text-right">Taranan İlan</th>
                          <th className="py-2.5 px-3 text-right">Yeni İlan</th>
                          <th className="py-2.5 px-3 text-right">Güncellenen</th>
                          <th className="py-2.5 px-3 text-right">Kaldırılan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {Object.entries(slot.bySource || {}).map(([srcKey, sVal]: [string, any]) => {
                          if (!sVal || (sVal.scanned === 0 && sVal.updated === 0 && sVal.inserted === 0 && sVal.deleted === 0)) {
                            return null;
                          }
                          return (
                            <tr key={srcKey} className="hover:bg-white/[0.02]">
                              <td className="py-2.5 px-3">
                                <SourceBadge source={srcKey as any} />
                              </td>
                              <td className="py-2.5 px-3 text-right font-semibold text-white">
                                {sVal.scanned?.toLocaleString("tr-TR") || 0}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-emerald-400">
                                {sVal.inserted > 0 ? `+${sVal.inserted}` : "0"}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-sky-400">
                                {sVal.updated?.toLocaleString("tr-TR") || 0}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-rose-400">
                                {sVal.deleted > 0 ? `-${sVal.deleted}` : "0"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Bilgilendirme Notu */}
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-[11px] text-slate-400 space-y-1">
                    <p className="font-semibold text-slate-300">💡 İstatistik Matematiği Hakkında:</p>
                    <p>
                      • <strong>Taranan İlan:</strong> Motorun o saat içinde linkine gidip kontrol ettiği toplam bağlantı sayısıdır. (Döngülerde birden fazla kez kontrol edilen araçlar sayaçta artış gösterir).
                    </p>
                    <p>
                      • <strong>Güncellenen & Kaldırılan:</strong> Veritabanında somut sonuç üretip kaydedilen benzersiz araç işlemleridir.
                    </p>
                  </div>
                </div>
              )}

              {/* 2. SEKME: Kaldırılan / Satılan İlanlar */}
              {activeTab === "removed" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-rose-400">
                      Bu Saatte Orijinal Siteden Yayından Kalkan / Satılan Araçlar ({displayDeleted})
                    </h4>
                    <span className="text-[11px] text-slate-400">Piyasa Arşivi&apos;ne aktarıldı</span>
                  </div>

                  {data.removedCars.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 text-xs">
                      Bu saat aralığında yayından kaldırılan ilan bulunmuyor.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {data.removedCars.map((car) => (
                        <div
                          key={car._id}
                          className="rounded-xl border border-rose-500/20 bg-slate-900/50 p-3 flex gap-3 items-center hover:border-rose-500/40 transition"
                        >
                          {car.imageUrl ? (
                            <img
                              src={car.imageUrl}
                              alt={car.title}
                              className="w-16 h-12 object-cover rounded-lg border border-white/10 shrink-0 bg-slate-800"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-16 h-12 rounded-lg border border-white/10 bg-slate-800 flex items-center justify-center text-[10px] text-slate-500 shrink-0">
                              Resim Yok
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-white truncate" title={car.title}>
                              {car.title}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                              <span className="font-semibold text-rose-300">{formatPrice(car.price)}</span>
                              <span>•</span>
                              <span>{car.city || "Türkiye"}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1.5">
                              <SourceBadge source={car.sourceSite} />
                              <span className="text-[10px] text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                                🚫 Satıldı / Yayından Kalktı
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 3. SEKME: Fiyatı Değişen İlanlar */}
              {activeTab === "price" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-sky-400">
                      Bu Saatte Fiyatı Güncellenen Araçlar ({displayPriceCount})
                    </h4>
                  </div>

                  {data.priceChanged.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 text-xs">
                      Bu saat aralığında fiyat değişimi tespit edilmedi.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {data.priceChanged.map((car) => (
                        <div
                          key={car._id}
                          className="rounded-xl border border-sky-500/20 bg-slate-900/50 p-3 flex gap-3 items-center hover:border-sky-500/40 transition"
                        >
                          {car.imageUrl ? (
                            <img
                              src={car.imageUrl}
                              alt={car.title}
                              className="w-16 h-12 object-cover rounded-lg border border-white/10 shrink-0 bg-slate-800"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-16 h-12 rounded-lg border border-white/10 bg-slate-800 flex items-center justify-center text-[10px] text-slate-500 shrink-0">
                              Resim Yok
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-white truncate" title={car.title}>
                              {car.title}
                            </p>
                            <div className="flex items-center gap-2 mt-1 text-xs">
                              {car.diff !== 0 && (
                                <span className="line-through text-slate-500 text-[11px]">
                                  {formatPrice(car.previousPrice)}
                                </span>
                              )}
                              <span className="font-bold text-emerald-300">
                                {formatPrice(car.price)}
                              </span>
                              {car.diff < 0 && (
                                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/15 px-1 py-0.2 rounded">
                                  ▼ {formatPrice(Math.abs(car.diff))}
                                </span>
                              )}
                              {car.diff > 0 && (
                                <span className="text-[10px] text-rose-400 font-bold bg-rose-500/15 px-1 py-0.2 rounded">
                                  ▲ +{formatPrice(car.diff)}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1.5">
                              <SourceBadge source={car.sourceSite} />
                              <span className="text-[10px] text-slate-400">{car.city}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 4. SEKME: Yeni Eklenen İlanlar */}
              {activeTab === "new" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                      Bu Saatte Veritabanına İlk Kez Eklenen İlanlar ({displayInserted})
                    </h4>
                  </div>

                  {data.newCars.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 text-xs">
                      Bu saat aralığında sıfırdan eklenen yeni ilan bulunmuyor.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {data.newCars.map((car) => (
                        <div
                          key={car._id}
                          className="rounded-xl border border-emerald-500/20 bg-slate-900/50 p-3 flex gap-3 items-center hover:border-emerald-500/40 transition"
                        >
                          {car.imageUrl ? (
                            <img
                              src={car.imageUrl}
                              alt={car.title}
                              className="w-16 h-12 object-cover rounded-lg border border-white/10 shrink-0 bg-slate-800"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-16 h-12 rounded-lg border border-white/10 bg-slate-800 flex items-center justify-center text-[10px] text-slate-500 shrink-0">
                              Resim Yok
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-white truncate" title={car.title}>
                              {car.title}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                              <span className="font-semibold text-emerald-300">{formatPrice(car.price)}</span>
                              <span>•</span>
                              <span>{car.city || "Türkiye"}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1.5">
                              <SourceBadge source={car.sourceSite} />
                              <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                ✨ Yeni Giriş
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Alt Kapatma Butonu */}
        <div className="border-t border-white/10 px-5 py-3 bg-slate-900/40 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-800 hover:bg-slate-700 px-4 py-2 text-xs font-bold text-white transition"
          >
            Pencereyi Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
