"use client";

import { useEffect, useState } from "react";
import { CarStrip, MiniCarCard } from "@/components/CarStrip";
import {
  getRecentlyViewedIds,
  clearRecentlyViewed,
  subscribeRecentlyViewed,
} from "@/lib/recently-viewed-store";
import type { Car } from "@/types";

/**
 * Son baktıklar şeridi. Ana sayfa önbelleklidir (ISR), bu yüzden kullanıcı sunucuda değil istemcide çözülür:
 * oturum açıksa kendi listesi, değilse misafir listesi gösterilir. Hesap çözülene kadar hiçbir şey çizilmez.
 */
export function RecentlyViewedStrip() {
  const [owner, setOwner] = useState<string | null>(null);
  const [cars, setCars] = useState<Car[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data: { user?: { _id?: string } | null }) => {
        if (!cancelled) setOwner(data.user?._id ? String(data.user._id) : "guest");
      })
      .catch(() => {
        if (!cancelled) setOwner("guest");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (owner === null) return;
    let cancelled = false;
    setCars(null); // Hesap değişince önceki hesabın kartları bir an bile görünmesin.

    async function load() {
      const ids = getRecentlyViewedIds(owner as string);
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
  }, [owner]);

  if (owner === null || !cars || cars.length === 0) return null;

  return (
    <CarStrip
      eyebrow={`Geçmiş · ${cars.length} ilan`}
      title="Son baktıkların"
      aside={
        <button type="button" className="btn btn-ghost text-xs" onClick={() => clearRecentlyViewed(owner)}>
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
