"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Notif {
  _id: string;
  type: string;
  title: string;
  body: string;
  link: string;
  read: boolean;
  createdAt: string;
}

const TYPE_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  listing: { label: "İlan", bg: "bg-emerald-500/15 border-emerald-500/30", text: "text-emerald-300" },
  offer: { label: "Teklif", bg: "bg-amber-500/15 border-amber-500/30", text: "text-amber-300" },
  question: { label: "Soru", bg: "bg-cyan-500/15 border-cyan-500/30", text: "text-cyan-300" },
  comment: { label: "Yorum", bg: "bg-purple-500/15 border-purple-500/30", text: "text-purple-300" },
  business: { label: "İşletme", bg: "bg-blue-500/15 border-blue-500/30", text: "text-blue-300" },
  report: { label: "Şikayet", bg: "bg-rose-500/15 border-rose-500/30", text: "text-rose-300" },
  system: { label: "Sistem", bg: "bg-slate-700/50 border-slate-600", text: "text-slate-300" },
};

export function UserNotificationsSection() {
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications?limit=100");
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }).catch(() => {});
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  async function clearAll() {
    if (!window.confirm("Tüm bildirimler kalıcı olarak silinecek. Emin misin?")) return;
    await fetch("/api/notifications", { method: "DELETE" }).catch(() => {});
    setItems([]);
  }

  async function deleteOne(id: string) {
    setBusyId(id);
    try {
      setItems((prev) => prev.filter((n) => n._id !== id));
      await fetch(`/api/notifications?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
    } finally {
      setBusyId(null);
    }
  }

  async function markOneRead(id: string) {
    setItems((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {});
  }

  const unreadCount = items.filter((n) => !n.read).length;
  const filteredItems = filter === "unread" ? items.filter((n) => !n.read) : items;

  return (
    <div id="bildirimler" className="card p-6 scroll-mt-20">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Bildirim Geçmişi</h2>
            {unreadCount > 0 && (
              <span className="rounded-full bg-amber-400/20 border border-amber-400/30 px-2 py-0.5 text-xs font-bold text-amber-300">
                {unreadCount} yeni
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            İlanların, tekliflerin ve sistem hareketlerinle ilgili geçmiş bildirimlerini buradan inceleyebilirsin.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/10 transition"
            >
              ✓ Tümünü Okundu Say
            </button>
          )}
          {items.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/20 transition"
            >
              Tümünü Temizle
            </button>
          )}
        </div>
      </div>

      {/* Sekmeler */}
      <div className="flex items-center gap-2 mt-4 mb-3 border-b border-white/5 pb-2 text-xs">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`px-3 py-1 rounded-lg font-medium transition ${
            filter === "all" ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "text-slate-400 hover:text-white"
          }`}
        >
          Tümü ({items.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter("unread")}
          className={`px-3 py-1 rounded-lg font-medium transition ${
            filter === "unread" ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "text-slate-400 hover:text-white"
          }`}
        >
          Okunmamış ({unreadCount})
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-slate-500 animate-pulse">Bildirimler yükleniyor...</div>
      ) : filteredItems.length === 0 ? (
        <div className="py-12 text-center text-sm text-slate-500">
          {filter === "unread" ? "Okunmamış bildirim bulunmuyor." : "Henüz herhangi bir bildiriminiz yok."}
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
          {filteredItems.map((n) => {
            const badge = TYPE_BADGE[n.type] || TYPE_BADGE.system;
            return (
              <div
                key={n._id}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border transition ${
                  n.read
                    ? "bg-slate-950/40 border-white/5 hover:border-white/10"
                    : "bg-amber-500/5 border-amber-500/20 shadow-sm"
                }`}
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${badge.bg} ${badge.text}`}>
                      {badge.label}
                    </span>
                    <span className="text-sm font-semibold text-slate-200">{n.title}</span>
                    {!n.read && (
                      <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" title="Okunmamış bildirim" />
                    )}
                  </div>
                  {n.body && <p className="text-xs text-slate-400 leading-relaxed">{n.body}</p>}
                  <p className="text-[10px] text-slate-500">
                    {new Date(n.createdAt).toLocaleString("tr-TR", {
                      timeZone: "Europe/Istanbul",
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {!n.read && (
                    <button
                      type="button"
                      onClick={() => markOneRead(n._id)}
                      className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-white/5 transition"
                      title="Okundu olarak işaretle"
                    >
                      Okundu
                    </button>
                  )}
                  {n.link && (
                    <Link
                      href={n.link}
                      onClick={() => markOneRead(n._id)}
                      className="inline-flex items-center gap-1 rounded-lg bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-500/25 transition"
                    >
                      Görüntüle ↗
                    </Link>
                  )}
                  <button
                    type="button"
                    disabled={busyId === n._id}
                    onClick={() => deleteOne(n._id)}
                    title="Bildirimi sil"
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
