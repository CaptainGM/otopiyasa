"use client";

import Link from "next/link";
import { useState } from "react";

const REASON_LABELS: Record<string, string> = {
  satildi: "İlan satılmış",
  "yanlis-bilgi": "Yanlış/yanıltıcı bilgi",
  dolandiricilik: "Dolandırıcılık şüphesi",
  "kufur-hakaret": "Küfür / hakaret",
  uygunsuz: "Uygunsuz içerik",
  diger: "Diğer",
};

export interface PendingReport {
  _id: string;
  carId: string;
  carTitle: string;
  reason: string;
  note: string;
  reporterName: string;
  createdAt: string;
  /** Yalnızca sohbet şikayetlerinde dolu. */
  chatSnapshot: string | null;
  reportedUserId: string | null;
  reportedUserName: string | null;
  reportedUserMuteCount: number;
}


export function ReportQueue({ initial }: { initial: PendingReport[] }) {
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [openSnapshot, setOpenSnapshot] = useState<string | null>(null);

  async function decide(id: string, status: "reviewed" | "dismissed") {
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) setItems((prev) => prev.filter((r) => r._id !== id));
    } finally {
      setBusy(null);
    }
  }

  async function moderateUser(reportId: string, userId: string, action: "warn" | "mute", days?: number) {
    setBusy(reportId);
    try {
      await fetch(`/api/admin/users/${userId}/moderate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, days }),
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card p-5">
      <h2 className="mb-4 text-xl font-semibold">
        İlan / sohbet şikayetleri
        {items.length > 0 && (
          <span className="ml-2 badge border-rose-400/30 bg-rose-500/15 text-rose-300">
            {items.length} açık
          </span>
        )}
      </h2>

      {items.length === 0 ? (
        <p className="text-sm text-slate-500">Açık şikayet yok.</p>
      ) : (
        <div className="space-y-3">
          {items.map((r) => (
            <div key={r._id} className="rounded-xl border border-white/10 p-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link href={`/cars/${r.carId}`} className="truncate font-semibold hover:text-amber-300">
                      {r.carTitle}
                    </Link>
                    <span className="badge">{REASON_LABELS[r.reason] || r.reason}</span>
                    {r.chatSnapshot && <span className="badge border-white/15 bg-white/10 text-slate-300">Sohbet</span>}
                  </div>
                  <p className="text-sm text-slate-400">
                    {r.reporterName} • {new Date(r.createdAt).toLocaleDateString("tr-TR")}
                    {r.reportedUserName && ` • Bildirilen: ${r.reportedUserName}`}
                  </p>
                  {r.note && <p className="mt-1 text-xs text-slate-500">&quot;{r.note}&quot;</p>}
                  {r.chatSnapshot && (
                    <button
                      onClick={() => setOpenSnapshot(openSnapshot === r._id ? null : r._id)}
                      className="mt-1 text-xs text-amber-300 hover:underline"
                    >
                      {openSnapshot === r._id ? "Sohbet özetini gizle ▲" : "Sohbet özetini gör ▼"}
                    </button>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => decide(r._id, "reviewed")}
                    disabled={busy === r._id}
                    className="rounded-lg border border-emerald-400/30 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/10"
                  >
                    İşlem yapıldı
                  </button>
                  <button
                    onClick={() => decide(r._id, "dismissed")}
                    disabled={busy === r._id}
                    className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-white/10"
                  >
                    Reddet
                  </button>
                </div>
              </div>

              {openSnapshot === r._id && r.chatSnapshot && (
                <pre className="mt-3 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg bg-black/30 p-3 text-xs leading-relaxed text-slate-300">
                  {r.chatSnapshot}
                </pre>
              )}

              {r.reportedUserId && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
                  <span className="text-xs text-slate-500">
                    Bildirilen kullanıcı için:
                    {r.reportedUserMuteCount > 0 && (
                      <span className="ml-1 font-semibold text-rose-300">
                        (daha önce {r.reportedUserMuteCount} kez susturuldu
                        {r.reportedUserMuteCount >= 2 ? " — tekrarlayan ihlal, 30 gün düşünebilirsin" : ""})
                      </span>
                    )}
                  </span>
                  <button
                    onClick={() => moderateUser(r._id, r.reportedUserId!, "warn")}
                    disabled={busy === r._id}
                    className="rounded-lg border border-amber-400/30 px-2.5 py-1 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/10"
                  >
                    Uyar
                  </button>
                  {[1, 3, 7, 30].map((days) => (
                    <button
                      key={days}
                      onClick={() => moderateUser(r._id, r.reportedUserId!, "mute", days)}
                      disabled={busy === r._id}
                      className="rounded-lg border border-rose-400/30 px-2.5 py-1 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/10"
                    >
                      {days} gün sustur
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
