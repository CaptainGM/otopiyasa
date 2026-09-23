"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { SourceBadge } from "@/components/SourceBadge";
import { formatPrice } from "@/lib/utils";
import { ListingSource } from "@/types";

interface CarItem {
  _id: string;
  title: string;
  brand: string;
  model: string;
  year: number;
  price: number;
  city: string;
  imageUrl?: string;
  sourceSite: string;
  listingUrl: string;
  externalId?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface VerifyStatus {
  status: "active" | "gone" | "redirected" | "blocked" | "error";
  statusCode?: number;
  reason: string;
  archived?: boolean;
}

export function OldestListingsPanel() {
  const [cars, setCars] = useState<CarItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 1,
  });
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"updatedAt" | "createdAt">("updatedAt");
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Toplu Süpürge (Bulk Cleaner) Durumu
  const [isSweeping, setIsSweeping] = useState(false);
  const [sweepResult, setSweepResult] = useState<{
    checked: number;
    archived: number;
    active: number;
    message: string;
  } | null>(null);
  const [isContinuousSweeping, setIsContinuousSweeping] = useState(false);
  const stopContinuousRef = useRef(false);

  // Her araç için anlık doğrulama durumu
  const [verifyMap, setVerifyMap] = useState<Record<string, VerifyStatus>>({});
  const [verifyingMap, setVerifyingMap] = useState<Record<string, boolean>>({});

  async function loadListings(pageToLoad = 1, currentSource = sourceFilter, currentSort = sortBy) {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/listings/oldest?page=${pageToLoad}&limit=50&source=${currentSource}&sortBy=${currentSort}`
      );
      if (res.ok) {
        const data = await res.json();
        setCars(data.cars || []);
        setPagination(data.pagination || { page: 1, limit: 50, total: 0, totalPages: 1 });
      }
    } catch (err) {
      console.error("En eski ilanlar yüklenemedi:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadListings(1, sourceFilter, sortBy);
  }, [sourceFilter, sortBy]);

  async function handleVerify(carId: string) {
    setVerifyingMap((prev) => ({ ...prev, [carId]: true }));
    try {
      const res = await fetch("/api/admin/listings/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carId, autoArchive: true }),
      });
      if (res.ok) {
        const data = await res.json();
        setVerifyMap((prev) => ({
          ...prev,
          [carId]: {
            status: data.status,
            statusCode: data.statusCode,
            reason: data.reason,
            archived: data.archived,
          },
        }));

        if (data.archived) {
          const badge = document.getElementById("admin-stat-archived");
          if (badge) {
            const current = parseInt(badge.textContent?.replace(/\D/g, "") || "0", 10);
            badge.textContent = (current + 1).toLocaleString("tr-TR");
          }
        }
      }
    } catch (err) {
      setVerifyMap((prev) => ({
        ...prev,
        [carId]: {
          status: "error",
          reason: "İstek başarısız oldu",
        },
      }));
    } finally {
      setVerifyingMap((prev) => ({ ...prev, [carId]: false }));
    }
  }

  async function handleManualArchive(carId: string) {
    setVerifyingMap((prev) => ({ ...prev, [carId]: true }));
    try {
      const res = await fetch("/api/admin/listings/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carId, action: "archive" }),
      });
      if (res.ok) {
        setVerifyMap((prev) => ({
          ...prev,
          [carId]: {
            status: "gone",
            reason: "Manuel olarak arşive kaldırıldı",
            archived: true,
          },
        }));

        const badge = document.getElementById("admin-stat-archived");
        if (badge) {
          const current = parseInt(badge.textContent?.replace(/\D/g, "") || "0", 10);
          badge.textContent = (current + 1).toLocaleString("tr-TR");
        }
      }
    } catch (err) {
      console.error("Arşivleme hatası:", err);
    } finally {
      setVerifyingMap((prev) => ({ ...prev, [carId]: false }));
    }
  }

  // Tek Seferlik Toplu Süpürge (Örn: 50 veya 250 ilan)
  async function runBulkClean(count = 50) {
    setIsSweeping(true);
    setSweepResult(null);
    try {
      const res = await fetch("/api/admin/listings/bulk-clean", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: count, source: sourceFilter }),
      });
      if (res.ok) {
        const data = await res.json();
        setSweepResult({
          checked: data.checked,
          archived: data.archived,
          active: data.active,
          message: data.message,
        });

        if (data.archived > 0) {
          const badge = document.getElementById("admin-stat-archived");
          if (badge) {
            const current = parseInt(badge.textContent?.replace(/\D/g, "") || "0", 10);
            badge.textContent = (current + data.archived).toLocaleString("tr-TR");
          }
        }
        await loadListings(pagination.page, sourceFilter, sortBy);
      }
    } catch (err) {
      console.error("Bulk clean error:", err);
    } finally {
      setIsSweeping(false);
    }
  }

  // Çoklu Tur Otomatik Süpürge (Durdurana veya 500 ilana kadar)
  async function handleContinuousSweep() {
    if (isContinuousSweeping) {
      stopContinuousRef.current = true;
      setIsContinuousSweeping(false);
      return;
    }

    stopContinuousRef.current = false;
    setIsContinuousSweeping(true);
    let totalCleaned = 0;
    let totalChecked = 0;

    for (let round = 1; round <= 10; round++) {
      if (stopContinuousRef.current) break;

      setIsSweeping(true);
      try {
        const res = await fetch("/api/admin/listings/bulk-clean", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limit: 50, source: sourceFilter }),
        });
        if (res.ok) {
          const data = await res.json();
          totalChecked += data.checked;
          totalCleaned += data.archived;

          setSweepResult({
            checked: totalChecked,
            archived: totalCleaned,
            active: totalChecked - totalCleaned,
            message: `Tur #${round}/10 Tamamlandı: Toplam ${totalChecked} ilan tarandı, ${totalCleaned} ölü ilan arşive kaldırıldı.`,
          });

          if (data.archived > 0) {
            const badge = document.getElementById("admin-stat-archived");
            if (badge) {
              const current = parseInt(badge.textContent?.replace(/\D/g, "") || "0", 10);
              badge.textContent = (current + data.archived).toLocaleString("tr-TR");
            }
          }

          await loadListings(1, sourceFilter, sortBy);

          if (data.checked === 0) break;
        }
      } catch {
        break;
      } finally {
        setIsSweeping(false);
      }

      await new Promise((r) => setTimeout(r, 1500));
    }

    setIsContinuousSweeping(false);
  }

  // Sayfalama aralığı oluşturma
  const currentPage = pagination.page;
  const totalPages = pagination.totalPages;
  const pageNumbers: number[] = [];
  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, currentPage + 2);
  for (let i = startPage; i <= endPage; i++) {
    pageNumbers.push(i);
  }

  const sourcesList = [
    { id: "all", label: "Tüm Siteler" },
    { id: "arabam", label: "Arabam" },
    { id: "otokoc", label: "Otokoç" },
    { id: "dod", label: "DOD" },
    { id: "vavacars", label: "VavaCars" },
    { id: "otoplus", label: "Otoplus" },
    { id: "ikinciyeni", label: "İkinciyeni" },
    { id: "otomerkezi", label: "Otomerkezi" },
    { id: "carvak", label: "Carvak" },
  ];

  return (
    <div className="card space-y-5 p-5 sm:p-6 border border-amber-500/20 bg-slate-950/40 relative overflow-hidden">
      {/* Üst Başlık & Açıklama */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-3 w-3 rounded-full bg-amber-400 animate-pulse" />
            <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
              <span>🧹 En Eski & Doğrulanmamış İlanlar Denetim Masası</span>
            </h2>
            <span className="rounded-full bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[11px] font-bold text-amber-300">
              {pagination.total.toLocaleString("tr-TR")} Aktif İlan
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Sistemde en uzun süredir kontrol edilmeyen veya ilk eklenen aktif ilanlar. Orijinal bağlantıya tıklayıp açabilir veya{" "}
            <strong className="text-slate-200">[Canlı Test Et]</strong> ile yayında olup olmadığını anında sorgulayabilirsiniz.
          </p>
        </div>

        <button
          onClick={() => loadListings(pagination.page, sourceFilter, sortBy)}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 transition shrink-0"
        >
          <span>🔄</span>
          <span>Yenile</span>
        </button>
      </div>

      {/* Filtre ve Sıralama Kontrolleri */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900/40 p-3 rounded-xl border border-white/5 text-xs">
        {/* Kaynak Seçimi */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <span className="text-slate-400 font-bold shrink-0 mr-1">Kaynak:</span>
          {sourcesList.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setSourceFilter(s.id);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className={`px-2.5 py-1 rounded-lg font-semibold transition whitespace-nowrap text-[11px] ${
                sourceFilter === s.id
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : "bg-white/5 text-slate-400 hover:text-white border border-transparent"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Sıralama Ölçütü */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-slate-400 font-bold mr-1">Sıralama:</span>
          <button
            onClick={() => {
              setSortBy("updatedAt");
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            className={`px-2.5 py-1 rounded-lg font-semibold transition text-[11px] ${
              sortBy === "updatedAt"
                ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                : "bg-white/5 text-slate-400 hover:text-white"
            }`}
            title="En uzun süredir taranmayan bayat ilanlar"
          >
            ⏳ En Uzun Süredir Taranmayanlar
          </button>
          <button
            onClick={() => {
              setSortBy("createdAt");
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            className={`px-2.5 py-1 rounded-lg font-semibold transition text-[11px] ${
              sortBy === "createdAt"
                ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                : "bg-white/5 text-slate-400 hover:text-white"
            }`}
            title="Sisteme ilk giren en eski ilanlar"
          >
            📅 İlk Eklenenler
          </button>
        </div>
      </div>

      {/* 🧹 Toplu Ölü İlan Avcısı Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-transparent p-3.5 rounded-xl border border-amber-500/30 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-300 text-sm">
            🧹
          </div>
          <div>
            <div className="font-bold text-white flex items-center gap-2">
              <span>Otomatik Ölü İlan Süpürücüsü</span>
              {isSweeping && (
                <span className="inline-flex items-center gap-1 text-[10px] text-amber-300 animate-pulse bg-amber-500/20 px-2 py-0.5 rounded-full">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
                  Süpürülüyor...
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              En eski doğrulanmamış ilanları (Arabam, Otomerkezi, DOD vb.) canlı test edip ölüleri arşive taşır.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => runBulkClean(50)}
            disabled={isSweeping || isContinuousSweeping}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold text-xs transition disabled:opacity-50"
            title="Sıradaki en eski 50 ilanı arka planda test edip temizler"
          >
            <span>⚡ 50 İlanı Süpür</span>
          </button>

          <button
            onClick={() => runBulkClean(250)}
            disabled={isSweeping || isContinuousSweeping}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 font-bold text-xs transition disabled:opacity-50"
            title="Sıradaki en eski 250 ilanı arka planda test edip temizler"
          >
            <span>🚀 250 İlanı Süpür</span>
          </button>

          <button
            onClick={handleContinuousSweep}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-bold text-xs transition ${
              isContinuousSweeping
                ? "bg-rose-600 text-white border-rose-400 animate-pulse"
                : "bg-purple-500/20 hover:bg-purple-500/30 border-purple-500/40 text-purple-300"
            }`}
            title="500 ilana kadar turlar halinde aralıksız süpürür"
          >
            {isContinuousSweeping ? (
              <>
                <span>⏹️ Süpürmeyi Durdur</span>
              </>
            ) : (
              <>
                <span>🔄 Sürekli Süpür (500 İlan)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Yerel Süpürge İpucu */}
      <div className="flex items-center gap-2 rounded-lg bg-sky-950/30 border border-sky-500/20 px-3 py-2 text-[11px] text-sky-300">
        <span>⚡</span>
        <span>
          <strong>Kalıcı & Hızlı Çözüm:</strong> Veritabanındaki binlerce ölü ilanı Cloudflare veya hız sınırına takılmadan %100 doğrulukla arşive kaldırmak için proje klasöründeki <strong>temizle-olu-ilanlari.bat</strong> dosyasını çift tıklayarak çalıştırabilirsiniz.
        </span>
      </div>

      {/* Süpürge Sonuç Bildirimi */}
      {sweepResult && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 text-xs text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>🎉</span>
            <span className="font-semibold">{sweepResult.message}</span>
          </div>
          <button
            onClick={() => setSweepResult(null)}
            className="text-slate-400 hover:text-white px-2 py-0.5 rounded"
          >
            ✕
          </button>
        </div>
      )}

      {/* İlan Tablosu */}
      <div className="overflow-x-auto rounded-xl border border-white/5 bg-slate-900/30">
        <table className="w-full min-w-[900px] text-left text-xs">
          <thead className="bg-white/5 text-[11px] uppercase tracking-wider text-slate-400 border-b border-white/10">
            <tr>
              <th className="py-2.5 px-3">#</th>
              <th className="py-2.5 px-3">İlan</th>
              <th className="py-2.5 px-3">Kaynak</th>
              <th className="py-2.5 px-3">Fiyat</th>
              <th className="py-2.5 px-3">Şehir</th>
              <th className="py-2.5 px-3">Son Tarama</th>
              <th className="py-2.5 px-3">İlk Kayıt</th>
              <th className="py-2.5 px-3 text-center">Orijinal Site</th>
              <th className="py-2.5 px-3 text-right">Canlı Test & Arşiv</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              <tr>
                <td colSpan={9} className="py-16 text-center text-slate-400">
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
                    <span>İlanlar yükleniyor...</span>
                  </div>
                </td>
              </tr>
            ) : cars.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-500">
                  Bu filtreye uygun aktif ilan bulunamadı.
                </td>
              </tr>
            ) : (
              cars.map((car, idx) => {
                const rowNum = (pagination.page - 1) * pagination.limit + idx + 1;
                const vStatus = verifyMap[car._id];
                const isVerifying = verifyingMap[car._id];

                return (
                  <tr
                    key={car._id}
                    className={`hover:bg-white/[0.02] transition ${
                      vStatus?.archived ? "opacity-40 bg-rose-950/20" : ""
                    }`}
                  >
                    <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                      {rowNum}
                    </td>
                    <td className="py-2.5 px-3 max-w-[280px]">
                      <div className="flex items-center gap-2.5">
                        {car.imageUrl ? (
                          <img
                            src={car.imageUrl}
                            alt={car.title}
                            className="w-10 h-8 object-cover rounded border border-white/10 bg-slate-800 shrink-0"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-10 h-8 rounded border border-white/10 bg-slate-800 flex items-center justify-center text-[9px] text-slate-500 shrink-0">
                            Yok
                          </div>
                        )}
                        <div className="min-w-0">
                          <Link
                            href={`/cars/${car._id}`}
                            className="font-semibold text-white hover:text-amber-300 truncate block text-xs"
                            title={car.title}
                          >
                            {car.title}
                          </Link>
                          <span className="text-[10px] text-slate-400">
                            {car.brand} {car.model} • {car.year}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <SourceBadge source={car.sourceSite as ListingSource} />
                    </td>
                    <td className="py-2.5 px-3 font-bold text-white">
                      {formatPrice(car.price)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">{car.city || "Türkiye"}</td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                      {car.updatedAt
                        ? new Date(car.updatedAt).toLocaleDateString("tr-TR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })
                        : "-"}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                      {car.createdAt
                        ? new Date(car.createdAt).toLocaleDateString("tr-TR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })
                        : "-"}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {car.listingUrl ? (
                        <a
                          href={car.listingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded bg-white/5 hover:bg-amber-500/20 hover:text-amber-300 border border-white/10 px-2 py-1 text-[11px] font-semibold text-slate-300 transition"
                          title="Orijinal sitede açıp kontrol et"
                        >
                          <span>Siteye Git</span>
                          <span>↗</span>
                        </a>
                      ) : (
                        <span className="text-slate-600 text-[10px]">-</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {vStatus ? (
                          <div className="flex items-center gap-1">
                            {vStatus.status === "active" && (
                              <span
                                className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold"
                                title={vStatus.reason}
                              >
                                🟢 Yayında (200 OK)
                              </span>
                            )}
                            {vStatus.status === "gone" && (
                              <span
                                className="px-2 py-0.5 rounded bg-rose-500/15 border border-rose-500/30 text-rose-400 text-[10px] font-bold"
                                title={vStatus.reason}
                              >
                                🚫 Yayından Kalkmış {vStatus.archived ? "(Arşivlendi)" : ""}
                              </span>
                            )}
                            {vStatus.status === "redirected" && (
                              <span
                                className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-bold"
                                title={vStatus.reason}
                              >
                                ⚠️ Yönlendirildi
                              </span>
                            )}
                            {vStatus.status === "blocked" && (
                              <span
                                className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-bold"
                                title={vStatus.reason}
                              >
                                🛡️ Cloudflare 429
                              </span>
                            )}
                            {vStatus.status === "error" && (
                              <span
                                className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]"
                                title={vStatus.reason}
                              >
                                ⚠️ Hata
                              </span>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => handleVerify(car._id)}
                            disabled={isVerifying}
                            className="inline-flex items-center gap-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 px-2 py-1 text-[11px] font-bold text-sky-300 transition disabled:opacity-50"
                            title="İlanın orijinal sitesine anlık istek atıp durumunu kontrol eder"
                          >
                            {isVerifying ? (
                              <span className="inline-block animate-spin">⏳</span>
                            ) : (
                              <span>🔍 Canlı Test Et</span>
                            )}
                          </button>
                        )}

                        {!vStatus?.archived && (
                          <button
                            onClick={() => handleManualArchive(car._id)}
                            disabled={isVerifying}
                            className="inline-flex items-center rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 p-1 text-[11px] text-rose-400 transition"
                            title="İlanı doğrudan Piyasa Arşivi'ne taşı"
                          >
                            📦
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Alt Sayfalama (Pagination) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-slate-400 border-t border-white/5">
        <div>
          Sayfa <strong className="text-white">{currentPage}</strong> /{" "}
          <strong className="text-white">{totalPages}</strong> • Toplam{" "}
          <strong className="text-amber-300">{pagination.total.toLocaleString("tr-TR")}</strong> aktif ilan
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => loadListings(1, sourceFilter, sortBy)}
            disabled={currentPage <= 1 || loading}
            className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30 transition font-semibold"
          >
            « İlk
          </button>
          <button
            onClick={() => loadListings(currentPage - 1, sourceFilter, sortBy)}
            disabled={currentPage <= 1 || loading}
            className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30 transition font-semibold"
          >
            ‹ Önceki
          </button>

          {pageNumbers.map((p) => (
            <button
              key={p}
              onClick={() => loadListings(p, sourceFilter, sortBy)}
              disabled={loading}
              className={`px-2.5 py-1 rounded font-semibold transition ${
                p === currentPage
                  ? "bg-amber-500 text-slate-950 font-black"
                  : "bg-white/5 hover:bg-white/10 text-slate-300"
              }`}
            >
              {p}
            </button>
          ))}

          <button
            onClick={() => loadListings(currentPage + 1, sourceFilter, sortBy)}
            disabled={currentPage >= totalPages || loading}
            className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30 transition font-semibold"
          >
            Sonraki ›
          </button>
          <button
            onClick={() => loadListings(totalPages, sourceFilter, sortBy)}
            disabled={currentPage >= totalPages || loading}
            className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30 transition font-semibold"
          >
            Son »
          </button>
        </div>
      </div>
    </div>
  );
}
