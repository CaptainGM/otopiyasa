"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cardImageUrl, imageCandidates, sanitizeImageUrl } from "@/lib/image-url";
import { CarThumb, CarThumbPlaceholder } from "@/components/CarThumb";
import { FallbackImage } from "@/components/FallbackImage";
import { Lightbox } from "@/components/Lightbox";

/**
 * Galerideki ana görsel ve komşu ön yükleme aynı adresi kullanır. Arabam'da 580x435 varyantı (~50 KB): 800x600 (~80 KB) ve
 * orijinal dosyalar (250–400 KB) ölçümde bazen 10 saniyeye kadar bekledi; küçük resimler de ana görseli kuyrukta bekletiyordu.
 */
const MAIN_IMAGE_SIZE = "580x435";

export function CarGallery({ images, title }: { images: string[]; title: string }) {
  const gallery = images.filter(Boolean);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const touchX = useRef<number | null>(null);
  const swiped = useRef(false);

  const show = useCallback(
    (index: number) => {
      const count = gallery.length;
      if (count === 0) return;
      setActiveIndex(((index % count) + count) % count); // sarmalayan (wrap) indeks
    },
    [gallery.length]
  );

  // Komşu fotoğrafları önceden indir: ok/kaydırma sonrası görsel beklemesin.
  useEffect(() => {
    const n = gallery.length;
    if (n < 2) return;
    for (const k of [activeIndex + 1, activeIndex - 1]) {
      const src = gallery[((k % n) + n) % n];
      if (!src) continue;
      const img = new Image();
      img.referrerPolicy = "no-referrer";
      // Önceden indirilen adres, ekranda gösterilenle aynı olmalı; yoksa ön yükleme boşa gider.
      img.src = sanitizeImageUrl(imageCandidates(src, [], 1, MAIN_IMAGE_SIZE)[0]);
    }
  }, [activeIndex, gallery]);

  if (gallery.length === 0) return null;

  const visibleThumbs = showAll ? gallery : gallery.slice(0, 7);
  const hiddenCount = gallery.length - visibleThumbs.length;

  return (
    <div className="self-start">
      <div className="card group relative h-[420px] w-full overflow-hidden">
        {/* Ana görsele tıklayınca tam ekran (lightbox) açılır */}
        {/* Telefonda sola/sağa kaydırarak fotoğraf değiştirilir (eşik 45 px). */}
        <button
          type="button"
          onClick={() => {
            if (swiped.current) {
              swiped.current = false;
              return;
            }
            setLightbox(true);
          }}
          onTouchStart={(e) => {
            touchX.current = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            const start = touchX.current;
            touchX.current = null;
            if (start === null || gallery.length < 2) return;
            const delta = e.changedTouches[0].clientX - start;
            if (Math.abs(delta) > 45) {
              swiped.current = true;
              show(activeIndex + (delta < 0 ? 1 : -1));
            }
          }}
          aria-label="Fotoğrafı tam ekran gör"
          className="relative block h-full w-full cursor-zoom-in touch-pan-y"
        >
          {/* Yüklenene kadar koyu boşluk yerine hafif iskelet; görsel gelince üstünü kapatır. */}
          <span aria-hidden className="absolute inset-0 animate-pulse bg-white/[0.04]" />
          {/* Ana görsel her zaman öncelikli: önceki fotoğraf, yeni gelene kadar ekranda kalır (bileşen yeniden kurulmaz). */}
          <CarThumb
            src={gallery[activeIndex]}
            alt={`${title} ${activeIndex + 1}`}
            className="object-cover transition group-hover:scale-[1.02]"
            preferSize={MAIN_IMAGE_SIZE}
            priority
          />
          <span className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white opacity-0 transition group-hover:opacity-100">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Büyüt
          </span>
        </button>

      
        {gallery.length > 1 && (
          <>
            <GalleryArrow side="left" onClick={() => show(activeIndex - 1)} />
            <GalleryArrow side="right" onClick={() => show(activeIndex + 1)} />
            <span className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-bold tabular-nums text-white">
              {activeIndex + 1} / {gallery.length}
            </span>
          </>
        )}
      </div>

      {gallery.length > 1 && (
        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
          {visibleThumbs.map((img, i) => (
            <button
              key={img + i}
              type="button"
              onClick={() => setActiveIndex(i)}
              aria-label={`${i + 1}. fotoğrafı göster`}
              className={`relative h-20 w-full overflow-hidden rounded-lg border transition ${
                i === activeIndex
                  ? "border-amber-400 ring-2 ring-amber-400/40"
                  : "border-white/10 hover:border-white/30"
              }`}
            >
              {/* Küçük resim küçük varyantı çeker (tam boyut değil); olmazsa orijinal adres yedek. */}
              <FallbackImage
                src={cardImageUrl(img)}
                fallbacks={[img]}
                alt={`${title} ${i + 1}`}
                className="h-full w-full object-cover"
                fallback={<CarThumbPlaceholder />}
              />
            </button>
          ))}
          {!showAll && hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="relative flex h-20 w-full items-center justify-center rounded-lg border border-white/10 bg-white/5 text-sm font-semibold text-slate-300 transition hover:bg-white/10"
            >
              +{hiddenCount}
            </button>
          )}
        </div>
      )}

      {lightbox && (
        <Lightbox
          images={gallery}
          title={title}
          index={activeIndex}
          onIndexChange={setActiveIndex}
          onClose={() => setLightbox(false)}
        />
      )}
    </div>
  );
}

function GalleryArrow({
  side,
  onClick,
}: {
  side: "left" | "right";
  onClick: () => void;
}) {
  
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Önceki fotoğraf" : "Sonraki fotoğraf"}
      className={`absolute top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white transition hover:bg-black/85 focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 ${
        side === "left" ? "left-3" : "right-3"
      }`}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d={side === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
