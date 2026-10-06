"use client";

import { useEffect, useRef } from "react";

/**
 * Sekme görünürken belirli aralıkla çalışan yoklama. Arka plandaki sekme istek atmaz; sekmeye dönülünce hemen bir kez
 * çalışıp aralığa devam eder. Açık unutulan bir yönetim sekmesi 25 saniyede bir istekle ayda ~100 bin Vercel fonksiyon
 * çağrısı harcıyordu (ücretsiz plan sınırı 1 milyon).
 */
export function useVisibleInterval(callback: () => unknown, ms: number) {
  const saved = useRef(callback);
  saved.current = callback;

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer) return;
      timer = setInterval(() => void saved.current(), ms);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        void saved.current();
        start();
      }
    };
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [ms]);
}
