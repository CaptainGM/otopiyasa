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
  priority = false,
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
  /** İlk ekrandaki görsel: tembel yükleme yok, yüksek ağ önceliği. */
  priority?: boolean;
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
      loading={priority ? "eager" : loading}
      fetchPriority={priority ? "high" : undefined}
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
