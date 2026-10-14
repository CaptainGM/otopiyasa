"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Filter = "active" | "resolved" | "rejected" | "all";

interface AdminRequestItem {
  id: string;
  typeLabel: string;
  subject: string;
  message: string;
  email: string;
  name: string;
  fromAccount: boolean;
  carId: string | null;
  carTitle: string | null;
  status: string;
  statusLabel: string;
  adminNote: string;
  createdAt: string;
  resolvedAt: string | null;
}

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "active", label: "Açık ve incelemede" },
  { value: "resolved", label: "Çözüldü" },
  { value: "rejected", label: "Reddedildi" },
  { value: "all", label: "Tümü" },
];

const inputClass = "w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs outline-none focus:border-amber-400/60";
const buttonClass = "rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50";

/** Kullanıcıların genel talep ve şikayet formundan gönderdiği kayıtlar. Yalnızca yöneticiler. */
export function AdminRequestsQueue() {
  const [filter, setFilter] = useState<Filter>("active");
  const [items, setItems] = useState<AdminRequestItem[] | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load(next: Filter) {
    setError(null);
    const res = await fetch(`/api/admin/requests?status=${next}`, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Talepler yüklenemedi.");
      return;
    }
    const list = data.items as AdminRequestItem[];
    setItems(list);
    setNotes(Object.fromEntries(list.map((item) => [item.id, item.adminNote])));
  }

  useEffect(() => {
    load(filter);
  }, [filter]);

  async function update(id: string, body: Record<string, string>) {
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Güncellenemedi.");
        return;
      }
      await load(filter);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card p-5">
      <h2 className="mb-4 text-xl font-semibold">Talepler (genel form)</h2>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setFilter(option.value)}
            className={`${buttonClass} ${
              filter === option.value ? "border-amber-400/60 bg-amber-400/15 text-amber-200" : "border-white/10 text-slate-300 hover:border-amber-400/40"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {error && <p className="mb-3 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p>}

      {items === null ? (
        <p className="text-sm text-slate-500">Yükleniyor…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-500">Bu görünümde talep yok.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border border-white/10 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge">{item.typeLabel}</span>
                <span className="badge">{item.statusLabel}</span>
                {item.fromAccount && <span className="badge">Üye</span>}
                <span className="font-semibold">{item.subject}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {new Date(item.createdAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })} • {item.name || "Ad yok"} •{" "}
                {item.email ? (
                  <a href={`mailto:${item.email}`} className="underline hover:text-slate-300">
                    {item.email}
                  </a>
                ) : (
                  "e-posta yok"
                )}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{item.message}</p>
              {item.carId && (
                <Link href={`/cars/${item.carId}`} className="mt-1 inline-block text-xs text-amber-300 hover:underline">
                  İlgili ilan: {item.carTitle || "(silinmiş ilan)"}
                </Link>
              )}

              <div className="mt-3 space-y-2">
                <textarea
                  value={notes[item.id] ?? ""}
                  onChange={(e) => setNotes({ ...notes, [item.id]: e.target.value })}
                  rows={2}
                  maxLength={1000}
                  placeholder="Dahili not (kullanıcıya gösterilmez)"
                  className={inputClass}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy === item.id}
                    onClick={() => update(item.id, { adminNote: notes[item.id] ?? "" })}
                    className={`${buttonClass} border-white/15 text-slate-300 hover:bg-white/10`}
                  >
                    Notu kaydet
                  </button>
                  {item.status === "open" && (
                    <button type="button" disabled={busy === item.id} onClick={() => update(item.id, { status: "in_review" })} className={`${buttonClass} border-sky-400/30 text-sky-300 hover:bg-sky-500/10`}>
                      İncelemeye al
                    </button>
                  )}
                  {(item.status === "open" || item.status === "in_review") && (
                    <>
                      <button type="button" disabled={busy === item.id} onClick={() => update(item.id, { status: "resolved" })} className={`${buttonClass} border-emerald-400/30 text-emerald-300 hover:bg-emerald-500/10`}>
                        Çözüldü
                      </button>
                      <button type="button" disabled={busy === item.id} onClick={() => update(item.id, { status: "rejected" })} className={`${buttonClass} border-white/15 text-slate-300 hover:bg-white/10`}>
                        Reddet
                      </button>
                    </>
                  )}
                  {(item.status === "resolved" || item.status === "rejected") && (
                    <button type="button" disabled={busy === item.id} onClick={() => update(item.id, { status: "open" })} className={`${buttonClass} border-amber-400/30 text-amber-300 hover:bg-amber-500/10`}>
                      Yeniden aç
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
