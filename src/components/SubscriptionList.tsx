"use client";

import { useEffect, useState } from "react";

interface SubscriptionRow {
  _id: string;
  email: string;
  brand?: string | null;
  model?: string | null;
  maxPrice?: number | null;
  targetAvgPrice?: number | null;
}

export function SubscriptionList() {
  const [items, setItems] = useState<SubscriptionRow[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/subscriptions");
      const data = await res.json();
      setItems(data.subscriptions || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function remove(id: string) {
    await fetch("/api/subscriptions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  if (loading) return <p className="text-sm text-slate-500">Yükleniyor…</p>;
  if (items.length === 0) return <p className="text-sm text-slate-500">Henüz abonelik yok.</p>;

  return (
    <div className="space-y-3">
      {items.map((s) => (
        <div key={s._id} className="flex items-center justify-between rounded-xl border border-white/10 p-3">
          <div>
            <p className="font-medium">
              {s.brand || "Tüm markalar"} {s.model ? `- ${s.model}` : ""}
            </p>
            <p className="text-sm text-slate-500">
              {s.email}
              {s.targetAvgPrice
                ? ` • Ortalama ≤ ${s.targetAvgPrice.toLocaleString("tr-TR")} TL olunca haber ver`
                : s.maxPrice
                  ? ` • ${s.maxPrice.toLocaleString("tr-TR")} TL altı yeni ilan`
                  : " • Fiyat sınırlaması yok"}
            </p>
          </div>
          <button
            onClick={() => remove(s._id)}
            className="rounded-lg border border-rose-400/30 px-3 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/10"
          >
            Kaldır
          </button>
        </div>
      ))}
    </div>
  );
}
