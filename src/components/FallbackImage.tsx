"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { imageCandidates } from "@/lib/image-url";

const OPTIMIZED_IMAGE_HOSTS = [
  "images.unsplash.com",
  "sahibinden.com",
  "arabam.com",
  "mncdn.com",
  "asset.otomerkezi.net",
  "otokoc.com.tr",
];

export function FallbackImage({
  src,
  fallbacks = [],
  alt,
  className,
  fallback,
  maxPhotos,
  loading = "lazy",
  preferSize,
  sizes,
  style,
  onClick,
  onLoad,
}: {
  src?: string;
  fallbacks?: string[];
  alt: string;
  className?: string;
 
  fallback?: React.ReactNode;
  maxPhotos?: number;
  loading?: "lazy" | "eager";
 
  preferSize?: string;
  sizes?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent<HTMLImageElement>) => void;
  onLoad?: () => void;
}) {
  const candidates = imageCandidates(src, fallbacks, maxPhotos, preferSize);
  const key = candidates[0] || "";
  const [step, setStep] = useState(0);
  const nodeRef = useRef<HTMLImageElement | null>(null);

 
  useEffect(() => setStep(0), [key]);

  const next = useCallback(() => setStep((s) => s + 1), []);

  const attach = useCallback(
    (el: HTMLImageElement | null) => {
      nodeRef.current = el;
      if (!el) return;
      if (el.complete && el.naturalWidth === 0) next();
    },
    [next]
  );

 
  useEffect(() => {
    const el = nodeRef.current;
    if (el && el.complete && el.naturalWidth === 0) next();
  });

  const current = candidates[step];
  if (!current) return <>{fallback ?? null}</>;

  let canOptimize = false;
  let optimizerIsSlowForHost = false;
  try {
    const url = new URL(current);
    canOptimize =
      url.protocol === "https:" &&
      OPTIMIZED_IMAGE_HOSTS.some(
        (host) => url.hostname === host || url.hostname.endsWith(`.${host}`)
      );
    // The image proxy frequently times out on this source. Go directly to its
    // already-sized 800x600 variant instead of making a doomed proxy request
    // before falling back to the same CDN URL in the browser.
    optimizerIsSlowForHost = url.hostname.endsWith(".mncdn.com");
  } catch {
    // Data URLs and other local preview sources stay as native images.
  }

  if (canOptimize && !optimizerIsSlowForHost) {
    return (
      <Image
        ref={attach}
        src={current}
        alt={alt}
        fill
        sizes={sizes || "(max-width: 768px) 100vw, 33vw"}
        loading={loading}
        decoding="async"
        referrerPolicy="no-referrer"
        className={className}
        style={style}
        onClick={onClick}
        onLoad={onLoad}
        onError={next}
      />
    );
  }

  return (
  
    <img
      ref={attach}
      src={current}
      alt={alt}
      loading={loading}
      decoding="async"
      sizes={sizes}
      referrerPolicy="no-referrer"
      className={className}
      style={style}
      onClick={onClick}
      onLoad={onLoad}
      onError={next}
    />
  );
}
