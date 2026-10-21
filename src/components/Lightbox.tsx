"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { imageCandidates } from "@/lib/image-url";
import {
  BUTTON_STEP,
  centroidOf,
  clampView,
  DOUBLE_TAP_SCALE,
  identityView,
  MAX_SCALE,
  MIN_SCALE,
  panView,
  pinchView,
  type Point,
  settleView,
  spreadOf,
  type View,
  zoomAround,
} from "@/lib/zoom-math";
import { CarThumbPlaceholder } from "@/components/CarThumb";
import { FallbackImage } from "@/components/FallbackImage";

/** Çift dokunuş / çift tık en fazla bu aralıkta ve bu mesafede ikinci kez dokunulursa sayılır. */
const DOUBLE_TAP_MS = 320;
const DOUBLE_TAP_PX = 40;
/** Yatay kaydırma bu mesafeyi geçerse (ve dikey değilse) önceki/sonraki fotoğraf. */
const SWIPE_PX = 50;

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
        <ZoomableImage
          key={images[index]}
          src={images[index]}
          alt={`${title} — fotoğraf ${index + 1}`}
          onSwipe={(step) => go(index + step)}
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

/** Alanın merkezine göre bir ekran noktası (zoom-math merkez tabanlı koordinat kullanır). */
function relativeTo(stage: HTMLElement, clientX: number, clientY: number): Point {
  const rect = stage.getBoundingClientRect();
  return { x: clientX - (rect.left + rect.width / 2), y: clientY - (rect.top + rect.height / 2) };
}

type Gesture = {
  baseView: View;
  baseFocal: Point;
  baseSpread: number;
  startX: number;
  startY: number;
  moved: number;
  maxPointers: number;
  swipeable: boolean;
};

/**
 * Yakınlaştırılabilir fotoğraf. Mobilde iki parmakla büyütülüp küçültülür, yakınlaşmışken tek parmakla gezdirilir; masaüstünde
 * fare tekerleği (ctrl + tekerlek: dokunmatik yüzey pinch'i de böyle gelir) ve +/−/0 klavye kısayolları. Çift dokunuş ya da
 * çift tık yerinde yakınlaştırır. Normal boyutta yatay kaydırma önceki/sonraki fotoğrafa geçirir.
 */
function ZoomableImage({ src, alt, onSwipe }: { src: string; alt: string; onSwipe: (step: 1 | -1) => void }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>(identityView);
  const viewRef = useRef<View>(identityView());
  const [dragging, setDragging] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<Gesture | null>(null);
  const lastTap = useRef<{ time: number; point: Point } | null>(null);

  const commit = useCallback((next: View) => {
    viewRef.current = next;
    setView(next);
  }, []);

  /** Öteleme sınırı: görüntünün ölçeksiz (yerleşik) boyutu ve alan boyutu, transform'dan bağımsız okunur. */
  const clampToStage = useCallback((next: View): View => {
    const stage = stageRef.current;
    const img = stage?.querySelector("img");
    if (!stage || !img) return next;
    return clampView(next, { width: img.offsetWidth, height: img.offsetHeight }, { width: stage.clientWidth, height: stage.clientHeight });
  }, []);

  const zoomBy = useCallback(
    (factor: number) => {
      const current = viewRef.current;
      commit(clampToStage(zoomAround(current, { x: 0, y: 0 }, current.scale * factor)));
    },
    [clampToStage, commit]
  );

  const reset = useCallback(() => commit(identityView()), [commit]);

  const toggleAt = useCallback(
    (point: Point) => {
      const current = viewRef.current;
      if (current.scale > 1.01) reset();
      else commit(clampToStage(zoomAround(current, point, DOUBLE_TAP_SCALE)));
    },
    [clampToStage, commit, reset]
  );

  // Tekerlek ve iOS jest olayları sayfanın kendi zoom/kaydırmasına gitmesin: React'in onWheel'i pasiftir, bu yüzden
  // native dinleyici (passive: false) gerekir.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const point = relativeTo(stage, e.clientX, e.clientY);
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
      const current = viewRef.current;
      commit(clampToStage(zoomAround(current, point, current.scale * factor)));
    };
    const preventGesture = (e: Event) => e.preventDefault();
    stage.addEventListener("wheel", onWheel, { passive: false });
    stage.addEventListener("gesturestart", preventGesture);
    stage.addEventListener("gesturechange", preventGesture);
    return () => {
      stage.removeEventListener("wheel", onWheel);
      stage.removeEventListener("gesturestart", preventGesture);
      stage.removeEventListener("gesturechange", preventGesture);
    };
  }, [clampToStage, commit]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "+" || e.key === "=") zoomBy(BUTTON_STEP);
      else if (e.key === "-" || e.key === "_") zoomBy(1 / BUTTON_STEP);
      else if (e.key === "0") reset();
      else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reset, zoomBy]);

  const rebase = () => {
    const points = [...pointers.current.values()];
    const gestureNow = gesture.current;
    if (!gestureNow) return;
    gestureNow.baseView = viewRef.current;
    gestureNow.baseFocal = centroidOf(points);
    gestureNow.baseSpread = points.length >= 2 ? spreadOf(points[0], points[1]) : 0;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, relativeTo(stage, e.clientX, e.clientY));
    if (!gesture.current) {
      gesture.current = {
        baseView: viewRef.current,
        baseFocal: { x: 0, y: 0 },
        baseSpread: 0,
        startX: e.clientX,
        startY: e.clientY,
        moved: 0,
        maxPointers: 0,
        // Kaydırma (sonraki/önceki fotoğraf) yalnızca tek parmakla ve normal boyutta başlarsa geçerlidir.
        swipeable: viewRef.current.scale === 1,
      };
    }
    gesture.current.maxPointers = Math.max(gesture.current.maxPointers, pointers.current.size);
    if (pointers.current.size >= 2) gesture.current.swipeable = false;
    rebase();
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const stage = stageRef.current;
    const gestureNow = gesture.current;
    if (!stage || !gestureNow || !pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, relativeTo(stage, e.clientX, e.clientY));
    gestureNow.moved = Math.max(gestureNow.moved, Math.hypot(e.clientX - gestureNow.startX, e.clientY - gestureNow.startY));
    const points = [...pointers.current.values()];
    if (points.length >= 2) {
      if (gestureNow.baseSpread <= 0) return;
      commit(clampToStage(pinchView(gestureNow.baseView, gestureNow.baseFocal, gestureNow.baseSpread, centroidOf(points), spreadOf(points[0], points[1]))));
    } else if (gestureNow.baseView.scale > 1.01) {
      commit(clampToStage(panView(gestureNow.baseView, gestureNow.baseFocal, points[0])));
    }
  };

  const onPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const stage = stageRef.current;
    if (!stage || !pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size > 0) {
      // Bir parmak kalktı, kalan parmakla devam: taban yeniden alınır, görüntü zıplamaz.
      rebase();
      return;
    }
    const finished = gesture.current;
    gesture.current = null;
    setDragging(false);
    commit(clampToStage(settleView(viewRef.current)));
    if (!finished) return;

    const dx = e.clientX - finished.startX;
    const dy = e.clientY - finished.startY;
    if (finished.swipeable && finished.maxPointers === 1 && Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.2) {
      lastTap.current = null;
      onSwipe(dx < 0 ? 1 : -1);
      return;
    }
    if (finished.maxPointers === 1 && finished.moved < 8) {
      const point = relativeTo(stage, e.clientX, e.clientY);
      const now = Date.now();
      const previous = lastTap.current;
      if (previous && now - previous.time < DOUBLE_TAP_MS && Math.hypot(point.x - previous.point.x, point.y - previous.point.y) < DOUBLE_TAP_PX) {
        lastTap.current = null;
        toggleAt(point);
      } else {
        lastTap.current = { time: now, point };
      }
    } else {
      lastTap.current = null;
    }
  };

  const { scale } = view;
  const atMin = scale <= MIN_SCALE;
  const atMax = scale >= MAX_SCALE;
  const isIdentity = scale === 1 && view.x === 0 && view.y === 0;

  return (
    <div className="relative flex h-full w-full items-center justify-center" onClick={(e) => e.stopPropagation()}>
      <div
        ref={stageRef}
        className="flex h-full w-full items-center justify-center overflow-hidden select-none"
        // Tarayıcının kendi kaydırma/yakınlaştırmasını kapatır: iki parmak fotoğrafa gider, sayfaya değil.
        style={{ touchAction: "none", overscrollBehavior: "contain" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onDragStart={(e) => e.preventDefault()}
      >
        {!loaded && (
          <span className="pointer-events-none absolute h-9 w-9 animate-spin rounded-full border-2 border-white/20 border-t-amber-400" />
        )}
        <FallbackImage
          src={src}
          alt={alt}
          loading="eager"
          onLoad={() => setLoaded(true)}
          fallback={<p className="text-sm font-medium text-slate-400">Bu fotoğraf yüklenemedi</p>}
          className={`max-h-full max-w-full rounded-lg object-contain shadow-2xl ${loaded ? "opacity-100" : "opacity-0"}`}
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${scale})`,
            transformOrigin: "center",
            // Parmak basılıyken geçiş kapalı: pinch gecikmesiz izler. Düğme ve çift dokunuş yumuşak geçer.
            transition: dragging ? "none" : "transform 0.18s ease, opacity 0.2s",
          }}
        />
      </div>

      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/70 p-1 text-white shadow-lg backdrop-blur">
        <ZoomButton label="Uzaklaştır" disabled={atMin} onClick={() => zoomBy(1 / BUTTON_STEP)}>
          −
        </ZoomButton>
        <span className="min-w-[3.25rem] text-center text-xs font-bold tabular-nums">%{Math.round(scale * 100)}</span>
        <ZoomButton label="Yakınlaştır" disabled={atMax} onClick={() => zoomBy(BUTTON_STEP)}>
          +
        </ZoomButton>
        <button
          type="button"
          onClick={reset}
          disabled={isIdentity}
          className="ml-1 rounded-full px-2.5 py-1 text-xs font-semibold text-white/90 transition hover:bg-white/15 disabled:opacity-35"
        >
          Sıfırla
        </button>
      </div>
    </div>
  );
}

function ZoomButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-full text-lg font-bold transition hover:bg-white/15 disabled:opacity-35"
    >
      {children}
    </button>
  );
}
