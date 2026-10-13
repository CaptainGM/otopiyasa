"use client";

import dynamic from "next/dynamic";

/**
 * Asistan balonu ilk boyamada gerekmez: kendi parçasıyla, sayfa yüklendikten sonra gelir. Böylece ilk JavaScript paketi küçülür
 * ve ilk ilan kartları daha önce çizilir (ilk ziyarette sayfanın hızlı açılması için).
 */
export const ChatWidgetLazy = dynamic(() => import("@/components/ChatWidget").then((m) => m.ChatWidget), { ssr: false });
