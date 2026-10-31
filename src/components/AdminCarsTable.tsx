"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminDeleteCarButton } from "@/components/AdminDeleteCarButton";
import { SourceBadge } from "@/components/SourceBadge";
import { formatPrice } from "@/lib/utils";
import type { ListingSource } from "@/types";

interface AdminCarItem {
  _id: string;
  title: string;
  price: number;
  city: string;
  sourceSite?: string;
  externalId?: string;
  status?: string;
  moderationStatus?: "approved" | "pending" | "rejected";
  rejectionReason?: string;
  viewCount?: number;
  owner?: {
    name: string;
    email: string;
    phone: string;
  } | null;
  createdAt?: string;
  updatedAt?: string;
}

interface Counts {
  all: number;
  user: number;
  pending: number;
  rejected: number;
}

export function AdminCarsTable() {
  const [activeFilter, setActiveFilter] = useState<"all" | "user" | "pending" | "rejected">("all");
  const [cars, setCars] = useState<AdminCarItem[]>([]);
  const [counts, setCounts] = useState<Counts>({ all: 0, user: 0, pending: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [busyCarId, setBusyCarId] = useState<string | null>(null);

  function loadListings(filter: "all" | "user" | "pending" | "rejected") {
    setLoading(true);
    fetch(`/api/admin/listings?limit=50&filter=${filter}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.cars) setCars(data.cars);
        if (data?.counts) setCounts(data.counts);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadListings(activeFilter);
  }, [activeFilter]);

  async function handleModerate(carId: string, action: "approve" | "reject") {
    let reason = "";
    if (action === "reject") {
      const input = window.prompt("İlanın reddedilme sebebi (kullanıcıya profilinde gösterilir):");
      if (input === null) return; // iptal edildi
      reason = input.trim();
    }

    setBusyCarId(carId);
    try {
      const res = await fetch("/api/admin/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carId, action, reason }),
      });
      if (res.ok) {
        setCars((prev) =>
          prev.map((c) =>
            c._id === carId
              ? {
                  ...c,
                  moderationStatus: action === "approve" ? "approved" : "rejected",
                  rejectionReason: reason,
                  status: action === "approve" ? "active" : c.status,
                }
              : c
          )
        );
        loadListings(activeFilter);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "İşlem başarısız.");
      }
    } finally {
      setBusyCarId(null);
    }
  }

  return (
    <div className="card p-5 space-y-4">
      {/* Başlık ve Filtre Sekmeleri */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-4">
        <div>
          <h2 className="text-xl font-semibold">
            {activeFilter === "user"
              ? "Kullanıcıların Açtığı İlanlar"
              : activeFilter === "pending"
              ? "Onay Bekleyen Kullanıcı İlanları"
              : activeFilter === "rejected"
              ? "Reddedilen Kullanıcı İlanları"
              : "Sistem ve Canlı İlanlar"}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {activeFilter === "user"
              ? "Sitede kayıtlı üyelerin bizzat yayına koyduğu bireysel ilanlar."
              : activeFilter === "pending"
              ? "Yapay zeka veya yönetici onayı bekleyen yeni üye ilanları."
              : activeFilter === "rejected"
              ? "Kural ihlali veya yönetici kararıyla reddedilen ilanlar."
              : "Scraper tarafından taranan, güncellenen veya eklenen güncel piyasa ilanları."}
          </p>
        </div>

        {/* Sekmeler */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-950/60 p-1 border border-white/10 text-xs">
          <button
            type="button"
            onClick={() => setActiveFilter("all")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition ${
              activeFilter === "all"
                ? "bg-amber-500 text-slate-950 shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Tüm İlanlar
            {counts.all > 0 && <span className="ml-1.5 text-[10px] opacity-80">({counts.all})</span>}
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("user")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition ${
              activeFilter === "user"
                ? "bg-amber-500 text-slate-950 shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            👤 Kullanıcı İlanları
            {counts.user > 0 && (
              <span className="ml-1.5 rounded bg-amber-400/20 px-1.5 py-0.2 text-[10px] font-bold text-amber-300">
                {counts.user}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("pending")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition ${
              activeFilter === "pending"
                ? "bg-amber-500 text-slate-950 shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            ⏳ Onay Bekleyenler
            {counts.pending > 0 && (
              <span className="ml-1.5 rounded bg-amber-500/30 px-1.5 py-0.2 text-[10px] font-bold text-amber-300">
                {counts.pending}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("rejected")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition ${
              activeFilter === "rejected"
                ? "bg-rose-500 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            ❌ Reddedilenler
            {counts.rejected > 0 && (
              <span className="ml-1.5 rounded bg-rose-500/30 px-1.5 py-0.2 text-[10px] font-bold text-rose-300">
                {counts.rejected}
              </span>
            )}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3 py-8 animate-pulse">
          <div className="h-10 rounded bg-white/5" />
          <div className="h-10 rounded bg-white/5" />
          <div className="h-10 rounded bg-white/5" />
        </div>
      ) : cars.length === 0 ? (
        <div className="py-12 text-center text-slate-500 text-sm">
          {activeFilter === "pending"
            ? "Harika! Şu anda onay bekleyen kullanıcı ilanı yok."
            : activeFilter === "rejected"
            ? "Reddedilmiş ilan bulunmuyor."
            : activeFilter === "user"
            ? "Henüz sisteme eklenmiş kullanıcı ilanı bulunmuyor."
            : "Kayıtlı aktif ilan bulunamadı."}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[840px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="p-2.5">İlan</th>
                {activeFilter !== "all" && <th className="p-2.5">İlan Sahibi (Üye)</th>}
                <th className="p-2.5">{activeFilter === "all" ? "Kaynak" : "Durum"}</th>
                <th className="p-2.5">Fiyat</th>
                <th className="p-2.5">Şehir</th>
                {activeFilter !== "all" ? (
                  <>
                    <th className="p-2.5">Moderasyon</th>
                    <th className="p-2.5">Eklenme Tarihi</th>
                  </>
                ) : (
                  <>
                    <th className="p-2.5">Son Tarama / İşlem</th>
                    <th className="p-2.5">İlk Kayıt</th>
                  </>
                )}
                <th className="p-2.5 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {cars.map((car) => {
                const isUser = car.sourceSite === "user";
                return (
                  <tr
                    key={car._id}
                    className="border-b border-white/5 hover:bg-white/[0.02] transition"
                  >
                    <td className="max-w-72 p-2.5">
                      <Link
                        href={`/cars/${car._id}`}
                        target="_blank"
                        className="line-clamp-1 font-medium text-slate-200 hover:text-amber-300"
                        title={car.title}
                      >
                        {car.title}
                      </Link>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                        {isUser && (
                          <span className="font-semibold text-emerald-400">
                            👤 Üye İlanı
                          </span>
                        )}
                        {car.viewCount !== undefined && (
                          <span>👁️ {car.viewCount} görüntülenme</span>
                        )}
                      </div>
                    </td>

                    {activeFilter !== "all" && (
                      <td className="p-2.5 text-xs">
                        {isUser ? (
                          car.owner ? (
                            <div>
                              <p className="font-semibold text-slate-200">{car.owner.name}</p>
                              <p className="text-slate-400">{car.owner.email}</p>
                              {car.owner.phone && (
                                <p className="text-slate-500 text-[10px]">{car.owner.phone}</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-amber-400/80 italic">Kayıtlı Üye</span>
                          )
                        ) : (
                          <span className="text-slate-500 italic">Dış Kaynak (Arabam)</span>
                        )}
                      </td>
                    )}

                    <td className="p-2.5">
                      {activeFilter === "all" ? (
                        <SourceBadge source={(car.sourceSite || "demo") as ListingSource} />
                      ) : (
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            car.status === "active"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : car.status === "removed"
                              ? "bg-slate-700/50 text-slate-300 border border-slate-600"
                              : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                          }`}
                        >
                          {car.status === "active"
                            ? "Yayında"
                            : car.status === "removed"
                            ? "Arşivde"
                            : car.status || "Aktif"}
                        </span>
                      )}
                    </td>

                    <td className="p-2.5 font-semibold text-slate-100">
                      {formatPrice(car.price)}
                    </td>
                    <td className="p-2.5 text-slate-400">{car.city}</td>

                    {activeFilter !== "all" ? (
                      <>
                        <td className="p-2.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                              car.moderationStatus === "approved"
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                : car.moderationStatus === "pending"
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                : car.moderationStatus === "rejected"
                                ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                : isUser
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                : "bg-slate-800 text-slate-400 border border-slate-700"
                            }`}
                          >
                            {car.moderationStatus === "approved"
                              ? "✓ Onaylı"
                              : car.moderationStatus === "pending"
                              ? "⏳ Onay Bekliyor"
                              : car.moderationStatus === "rejected"
                              ? "✕ Reddedildi"
                              : isUser
                              ? "✓ Yayında"
                              : "Otomatik (Bot)"}
                          </span>
                          {car.moderationStatus === "rejected" && car.rejectionReason && (
                            <p className="text-[10px] text-rose-300 mt-1 max-w-[200px] leading-snug bg-rose-500/10 p-1.5 rounded border border-rose-500/20">
                              <strong>Sebep:</strong> {car.rejectionReason}
                            </p>
                          )}
                        </td>
                        <td className="p-2.5 text-slate-400 text-xs">
                          {car.createdAt
                            ? new Date(car.createdAt).toLocaleDateString("tr-TR", {
                                timeZone: "Europe/Istanbul",
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              })
                            : "-"}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="p-2.5 font-medium text-emerald-400 text-xs">
                          {car.updatedAt
                            ? new Date(car.updatedAt).toLocaleString("tr-TR", {
                                timeZone: "Europe/Istanbul",
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "-"}
                        </td>
                        <td className="p-2.5 text-slate-500 text-xs">
                          {car.createdAt
                            ? new Date(car.createdAt).toLocaleDateString("tr-TR", {
                                timeZone: "Europe/Istanbul",
                              })
                            : "-"}
                        </td>
                      </>
                    )}

                    <td className="p-2.5 text-right space-x-1.5 whitespace-nowrap">
                      {/* Doğrudan İlana Git Butonu */}
                      <a
                        href={`/cars/${car._id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg bg-amber-500/15 border border-amber-500/35 px-2.5 py-1 text-xs font-bold text-amber-300 hover:bg-amber-500/25 transition inline-flex items-center gap-1 shadow-sm"
                        title="İlanı yeni sekmede aç"
                      >
                        İlana Git ↗
                      </a>

                      {/* Onay Bekleyenler için Butonlar */}
                      {isUser && car.moderationStatus === "pending" && (
                        <>
                          <button
                            type="button"
                            disabled={busyCarId === car._id}
                            onClick={() => handleModerate(car._id, "approve")}
                            className="rounded-lg bg-emerald-500/20 border border-emerald-500/30 px-2 py-1 text-xs font-bold text-emerald-300 hover:bg-emerald-500/30 transition disabled:opacity-50"
                          >
                            {busyCarId === car._id ? "..." : "Onayla"}
                          </button>
                          <button
                            type="button"
                            disabled={busyCarId === car._id}
                            onClick={() => handleModerate(car._id, "reject")}
                            className="rounded-lg bg-rose-500/20 border border-rose-500/30 px-2 py-1 text-xs font-bold text-rose-300 hover:bg-rose-500/30 transition disabled:opacity-50"
                          >
                            Reddet
                          </button>
                        </>
                      )}

                      {/* Reddedilenler için Yeniden Yayına Al Butonu */}
                      {isUser && car.moderationStatus === "rejected" && (
                        <button
                          type="button"
                          disabled={busyCarId === car._id}
                          onClick={() => handleModerate(car._id, "approve")}
                          className="rounded-lg bg-emerald-500/20 border border-emerald-500/30 px-2 py-1 text-xs font-bold text-emerald-300 hover:bg-emerald-500/30 transition disabled:opacity-50"
                          title="İlanı yeniden onaylayıp yayına al"
                        >
                          {busyCarId === car._id ? "..." : "Yayına Al"}
                        </button>
                      )}

                      <AdminDeleteCarButton carId={car._id} title={car.title} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
