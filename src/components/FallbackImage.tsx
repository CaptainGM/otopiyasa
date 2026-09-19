"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { imageCandidates } from "@/lib/image-url";


export function FallbackImage({
  src,
  fallbacks = [],
  alt,
  className,
  fallback,
  maxPhotos,
  loading = "lazy",
  preferSize,
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
      el.addEventListener("error", next);
      
      if (el.complete && el.naturalWidth === 0) next();
      return () => el.removeEventListener("error", next);
    },
    [next]
  );

 
  useEffect(() => {
    const el = nodeRef.current;
    if (el && el.complete && el.naturalWidth === 0) next();
  });

  const current = candidates[step];
  if (!current) return <>{fallback ?? null}</>;

  return (
  
    <img
      ref={attach}
      src={current}
      alt={alt}
      loading={loading}
      decoding="async"
      referrerPolicy="no-referrer"
      className={className}
      style={style}
      onClick={onClick}
      onLoad={onLoad}
    />
  );
}
