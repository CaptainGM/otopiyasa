"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { CarListItem } from "@/types";
import { CarCard } from "@/components/CarCard";
import { feedBucket, isValidFeedSlot, randomFeedSlot, shuffleInPlace } from "@/lib/car-mix";
import { feedPageQuery, feedSliceQuery } from "@/lib/feed-url";

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

/** İlk yükleme sırasında kartların yerini tutar: boş ekran yerine sayfanın dolduğunu gösterir. */
function CarCardSkeleton() {
  return (
    <div className="card overflow-hidden" aria-hidden>
      <div className="aspect-[16/10] animate-pulse bg-white/5" />
      <div className="space-y-3 p-4">
        <div className="h-3 w-1/3 animate-pulse rounded bg-white/10" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-white/10" />
        <div className="h-3 w-full animate-pulse rounded bg-white/5" />
        <div className="h-6 w-1/2 animate-pulse rounded bg-white/10" />
      </div>
    </div>
  );
}

/**
 * İlan listesi + sonsuz kaydırma.
 *
 * `feed` (Keşfet, karışık sıra, yalnızca filtresiz açılış): sunucu herkes için aynı, CDN'de saklanan dilim sayfaları verir
 * (bkz. lib/car-mix.ts FEED_SLOTS); burada her açılışta rastgele bir dilim seçilir ve her sayfa kendi
 * içinde karıştırılır. Böylece farklı tarayıcılar ve her yenileme farklı ilanlar/sıra görür, sunucu
 * yükü ise kullanıcı sayısıyla artmaz. Diğer durumlarda (arama, filtre, en yeni, fiyat...) ilk sayfa sunucudan gelir.
 */
export function InfiniteCarList({
  initialItems,
  initialPage,
  totalPages,
  total,
  pageSize,
  query,
  feed = false,
  feedStart,
}: {
  initialItems: CarListItem[];
  initialPage: number;
  totalPages: number;
  total: number;
  pageSize: number;
  query: string;
  feed?: boolean;
  /** Keşfet'in sunucuda hazır ilk dilimi ve dönemi (bkz. page.tsx): bu dilim ağ isteği olmadan gösterilir. */
  feedStart?: { slot: number; bucket: number };
}) {
  const feedStartSlot = feedStart?.slot;
  const feedStartBucket = feedStart?.bucket;
  const [items, setItems] = useState(initialItems);
  const [page, setPage] = useState(initialPage);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const activeQueryRef = useRef(query);
  // Sunucudan gelen ilk sayfa: dizinin kimliği üst bileşen her çizildiğinde değişebilir. Efektin bağımlılığı olsaydı liste her seferinde
  // boşalıp yeniden yüklenirdi ("0 / 6 ilan yüklendi"de takılma); bu yüzden ref'te tutulur, yalnızca sorgu/sayfa değişince okunur.
  const initialItemsRef = useRef(initialItems);
  initialItemsRef.current = initialItems;

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
      // Adres lib/feed-url.ts ile kurulur: VM'deki ısıtıcı (lib/feed-warm.ts) CDN'e aynı adresi koyar, parametre sırası birebir aynı olmalı.
      const response = await fetch(`/api/cars?${feedPageQuery(activeQueryRef.current, pageNumber, pageSize)}`);
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
      setItems(initialItemsRef.current);
      setPage(initialPage);
      setLoading(false);
      return;
    }

    // Bu dönemin ilk açılışı: sunucunun hazırladığı ilk sayfa zaten ekranda, ağ isteği yok. Aynı dönemde yenilemede (önceki dilim
    // bu) istemci başka bir dilim seçip yükler; böylece her yenileme farklı ilanları gösterir.
    // Sunucudan dolu gelen ilk sayfa: ekrandaki ilanlari bosaltip tekrar ag istegi atmiyoruz.
    // Bu sayede Kesfet veya sayfa gecislerinde ekran asla bosalmaz, gecikme (delay) yasanmaz.
    const previousSlot = readPreviousSlot();

    // Sunucudan gelen dilim daha önce gördüğümüz dilimden farklıysa (ilk ziyaret veya sunucu yeni rastgele dilim verdiyse):
    // HTML'deki ilk 24 ilanı doğrudan gösterir, fazladan ağ isteği atmaz (0ms açılış).
    if (
      feedStartSlot !== undefined &&
      previousSlot !== feedStartSlot &&
      initialItemsRef.current &&
      initialItemsRef.current.length > 0
    ) {
      rememberSlot(feedStartSlot);
      activeQueryRef.current = feedSliceQuery(query, feedStartSlot, feedStartBucket ?? feedBucket());
      setItems(initialItemsRef.current);
      setPage(initialPage || 1);
      setLoading(false);
      return;
    }

    // Kullanıcı F5 ile sayfayı yenilediğinde veya aynı dilim önbellekten geldiğinde:
    // Hemen bir önceki dilimden farklı rastgele yeni bir dilim seçilir ve farklı ilanlar anında ekrana gelir!
    const slot = randomFeedSlot(previousSlot ?? feedStartSlot);
    rememberSlot(slot);
    activeQueryRef.current = feedSliceQuery(query, slot, feedBucket());

    loadingRef.current = true;
    setLoading(true);
    setItems([]);
    setPage(0);
    fetchPage(1)
      .then((list) => {
        if (cancelled) return;
        setItems(list);
        setPage(1);
      })
      .catch((cause) => !cancelled && setError(cause instanceof Error ? cause.message : "İlanlar yüklenemedi."))
      .finally(() => {
        // İptal edilmiş (yerini yenisi almış) isteğin sonucu, yeni isteğin yükleme kilidini açmamalı.
        if (cancelled) return;
        loadingRef.current = false;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [feed, fetchPage, feedStartSlot, feedStartBucket, initialPage, query]);

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

  const retry = () => void (page === 0 ? window.location.reload() : loadNextPage());
  const errorBlock = error ? (
    <>
      <p role="alert" className="text-sm text-rose-300">{error}</p>
      <button type="button" onClick={retry} className="btn btn-secondary text-sm">Yeniden dene</button>
    </>
  ) : null;
  const exhausted = page > 0 && page >= totalPages;
  const showSkeleton = items.length === 0 && !error && (loading || page === 0);

  return (
    <div className="space-y-4">
      <div className="listing-grid" aria-live="polite" aria-busy={loading}>
        {items.map((car, i) => <CarCard key={car._id} car={car} priority={i < 4} />)}
        {showSkeleton && Array.from({ length: Math.min(pageSize, 8) }, (_, i) => <CarCardSkeleton key={`skeleton-${i}`} />)}
      </div>
      {!exhausted ? (
        <div ref={sentinelRef} className="flex min-h-16 flex-col items-center justify-center gap-2 py-3">
          {loading && (
            <>
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-amber-300 border-t-transparent" aria-hidden />
              <span className="text-sm text-slate-400">{items.length === 0 ? "İlanlar yükleniyor…" : "Daha fazla ilan yükleniyor…"}</span>
            </>
          )}
          {errorBlock}
          {!loading && !error && page > 0 && <button type="button" onClick={() => void loadNextPage()} className="btn btn-secondary text-sm">Daha fazla ilan göster</button>}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 py-4 text-center">
          {errorBlock}
          {!error && items.length === 0 && total > 0 && (
            <>
              <p className="text-sm text-slate-400">İlanlar şu an yüklenemedi.</p>
              <button type="button" onClick={retry} className="btn btn-secondary text-sm">Yeniden dene</button>
            </>
          )}
          {!error && (items.length > 0 || total === 0) && (
            <p className="text-sm text-slate-500">{items.length < total ? `${items.length} / ${total} ilan gösteriliyor` : "Tüm ilanlar yüklendi"}</p>
          )}
        </div>
      )}
    </div>
  );
}
