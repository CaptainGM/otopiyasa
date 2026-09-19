"use client";

import { FallbackImage } from "@/components/FallbackImage";
import { CARD_IMAGE_SIZE } from "@/lib/image-url";


export const CAR_PLACEHOLDER_SRC =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='320' height='180'><rect width='100%' height='100%' fill='#141922'/><text x='50%' y='50%' fill='#5b6472' font-family='sans-serif' font-size='14' text-anchor='middle' dominant-baseline='middle'>Görsel yok</text></svg>`
  );

export function CarThumbPlaceholder() {
  return (
    <div className="absolute inset-0 flex h-full w-full flex-col items-center justify-center gap-1 bg-[var(--bg-soft)] text-slate-600">
      <svg width="42" height="42" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M5 11l1.5-4A2 2 0 018.4 6h7.2a2 2 0 011.9 1.4L19 11m-14 0h14m-14 0a2 2 0 00-2 2v3h2m14-5a2 2 0 012 2v3h-2m-2 0H7m10 0a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0m-7 0a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-[11px] font-medium">Görsel yok</span>
    </div>
  );
}


export function CarThumb({
  src,
  alt,
  className,
  fallbacks = [],
}: {
  src?: string;
  alt: string;
  
  sizes?: string;
  className?: string;
 
  fallbacks?: string[];
}) {
  return (
    <FallbackImage
      src={src}
      fallbacks={fallbacks}
      alt={alt}
      className={`absolute inset-0 h-full w-full ${className || ""}`}
      fallback={<CarThumbPlaceholder />}
   
      preferSize={CARD_IMAGE_SIZE}
    />
  );
}
