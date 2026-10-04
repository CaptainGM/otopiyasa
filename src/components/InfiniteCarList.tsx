"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { CarListItem } from "@/types";
import { CarCard } from "@/components/CarCard";
import { FEED_SEED_COOKIE, FEED_SEED_POOL, randomFeedSeed } from "@/lib/car-mix";

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
  const activeQueryRef = useRef(query);
  const previousQueryRef = useRef(query);
  const initializedFeedRef = useRef(false);

  useLayoutEffect(() => {
    const navigation = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    if (navigation?.type !== "reload") return;

    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
    return () => {
      window.history.scrollRestoration = previousRestoration;
    };
  }, []);

  useEffect(() => {
    if (initializedFeedRef.current) {
      if (previousQueryRef.current !== query) {
        previousQueryRef.current = query;
        activeQueryRef.current = query;
        setItems(initialItems);
        setPage(initialPage);
        setError("");
        const nextSeed = Number(new URLSearchParams(query).get("seed"));
        if (Number.isInteger(nextSeed) && nextSeed >= 1 && nextSeed <= FEED_SEED_POOL) {
          const secure = window.location.protocol === "https:" ? "; Secure" : "";
          document.cookie = `${FEED_SEED_COOKIE}=${nextSeed}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax${secure}`;
        }
      }
      return;
    }

    const params = new URLSearchParams(query);
    const seedValue = params.get("seed");
    const serverSeed = Number(seedValue);
    if (!seedValue || !Number.isInteger(serverSeed) || serverSeed < 1 || serverSeed > FEED_SEED_POOL) return;

    const previousSeedValue = document.cookie
      .split("; ")
      .find((cookie) => cookie.startsWith(`${FEED_SEED_COOKIE}=`))
      ?.slice(FEED_SEED_COOKIE.length + 1);
    const previousSeed = Number(previousSeedValue);
    const hasPreviousSeed = Number.isInteger(previousSeed) && previousSeed >= 1 && previousSeed <= FEED_SEED_POOL;
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const isRefresh =
      !initializedFeedRef.current && navigation?.type === "reload" && hasPreviousSeed;
    initializedFeedRef.current = true;
    previousQueryRef.current = query;

    const seed = isRefresh ? randomFeedSeed(previousSeed) : serverSeed;
    params.set("seed", String(seed));
    params.delete("page");
    activeQueryRef.current = params.toString();

    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${FEED_SEED_COOKIE}=${seed}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax${secure}`;

    const url = new URL(window.location.href);
    if (url.searchParams.has("seed")) {
      url.searchParams.delete("seed");
      const search = url.searchParams.toString();
      window.history.replaceState(
        window.history.state,
        "",
        `${url.pathname}${search ? `?${search}` : ""}${url.hash}`
      );
    }

    if (isRefresh) {
      const refreshParams = new URLSearchParams(activeQueryRef.current);
      refreshParams.set("page", "1");
      refreshParams.set("limit", String(pageSize));
      refreshParams.set("compact", "1");
      loadingRef.current = true;
      setLoading(true);
      setError("");
      void fetch(`/api/cars?${refreshParams.toString()}`, { credentials: "same-origin" })
        .then(async (response) => {
          if (!response.ok) throw new Error("Yeni ilan sıralaması yüklenemedi.");
          return (await response.json()) as { items?: CarListItem[]; page?: number };
        })
        .then((data) => {
          setItems(Array.isArray(data.items) ? data.items : []);
          setPage(data.page || 1);
        })
        .catch((cause) => setError(cause instanceof Error ? cause.message : "İlanlar yüklenemedi."))
        .finally(() => {
          loadingRef.current = false;
          setLoading(false);
        });
    }
  }, [initialItems, initialPage, pageSize, query]);

  const loadNextPage = useCallback(async () => {
    if (loadingRef.current || page >= totalPages) return;
    loadingRef.current = true;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams(activeQueryRef.current);
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
  }, [page, pageSize, totalPages]);

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
        {items.map((car, i) => <CarCard key={car._id} car={car} priority={i < 3} />)}
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
