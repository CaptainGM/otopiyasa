"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { imageCandidates } from "@/lib/image-url";
import { CarThumbPlaceholder } from "@/components/CarThumb";
import { FallbackImage } from "@/components/FallbackImage";


export function Lightbox({
  images,
  title,
  index,
  onIndexChange,
  onClose,
}: {
  images: string[];
  title: string;
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const count = images.length;

  useEffect(() => setMounted(true), []);

  const go = useCallback(
    (next: number) => {
      if (count > 0) onIndexChange(((next % count) + count) % count);
    },
    [count, onIndexChange]
  );


  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(index + 1);
      else if (e.key === "ArrowLeft") go(index - 1);
      else if (e.key === "Home") go(0);
      else if (e.key === "End") go(count - 1);
      else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [index, count, go, onClose]);


  useEffect(() => {
    stripRef.current
      ?.querySelector<HTMLElement>(`[data-thumb="${index}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [index]);


  useEffect(() => {
    if (count < 2) return;
    for (const offset of [1, -1]) {
      const url = images[((index + offset) % count + count) % count];
      const preload = new Image();
      preload.src = imageCandidates(url)[0] || url;
    }
  }, [index, images, count]);

  if (!mounted || count === 0) return null;

  const stop = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[999] flex flex-col bg-[#05070c]/97 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={`${title} — fotoğraf ${index + 1}/${count}`}
      onClick={(e) => {
        stop(e);
        onClose();
      }}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        const start = touchStartX.current;
        touchStartX.current = null;
        if (start === null) return;
        const delta = e.changedTouches[0].clientX - start;
        if (Math.abs(delta) > 45) go(delta < 0 ? index + 1 : index - 1);
      }}
    >
    
      <div
        className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-3"
        onClick={stop}
      >
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white sm:text-base">
          {title}
        </p>
        <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs font-bold tabular-nums text-white">
          {index + 1} / {count}
        </span>
        <button
          type="button"
          onClick={(e) => {
            stop(e);
            onClose();
          }}
          aria-label="Kapat"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-xl text-white transition hover:bg-white/25"
        >
          ✕
        </button>
      </div>

      
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 py-3 sm:px-16">
        
        <LightboxImage
          key={images[index]}
          src={images[index]}
          alt={`${title} — fotoğraf ${index + 1}`}
          onClick={stop}
        />

        {count > 1 && (
          <>
            <NavArrow side="left" onClick={(e) => { stop(e); go(index - 1); }} />
            <NavArrow side="right" onClick={(e) => { stop(e); go(index + 1); }} />
          </>
        )}
      </div>

      
      {count > 1 && (
        <div
          ref={stripRef}
          onClick={stop}
          className="flex shrink-0 gap-2 overflow-x-auto border-t border-white/10 px-3 py-3 [scrollbar-width:thin]"
        >
          {images.map((img, i) => (
            <button
              key={img + i}
              type="button"
              data-thumb={i}
              onClick={(e) => {
                stop(e);
                go(i);
              }}
              aria-label={`${i + 1}. fotoğrafa git`}
              aria-current={i === index}
              className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-md border-2 transition sm:h-16 sm:w-24 ${
                i === index
                  ? "border-amber-400 opacity-100"
                  : "border-transparent opacity-55 hover:opacity-90"
              }`}
            >
              <FallbackImage
                src={img}
                alt=""
                className="h-full w-full object-cover"
                fallback={<CarThumbPlaceholder />}
              />
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body
  );
}

function NavArrow({
  side,
  onClick,
}: {
  side: "left" | "right";
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Önceki fotoğraf" : "Sonraki fotoğraf"}
      className={`absolute top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white transition hover:bg-black/85 sm:h-14 sm:w-14 ${
        side === "left" ? "left-2 sm:left-4" : "right-2 sm:right-4"
      }`}
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
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


const MAX_ZOOM = 4;


function LightboxImage({
  src,
  alt,
  onClick,
}: {
  src: string;
  alt: string;
  onClick: (e: React.MouseEvent) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const moved = useRef(false);

 
  useEffect(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, [src]);

  const zoomed = zoom > 1;

  const applyZoom = (next: number) => {
    const clamped = Math.min(MAX_ZOOM, Math.max(1, next));
    setZoom(clamped);
    if (clamped === 1) setOffset({ x: 0, y: 0 });
  };

  return (
    <>
      {!loaded && (
        <span className="pointer-events-none absolute h-9 w-9 animate-spin rounded-full border-2 border-white/20 border-t-amber-400" />
      )}

      <div
        className="flex h-full w-full items-center justify-center overflow-hidden"
        onWheel={(e) => {
          e.stopPropagation();
          applyZoom(zoom * (e.deltaY < 0 ? 1.25 : 0.8));
        }}
        onTouchStart={(e) => {
          
          if (zoomed) e.stopPropagation();
        }}
        onPointerDown={(e) => {
          moved.current = false;
          if (!zoomed) return;
          e.stopPropagation();
          drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const dx = e.clientX - drag.current.x;
          const dy = e.clientY - drag.current.y;
          if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved.current = true;
          setOffset({ x: drag.current.ox + dx, y: drag.current.oy + dy });
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
      >
        <FallbackImage
          src={src}
          alt={alt}
          loading="eager"
          onClick={(e) => {
            onClick(e); 
            
            if (!moved.current) applyZoom(zoomed ? 1 : 2.5);
          }}
          onLoad={() => setLoaded(true)}
          fallback={
            <p className="text-sm font-medium text-slate-400">
              Bu fotoğraf yüklenemedi
            </p>
          }
          className={`max-h-full max-w-full select-none rounded-lg object-contain shadow-2xl ${
            zoomed ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"
          } ${loaded ? "opacity-100" : "opacity-0"}`}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
            transition: drag.current ? "none" : "transform 0.15s ease, opacity 0.2s",
          }}
        />
      </div>

      {zoomed && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            applyZoom(1);
          }}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-black/90"
        >
          %{Math.round(zoom * 100)} · sıfırla
        </button>
      )}
    </>
  );
}
