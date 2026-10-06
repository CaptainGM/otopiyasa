"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FallbackImage } from "@/components/FallbackImage";
import type { UnavailableFavorite } from "@/lib/favorites";

/**
 * Favorilenmiş ama artık yayında olmayan ilan: solgun, tıklanamaz kart ("Kaldırıldı" / "Satıldı").
 * Fiyat, açıklama ve bağlantı gösterilmez; kullanıcı yalnızca favoriden çıkarabilir.
 */
export function UnavailableFavoriteCard({ item }: { item: UnavailableFavorite }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      const response = await fetch("/api/favorites", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carId: item._id }),
      });
      if (response.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const label = item.status === "sold" ? "Satıldı" : "İlan kaldırıldı";

  return (
    <article className="card overflow-hidden opacity-80" aria-label={`${item.title} — ${label}`}>
      <div className="relative h-44 w-full bg-slate-900">
        {item.imageUrl ? (
          <FallbackImage src={item.imageUrl} alt={item.title} className="h-full w-full object-cover grayscale" />
        ) : null}
        <span className="absolute left-3 top-3 rounded-lg bg-slate-950/85 px-2.5 py-1 text-xs font-bold text-rose-300">
          {label}
        </span>
      </div>
      <div className="space-y-2 p-4">
        <p className="line-clamp-2 text-sm font-semibold text-slate-300">{item.title}</p>
        <p className="text-xs text-slate-500">
          {item.brand} {item.model} · {item.year}
        </p>
        <p className="text-xs text-slate-500">Bu ilan artık yayında değil; ayrıntıları görüntülenemez.</p>
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-bold text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
        >
          {busy ? "Kaldırılıyor…" : "Favorilerden çıkar"}
        </button>
      </div>
    </article>
  );
}
