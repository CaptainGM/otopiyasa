"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CarThumb } from "@/components/CarThumb";

/**
 * Kart üzerindeki fotoğraf galerisi.
 *
 * - Yatay kaydırma tarayıcının kendi scroll-snap'iyle yapılır: telefonda parmakla sola/sağa
 *   sürükleme akıcı çalışır, JavaScript sürükleme mantığı yok (bu yüzden dikey sayfa
 *   kaydırmasıyla da çakışmaz). Masaüstünde oklar ve izleme dörtgeni/tekerlek kullanılır.
 * - Yalnızca görünen fotoğraf ve komşuları yüklenir; kaydırılmayan fotoğraflar için ağ
 *   isteği atılmaz (liste 48 kartlıkken önceki gibi 48 görsel yüklenir).
 * - İlk ekrandaki kartların ilk fotoğrafı `priority` ile öncelikli yüklenir.
 */
export function CardGallery({
  images,
  alt,
  href,
  maxPhotos = 8,
  priority = false,
}: {
  images: string[];
  alt: string;
  href: string;
  maxPhotos?: number;
  /** İlk ekrandaki kart: ilk fotoğraf gecikmeden ve yüksek öncelikle yüklensin. */
  priority?: boolean;
}) {
  const gallery = useMemo(() => images.filter(Boolean).slice(0, maxPhotos), [images, maxPhotos]);
  const trackRef = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const [index, setIndex] = useState(0);
  // Kaydırılmış/yakındaki fotoğraflar: bir kez yüklenen yeniden boşaltılmaz (titreme olmasın).
  const [warm, setWarm] = useState<ReadonlySet<number>>(() => new Set([0]));

  const warmAround = useCallback(
    (i: number) => {
      setWarm((prev) => {
        const next = new Set(prev);
        for (const k of [i - 1, i, i + 1]) if (k >= 0 && k < gallery.length) next.add(k);
        return next.size === prev.size ? prev : next;
      });
    },
    [gallery.length]
  );

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const onScroll = () => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const el = trackRef.current;
      if (!el || !el.clientWidth) return;
      const i = Math.round(el.scrollLeft / el.clientWidth);
      setIndex(i);
      warmAround(i);
    });
  };

  const goTo = (e: React.MouseEvent, step: number) => {
    e.preventDefault();
    e.stopPropagation();
    const el = trackRef.current;
    if (!el) return;
    const target = (index + step + gallery.length) % gallery.length;
    warmAround(target);
    el.scrollTo({ left: target * el.clientWidth, behavior: "smooth" });
  };

  if (gallery.length === 0) {
    return (
      <Link href={href} prefetch={false} aria-label={`${alt} ilanını aç`} className="absolute inset-0">
        <CarThumb alt={alt} className="object-cover" />
      </Link>
    );
  }

  const many = gallery.length > 1;

  return (
    <div
      className="absolute inset-0"
      // Kullanıcı kartla ilgilenmeye başlayınca bir sonraki fotoğrafı önceden ısıt.
      onPointerEnter={() => many && warmAround(index + 1)}
      onTouchStart={() => many && warmAround(index + 1)}
      onFocus={() => many && warmAround(index + 1)}
    >
      <div
        ref={trackRef}
        onScroll={many ? onScroll : undefined}
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {gallery.map((src, i) => (
          <div key={src} className="relative h-full w-full shrink-0 snap-center snap-always">
            <Link
              href={href}
              prefetch={false}
              tabIndex={i === index ? 0 : -1}
              aria-label={`${alt} ilanını aç${many ? ` (fotoğraf ${i + 1}/${gallery.length})` : ""}`}
              className="absolute inset-0"
              draggable={false}
            >
              {warm.has(i) && (
                <CarThumb
                  src={src}
                  alt={i === 0 ? alt : `${alt} — fotoğraf ${i + 1}`}
                  className="object-cover transition duration-500 group-hover:scale-105"
                  sizes="(max-width: 640px) 128px, (max-width: 1024px) 240px, (max-width: 1280px) 36vw, 480px"
                  priority={priority && i === 0}
                />
              )}
            </Link>
          </div>
        ))}
      </div>

      {many && (
        <>
          <CardArrow side="left" onClick={(e) => goTo(e, -1)} />
          <CardArrow side="right" onClick={(e) => goTo(e, 1)} />
          {/* Konum göstergesi */}
          <div className="pointer-events-none absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1" aria-hidden>
            {gallery.map((src, i) => (
              <span
                key={src}
                className={`h-1.5 rounded-full shadow-sm transition-all ${i === index ? "w-4 bg-white" : "w-1.5 bg-white/55"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CardArrow({ side, onClick }: { side: "left" | "right"; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Önceki fotoğraf" : "Sonraki fotoğraf"}
      className={`absolute top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white transition hover:bg-black/85 focus-visible:opacity-100 sm:flex sm:opacity-0 sm:group-hover:opacity-100 ${
        side === "left" ? "left-2" : "right-2"
      }`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
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
