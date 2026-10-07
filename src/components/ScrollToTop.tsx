"use client";

import { useLayoutEffect } from "react";

/**
 * İlan sayfası açılınca en üstten başlar. Listede aşağıdayken bir ilana tıklanınca önce kısa yükleme iskeleti
 * (loading.tsx) çiziliyor, tarayıcı kaydırmayı iskeletin sonuna sıkıştırıyordu; asıl içerik gelince sayfa ortadan
 * (Teknik özellikler) açılıyordu. `key` değişince (başka ilan) yeniden çalışır.
 */
export function ScrollToTop({ id }: { id: string }) {
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [id]);
  return null;
}
