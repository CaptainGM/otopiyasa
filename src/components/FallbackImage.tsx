"use client";

import { useCallback, useEffect, useState } from "react";
import { imageCandidates, sanitizeImageUrl } from "@/lib/image-url";

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

  useEffect(() => {
    setStep(0);
  }, [key]);

  const next = useCallback(() => {
    setStep((s) => s + 1);
  }, []);

  const current = candidates[step];
  if (!current) return <>{fallback ?? null}</>;

  const safeUrl = sanitizeImageUrl(current);

  return (
    <img
      src={safeUrl}
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
