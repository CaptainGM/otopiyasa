"use client";

import { useEffect } from "react";
import { addRecentlyViewed } from "@/lib/recently-viewed-store";
import { useViewer } from "@/components/useViewer";

/** İlan sayfasında son baktıklara ekler. İstemcideki oturumdan (useViewer) veya varsayılan "guest" olarak kaydeder. */
export function RecentlyViewedTracker({ carId, owner }: { carId: string; owner?: string }) {
  const { viewer } = useViewer();
  const effectiveOwner = owner || viewer?.id || "guest";

  useEffect(() => {
    addRecentlyViewed(carId, effectiveOwner);
  }, [carId, effectiveOwner]);

  return null;
}
