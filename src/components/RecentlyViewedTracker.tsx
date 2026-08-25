"use client";

import { useEffect } from "react";
import { addRecentlyViewed } from "@/lib/recently-viewed-store";


export function RecentlyViewedTracker({ carId }: { carId: string }) {
  useEffect(() => {
    addRecentlyViewed(carId);
  }, [carId]);

  return null;
}
