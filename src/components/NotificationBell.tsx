"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useVisibleInterval } from "@/components/useVisibleInterval";

interface Notif {
  _id: string;
  type: string;
  title: string;
  body: string;
  link: string;
  read: boolean;
  createdAt: string;
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.items || []);
      setUnread(data.unread || 0);
    } catch {

    }
  }

  useEffect(() => {
    load();
  }, []);
  // Sekme arka plandayken sorulmaz (bkz. useVisibleInterval).
  // Her açık sekme dakikada bir sunucuya gitmesin (Vercel işlemci kotası): 5 dk'da bir yenilenir; panel açılınca da taze.
  useVisibleInterval(load, 5 * 60_000);


  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function openPanel() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => {});
      setUnread(0);
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  }

  function go(n: Notif) {
    setOpen(false);
    if (n.link) router.push(n.link);
  }

  async function clearAll() {
    await fetch("/api/notifications", { method: "DELETE" }).catch(() => {});
    setItems([]);
    setUnread(0);
  }

  async function deleteOne(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setItems((prev) => prev.filter((item) => item._id !== id));
    await fetch(`/api/notifications?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={openPanel}
        aria-label="Bildirimler"
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-slate-300 transition hover:bg-white/5"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-black text-black">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 max-w-[90vw] overflow-hidden rounded-xl border border-white/10 bg-[rgba(12,14,20,0.98)] shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
            <p className="text-sm font-semibold">Bildirimler</p>
            {items.length > 0 && (
              <button type="button" onClick={clearAll} className="text-xs text-slate-500 transition hover:text-slate-300">
                Temizle
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500">Bildirim yok.</p>
            ) : (
              items.map((n) => (
                <div
                  key={n._id}
                  onClick={() => go(n)}
                  role="button"
                  tabIndex={0}
                  className={`group relative flex items-start justify-between gap-2 w-full border-b border-white/5 px-4 py-3 text-left transition hover:bg-white/5 cursor-pointer ${
                    n.read ? "" : "bg-amber-400/5"
                  }`}
                >
                  <div className="flex-1 min-w-0 pr-1">
                    <p className="text-sm font-medium text-slate-200">{n.title}</p>
                    {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">{n.body}</p>}
                    <p className="mt-1 text-[10px] text-slate-600">
                      {new Date(n.createdAt).toLocaleString("tr-TR", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "Europe/Istanbul",
                      })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => deleteOne(n._id, e)}
                    title="Bildirimi sil"
                    aria-label="Bildirimi sil"
                    className="shrink-0 mt-0.5 p-1 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="border-t border-white/10 p-2 text-center bg-slate-950/40">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                router.push("/profile#bildirimler");
              }}
              className="text-xs font-medium text-amber-400 hover:text-amber-300 transition"
            >
              Tüm bildirimleri profilde gör →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
