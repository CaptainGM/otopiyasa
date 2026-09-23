"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CarListItem } from "@/types";
import { CarCard } from "@/components/CarCard";

export function InfiniteCarList({
  initialItems,
  initialPage,
  totalPages,
  total,
  pageSize,
  query,
}: {
  initialItems: CarListItem[];
  initialPage: number;
  totalPages: number;
  total: number;
  pageSize: number;
  query: string;
}) {
  const [items, setItems] = useState(initialItems);
  const [page, setPage] = useState(initialPage);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const loadNextPage = useCallback(async () => {
    if (loadingRef.current || page >= totalPages) return;
    loadingRef.current = true;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams(query);
      params.set("page", String(page + 1));
      params.set("limit", String(pageSize));
      params.set("compact", "1");
      const response = await fetch(`/api/cars?${params.toString()}`, { credentials: "same-origin" });
      if (!response.ok) throw new Error("İlanlar yüklenemedi. Yeniden deneyin.");
      const data = (await response.json()) as { items?: CarListItem[] };
      const nextItems = Array.isArray(data.items) ? data.items : [];
      setItems((current) => {
        const knownIds = new Set(current.map((car) => car._id));
        return [...current, ...nextItems.filter((car) => !knownIds.has(car._id))];
      });
      setPage((current) => current + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "İlanlar yüklenemedi.");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [page, pageSize, query, totalPages]);

  useEffect(() => {
    const target = sentinelRef.current;
    if (!target || page >= totalPages) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadNextPage();
      },
      { rootMargin: "800px 0px" }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [loadNextPage, page, totalPages]);

  return (
    <div className="space-y-3">
      <p className="text-right text-xs text-slate-500" aria-live="polite">{items.length} / {total} ilan yüklendi</p>
      <div className="space-y-2" aria-live="polite">
        {items.map((car) => <CarCard key={car._id} car={car} />)}
      </div>
      {page < totalPages ? (
        <div ref={sentinelRef} className="flex min-h-16 flex-col items-center justify-center gap-2 py-3">
          {loading && <><span className="h-5 w-5 animate-spin rounded-full border-2 border-amber-300 border-t-transparent" aria-hidden /><span className="text-sm text-slate-400">Daha fazla ilan yükleniyor…</span></>}
          {error && <><p role="alert" className="text-sm text-rose-300">{error}</p><button type="button" onClick={() => void loadNextPage()} className="btn btn-secondary text-sm">Yeniden dene</button></>}
          {!loading && !error && <button type="button" onClick={() => void loadNextPage()} className="btn btn-secondary text-sm">Daha fazla ilan göster</button>}
        </div>
      ) : <p className="py-4 text-center text-sm text-slate-500">{items.length < total ? `${items.length} / ${total} ilan yüklendi` : "Tüm ilanlar yüklendi"}</p>}
    </div>
  );
}
