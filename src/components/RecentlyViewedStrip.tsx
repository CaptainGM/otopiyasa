"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CarThumb } from "@/components/CarThumb";
import { DragScroller } from "@/components/DragScroller";
import {
  getRecentlyViewedIds,
  clearRecentlyViewed,
  subscribeRecentlyViewed,
} from "@/lib/recently-viewed-store";
import { formatPrice } from "@/lib/utils";
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
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold tracking-tight">Son baktıkların</h2>
          <span className="badge">{cars.length} araç</span>
        </div>
        <button
          type="button"
          className="text-xs font-medium text-slate-500 transition hover:text-slate-300"
          onClick={() => clearRecentlyViewed()}
        >
          Geçmişi temizle
        </button>
      </div>
      <DragScroller className="flex gap-4 overflow-x-auto pb-2">
        {cars.map((car) => (
          <Link
            key={car._id}
            href={`/cars/${car._id}`}
            className="card group w-60 shrink-0 overflow-hidden transition hover:-translate-y-1"
          >
            <div className="relative h-32 w-full bg-[var(--bg-soft)]">
              <CarThumb
                src={car.imageUrl}
                fallbacks={car.images}
                alt={car.title}
                className="object-cover transition duration-500 group-hover:scale-105"
              />
            </div>
            <div className="space-y-1 p-3">
              <p className="line-clamp-1 text-sm font-semibold">{car.title}</p>
              <p className="text-xs text-slate-500">
                {car.year} • {car.city}
              </p>
              <p className="text-lg font-black text-amber-300">{formatPrice(car.price)}</p>
            </div>
          </Link>
        ))}
      </DragScroller>
    </section>
  );
}
