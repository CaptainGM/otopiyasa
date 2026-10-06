"use client";

import { useEffect, useState } from "react";
import { CarStrip, MiniCarCard } from "@/components/CarStrip";
import {
  getRecentlyViewedIds,
  clearRecentlyViewed,
  subscribeRecentlyViewed,
} from "@/lib/recently-viewed-store";
import type { Car } from "@/types";

export function RecentlyViewedStrip() {
  const [cars, setCars] = useState<Car[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const ids = getRecentlyViewedIds();
      if (ids.length === 0) {
        if (!cancelled) setCars([]);
        return;
      }
      try {
        const res = await fetch(`/api/cars/by-ids?ids=${ids.join(",")}`);
        const data = await res.json();
        if (!cancelled) setCars(Array.isArray(data.items) ? data.items : []);
      } catch {
        if (!cancelled) setCars([]);
      }
    }

    load();
    const unsubscribe = subscribeRecentlyViewed(load);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

 
  if (!cars || cars.length === 0) return null;

  return (
    <CarStrip
      eyebrow={`Geçmiş · ${cars.length} ilan`}
      title="Son baktıkların"
      aside={
        <button type="button" className="btn btn-ghost text-xs" onClick={() => clearRecentlyViewed()}>
          Geçmişi temizle
        </button>
      }
    >
      {cars.map((car) => (
        <MiniCarCard key={car._id} car={car} />
      ))}
    </CarStrip>
  );
}
