"use client";

import { useState } from "react";
import Link from "next/link";

export interface AdminCommentItem {
  _id: string;
  car?: {
    _id?: string;
    title?: string;
    price?: number;
    imageUrl?: string;
  } | null;
  user?: {
    _id?: string;
    name?: string;
    email?: string;
  } | null;
  text: string;
  rating: number;
  createdAt: string;
}

interface AdminCommentsSectionProps {
  initialComments: AdminCommentItem[];
}

export function AdminCommentsSection({ initialComments }: AdminCommentsSectionProps) {
  const [comments, setComments] = useState<AdminCommentItem[]>(initialComments);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const filtered = comments.filter((c) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    const textMatch = c.text.toLowerCase().includes(q);
    const userMatch = (c.user?.name || "").toLowerCase().includes(q) || (c.user?.email || "").toLowerCase().includes(q);
    const carMatch = (c.car?.title || "").toLowerCase().includes(q);
    return textMatch || userMatch || carMatch;
  });

  async function handleDelete(commentId: string) {
    if (!window.confirm("Bu kullanıcı yorumunu silmek istediğine emin misin?")) {
      return;
    }

    setDeletingId(commentId);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/admin/comments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId, reason: "Yönetici paneli üzerinden silindi" }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Yorum silinemedi");

      setComments((prev) => prev.filter((c) => c._id !== commentId));
    } catch (err: any) {
      setErrorMsg(err.message || "İşlem sırasında bir hata oluştu");
    } finally {
      setDeletingId(null);
    }
  }

  function renderStars(rating: number) {
    return (
      <div className="flex items-center gap-0.5 text-amber-400 text-xs">
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i}>{i < rating ? "★" : "☆"}</span>
        ))}
      </div>
    );
  }

  return (
    <section id="admin-comments" className="card p-6 scroll-mt-6 border border-slate-800">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 font-black text-lg border border-amber-500/20">
            💬
          </div>
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              Kullanıcı Yorumları Moderasyonu
              <span className="rounded-full bg-amber-500/20 text-amber-300 text-xs px-2.5 py-0.5 font-bold">
                {comments.length} Yorum
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Araç ilanlarına yapılan değerlendirmeleri ve soruları inceleyin, uygunsuz yorumları kaldırın.
            </p>
          </div>
        </div>

        <div className="relative min-w-[240px]">
          <input
            type="text"
            placeholder="Yorum, kullanıcı veya araç ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl bg-slate-900/90 border border-slate-700/60 px-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-slate-200"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="mb-4 rounded-xl bg-rose-500/15 border border-rose-500/30 p-3 text-xs text-rose-300">
          ⚠️ {errorMsg}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="py-10 text-center text-slate-500 text-sm">
          {search ? "Arama kriterine uygun yorum bulunamadı." : "Henüz hiç kullanıcı yorumu bulunmuyor."}
        </div>
      ) : (
        <div className="divide-y divide-slate-800/80">
          {filtered.map((item) => {
            const car = item.car;
            const user = item.user;
            const dateStr = item.createdAt
              ? new Date(item.createdAt).toLocaleString("tr-TR", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Bilinmiyor";

            return (
              <div
                key={item._id}
                className="py-4 first:pt-0 last:pb-0 flex flex-col md:flex-row md:items-start justify-between gap-4"
              >
                <div className="space-y-2 flex-1">
                  {/* Yorumcu ve İlan Bilgisi */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1.5 font-bold text-slate-200">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-[10px] text-amber-300 font-bold border border-slate-700">
                        {(user?.name || "K").charAt(0).toUpperCase()}
                      </span>
                      {user?.name || "Bilinmeyen Kullanıcı"}
                    </span>
                    {user?.email && (
                      <span className="text-slate-500 text-[11px]">({user.email})</span>
                    )}

                    <span className="text-slate-600">•</span>
                    {renderStars(item.rating)}
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-500 text-[11px]">{dateStr}</span>
                  </div>

                  {/* Yorum Metni */}
                  <div className="rounded-xl bg-slate-900/60 border border-slate-800/80 p-3 text-sm text-slate-200">
                    &ldquo;{item.text}&rdquo;
                  </div>

                  {/* Araç Bilgisi */}
                  {car ? (
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="text-slate-500">İlan:</span>
                      <Link
                        href={`/cars/${car._id}`}
                        target="_blank"
                        className="font-medium text-amber-400 hover:text-amber-300 hover:underline inline-flex items-center gap-1"
                      >
                        🚗 {car.title || "İlanı Görüntüle"} ↗
                      </Link>
                      {car.price && (
                        <span className="text-emerald-400 font-semibold">
                          ({car.price.toLocaleString("tr-TR")} ₺)
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 italic">
                      (İlan silinmiş veya arşivlenmiş)
                    </div>
                  )}
                </div>

                {/* Aksiyonlar */}
                <div className="flex items-center gap-2 self-end md:self-start pt-1">
                  <button
                    onClick={() => handleDelete(item._id)}
                    disabled={deletingId === item._id}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/10 border border-rose-500/25 px-3 py-1.5 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 hover:border-rose-500/40 transition disabled:opacity-50"
                  >
                    {deletingId === item._id ? (
                      <span>Siliniyor...</span>
                    ) : (
                      <>
                        <span>🗑️ Yorumu Sil</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
