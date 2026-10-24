"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";

/**
 * Akilli Gezinti Baglantisi:
 * - Next.js varsayilan prefetch yetenegini acik tutar.
 * - Fare uzerine geldiginde (hover) rotayi aninda hafizaya alir.
 * - Tiklandigi anda sayfa 0ms gecikmeyle (aninda) acilir.
 */
export function NavLink({ href, onMouseEnter, onFocus, ...props }: ComponentProps<typeof Link>) {
  const router = useRouter();

  const handleHover = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (typeof href === "string" && !href.startsWith("http") && !href.startsWith("#")) {
      router.prefetch(href);
    }
    onMouseEnter?.(e);
  };

  const handleFocus = (e: React.FocusEvent<HTMLAnchorElement>) => {
    if (typeof href === "string" && !href.startsWith("http") && !href.startsWith("#")) {
      router.prefetch(href);
    }
    onFocus?.(e);
  };

  return (
    <Link
      href={href}
      prefetch={true}
      onMouseEnter={handleHover}
      onFocus={handleFocus}
      {...props}
    />
  );
}
