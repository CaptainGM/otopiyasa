"use client";

import { useEffect } from "react";
import { addRecentlyViewed } from "@/lib/recently-viewed-store";

/** İlan sayfasında son baktıklara ekler. owner sunucudan gelir (giriş yapmış kullanıcı kimliği ya da "guest"). */
export function RecentlyViewedTracker({ carId, owner }: { carId: string; owner: string }) {
  useEffect(() => {
    addRecentlyViewed(carId, owner);
  }, [carId, owner]);

  return null;
}
