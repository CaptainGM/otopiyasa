"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export function VisitorTracker() {
  const pathname = usePathname();
  const lastPath = useRef<string>("");

  useEffect(() => {
    if (!pathname) return;
    // Yönetim paneli, API veya dahili yolları sayma
    if (pathname.startsWith("/admin") || pathname.startsWith("/api")) return;
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;

    // Sayfa geçişlerini ve ilk render'ı asla bekletmemek için boş zaman (idle) veya gecikmeli çalıştır:
    const timer = setTimeout(() => {
      try {
        const payload = JSON.stringify({
          path: pathname,
          referrer: typeof document !== "undefined" ? document.referrer : "",
        });

        if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
          const blob = new Blob([payload], { type: "application/json" });
          navigator.sendBeacon("/api/stats/visit", blob);
        } else {
          fetch("/api/stats/visit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
            keepalive: true,
          }).catch(() => {});
        }
      } catch {
        // Hata durumunda kullanıcı deneyimini asla etkileme
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [pathname]);

  return null;
}
