"use client";

import { useState } from "react";

interface PendingBusiness {
  _id: string;
  name: string;
  email: string;
  businessName: string;
  businessPhone: string;
}


export function BusinessApprovals({ initial }: { initial: PendingBusiness[] }) {
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function decide(userId: string, approve: boolean) {
    let reason = "";
    if (!approve) {
      reason = prompt("Red sebebi (kullanıcıya iletilir):") || "";
      if (reason === "") return; // iptal
    }
    setBusy(userId);
    try {
      const res = await fetch("/api/admin/business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, approve, reason }),
      });
      if (res.ok) setItems((prev) => prev.filter((u) => u._id !== userId));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card p-5">
      <h2 className="mb-4 text-xl font-semibold">
        İşletme başvuruları
        {items.length > 0 && (
          <span className="ml-2 badge border-amber-400/30 bg-amber-500/15 text-amber-300">
            {items.length} bekliyor
          </span>
        )}
      </h2>

      {items.length === 0 ? (
        <p className="text-sm text-slate-500">Bekleyen işletme başvurusu yok.</p>
      ) : (
        <div className="space-y-3">
          {items.map((u) => (
            <div key={u._id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 p-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{u.businessName || "(firma adı yok)"}</p>
                <p className="text-sm text-slate-400">
                  {u.name} • {u.email} • {u.businessPhone}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => decide(u._id, true)}
                  disabled={busy === u._id}
                  className="rounded-lg border border-emerald-400/30 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/10"
                >
                  Onayla
                </button>
                <button
                  onClick={() => decide(u._id, false)}
                  disabled={busy === u._id}
                  className="rounded-lg border border-rose-400/30 px-3 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/10"
                >
                  Reddet
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
