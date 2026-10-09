"use client";

import { useEffect, useState } from "react";

/** Yönetim panelinin yan sütunları ana içeriğin yanındaki boş kenara ancak bu genişlikte sığar (1440 px içerik + iki yanda 340 px). */
export const WIDE_SCREEN_PX = 2160;

export function useWideScreen(): boolean {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${WIDE_SCREEN_PX}px)`);
    const update = () => setWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return wide;
}
