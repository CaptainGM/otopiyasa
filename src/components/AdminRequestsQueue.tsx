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

const inputClass =
  "w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm leading-relaxed outline-none placeholder:text-slate-500 focus:border-amber-400/60";
const buttonClass = "rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:opacity-50";

/** Durum rengi: açık sarı, incelemede mavi, çözüldü yeşil, reddedildi kırmızı. */
function statusTone(status: string): string {
  switch (status) {
    case "in_review":
      return "border-sky-400/40 bg-sky-500/10 text-sky-200";
    case "resolved":
      return "border-emerald-400/40 bg-emerald-500/10 text-emerald-200";
    case "rejected":
      return "border-rose-400/40 bg-rose-500/10 text-rose-200";
    default:
      return "border-amber-400/40 bg-amber-500/10 text-amber-200";
  }
}

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
    <div className="card p-5 sm:p-6">
      <div className="mb-5">
        <h2 className="text-2xl font-semibold">Talepler (genel form)</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
          Genel talep formundan gelen şikayet, hata bildirimi, KVKK talebi, öneri ve diğer kayıtlar. Kullanıcıya görünmeyen not
          ekleyebilir, durumu değiştirebilirsin.
        </p>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
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

      {error && <p className="mb-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p>}

      {items === null ? (
        <p className="text-base text-slate-400">Yükleniyor…</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 px-4 py-10 text-center">
          <p className="text-base font-semibold text-slate-300">Bu görünümde talep yok</p>
          <p className="mt-1 text-sm text-slate-500">Yeni talepler geldiğinde burada ve bildirimde görünür.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <article key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
              <header className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm font-semibold text-slate-200">
                  {item.typeLabel}
                </span>
                <span className={`rounded-full border px-3 py-1 text-sm font-semibold ${statusTone(item.status)}`}>{item.statusLabel}</span>
                {item.fromAccount && (
                  <span className="rounded-full border border-white/15 px-3 py-1 text-sm text-slate-300">Üye</span>
                )}
              </header>

              <h3 className="mt-3 text-lg font-semibold leading-snug">{item.subject}</h3>
              <p className="mt-1 text-sm text-slate-400">
                {new Date(item.createdAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })} • {item.name || "Ad yok"} •{" "}
                {item.email ? (
                  <a href={`mailto:${item.email}`} className="text-slate-200 underline underline-offset-2 hover:text-amber-200">
                    {item.email}
                  </a>
                ) : (
                  "e-posta yok"
                )}
              </p>

              <p className="mt-3 whitespace-pre-wrap rounded-xl bg-black/20 px-4 py-3 text-base leading-relaxed text-slate-200">{item.message}</p>

              {item.carId && (
                <Link href={`/cars/${item.carId}`} className="mt-3 inline-block text-sm font-semibold text-amber-300 hover:underline">
                  İlgili ilan: {item.carTitle || "(silinmiş ilan)"}
                </Link>
              )}

              <div className="mt-4 space-y-3">
                <textarea
                  value={notes[item.id] ?? ""}
                  onChange={(e) => setNotes({ ...notes, [item.id]: e.target.value })}
                  rows={3}
                  maxLength={1000}
                  placeholder="Dahili not (kullanıcıya gösterilmez)"
                  className={inputClass}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy === item.id}
                    onClick={() => update(item.id, { adminNote: notes[item.id] ?? "" })}
                    className={`${buttonClass} border-white/20 text-slate-200 hover:bg-white/10`}
                  >
                    Notu kaydet
                  </button>
                  {item.status === "open" && (
                    <button type="button" disabled={busy === item.id} onClick={() => update(item.id, { status: "in_review" })} className={`${buttonClass} border-sky-400/40 text-sky-200 hover:bg-sky-500/10`}>
                      İncelemeye al
                    </button>
                  )}
                  {(item.status === "open" || item.status === "in_review") && (
                    <>
                      <button type="button" disabled={busy === item.id} onClick={() => update(item.id, { status: "resolved" })} className={`${buttonClass} border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/10`}>
                        Çözüldü
                      </button>
                      <button type="button" disabled={busy === item.id} onClick={() => update(item.id, { status: "rejected" })} className={`${buttonClass} border-rose-400/40 text-rose-200 hover:bg-rose-500/10`}>
                        Reddet
                      </button>
                    </>
                  )}
                  {(item.status === "resolved" || item.status === "rejected") && (
                    <button type="button" disabled={busy === item.id} onClick={() => update(item.id, { status: "open" })} className={`${buttonClass} border-amber-400/40 text-amber-200 hover:bg-amber-500/10`}>
                      Yeniden aç
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
