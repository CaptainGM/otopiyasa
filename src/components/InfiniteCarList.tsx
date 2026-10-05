"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { CarListItem } from "@/types";
import { CarCard } from "@/components/CarCard";
import { feedBucket, isValidFeedSlot, randomFeedSlot, shuffleInPlace } from "@/lib/car-mix";

const SLOT_KEY = "op_feed_slot";

function readPreviousSlot(): number | undefined {
  try {
    const value = Number(window.localStorage.getItem(SLOT_KEY));
    return isValidFeedSlot(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

function rememberSlot(slot: number) {
  try {
    window.localStorage.setItem(SLOT_KEY, String(slot));
  } catch {
    // gizli sekme vb.: yalnızca "öncekini seçme" kuralı devre dışı kalır
  }
}

/**
 * İlan listesi + sonsuz kaydırma.
 *
 * `feed` (Keşfet, karışık sıra): sunucu herkes için aynı, CDN'de saklanan dilim sayfaları verir
 * (bkz. lib/car-mix.ts FEED_SLOTS); burada her açılışta rastgele bir dilim seçilir ve her sayfa kendi
 * içinde karıştırılır. Böylece farklı tarayıcılar ve her yenileme farklı ilanlar/sıra görür, sunucu
 * yükü ise kullanıcı sayısıyla artmaz. Diğer sıralamalarda (en yeni, fiyat...) ilk sayfa sunucudan gelir.
 */
export function InfiniteCarList({
  initialItems,
  initialPage,
  totalPages,
  total,
  pageSize,
  query,
  feed = false,
}: {
  initialItems: CarListItem[];
  initialPage: number;
  totalPages: number;
  total: number;
  pageSize: number;
  query: string;
  feed?: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [page, setPage] = useState(feed ? 0 : initialPage);
  const [loading, setLoading] = useState(feed);
  const [error, setError] = useState("");
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const activeQueryRef = useRef(query);

  // Tarayıcı yenilemesinde sayfanın altına değil başa dön (yeni akış baştan görünsün).
  useLayoutEffect(() => {
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (navigation?.type !== "reload") return;
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);

  const fetchPage = useCallback(
    async (pageNumber: number): Promise<CarListItem[]> => {
      const params = new URLSearchParams(activeQueryRef.current);
      params.set("page", String(pageNumber));
      params.set("limit", String(pageSize));
      params.set("compact", "1");
      const response = await fetch(`/api/cars?${params.toString()}`);
      if (!response.ok) throw new Error("İlanlar yüklenemedi. Yeniden deneyin.");
      const data = (await response.json()) as { items?: CarListItem[] };
      const list = Array.isArray(data.items) ? data.items : [];
      return feed ? shuffleInPlace([...list]) : list;
    },
    [feed, pageSize]
  );

  // Filtre/sorgu değişince (ve Keşfet'in ilk açılışında) listeyi baştan kur.
  useEffect(() => {
    let cancelled = false;
    setError("");
    if (!feed) {
      activeQueryRef.current = query;
      setItems(initialItems);
      setPage(initialPage);
      setLoading(false);
      return;
    }

    const slot = randomFeedSlot(readPreviousSlot());
    rememberSlot(slot);
    const params = new URLSearchParams(query);
    params.delete("seed");
    params.set("slot", String(slot));
    params.set("b", String(feedBucket()));
    activeQueryRef.current = params.toString();

    loadingRef.current = true;
    setLoading(true);
    setItems([]);
    fetchPage(1)
      .then((list) => {
        if (cancelled) return;
        setItems(list);
        setPage(1);
      })
      .catch((cause) => !cancelled && setError(cause instanceof Error ? cause.message : "İlanlar yüklenemedi."))
      .finally(() => {
        loadingRef.current = false;
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [feed, fetchPage, initialItems, initialPage, query]);

  const loadNextPage = useCallback(async () => {
    if (loadingRef.current || page >= totalPages) return;
    loadingRef.current = true;
    setLoading(true);
    setError("");
    try {
      const nextItems = await fetchPage(page + 1);
      setItems((current) => {
        const known = new Set(current.map((car) => car._id));
        return [...current, ...nextItems.filter((car) => !known.has(car._id))];
      });
      setPage((current) => current + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "İlanlar yüklenemedi.");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [fetchPage, page, totalPages]);

  useEffect(() => {
    const target = sentinelRef.current;
    if (!target || page === 0 || page >= totalPages) return;
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
        {items.map((car, i) => <CarCard key={car._id} car={car} priority={i < 3} />)}
      </div>
      {page === 0 || page < totalPages ? (
        <div ref={sentinelRef} className="flex min-h-16 flex-col items-center justify-center gap-2 py-3">
          {loading && <><span className="h-5 w-5 animate-spin rounded-full border-2 border-amber-300 border-t-transparent" aria-hidden /><span className="text-sm text-slate-400">{page === 0 ? "İlanlar yükleniyor…" : "Daha fazla ilan yükleniyor…"}</span></>}
          {error && <><p role="alert" className="text-sm text-rose-300">{error}</p><button type="button" onClick={() => void (page === 0 ? window.location.reload() : loadNextPage())} className="btn btn-secondary text-sm">Yeniden dene</button></>}
          {!loading && !error && page > 0 && <button type="button" onClick={() => void loadNextPage()} className="btn btn-secondary text-sm">Daha fazla ilan göster</button>}
        </div>
      ) : <p className="py-4 text-center text-sm text-slate-500">{items.length < total ? `${items.length} / ${total} ilan yüklendi` : "Tüm ilanlar yüklendi"}</p>}
    </div>
  );
}
