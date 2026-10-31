"use client";

import { useEffect, useState } from "react";
import type { AvatarDescriptor } from "@/lib/avatar";

/** Giriş yapmış kullanıcının tarayıcıda okunabilen işareti (asıl oturum çerezi httpOnly'dir). */
export const SESSION_FLAG_COOKIE = "op_session";
const CHECKED_KEY = "op_viewer_checked";
const VIEWER_CACHE_KEY = "op_viewer_cache";

export type Viewer = { id: string; name: string; role: "user" | "admin"; avatar?: AvatarDescriptor } | null;

let pending: Promise<Viewer> | null = null;

export function hasSessionFlag(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split("; ").some((c) => c.startsWith(`${SESSION_FLAG_COOKIE}=`));
}

export function getStoredViewer(): Viewer {
  if (typeof window === "undefined") return null;
  if (!hasSessionFlag()) {
    try {
      window.localStorage.removeItem(VIEWER_CACHE_KEY);
    } catch {
      // yoksay
    }
    return null;
  }
  try {
    const raw = window.localStorage.getItem(VIEWER_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && parsed.id && parsed.name) {
        return parsed as Viewer;
      }
    }
  } catch {
    // yoksay
  }
  return null;
}

/**
 * Sayfadaki tüm bileşenler (menü, favori, teklif...) tek isteği paylaşır. Giriş işareti olmayan ziyaretçi
 * için sunucuya hiç gidilmez. Giriş işareti varsa yerel önbellek anında devreye girer (FOUC önlenir).
 */
export function loadViewer(): Promise<Viewer> {
  if (pending) return pending;
  let checkedBefore = false;
  try {
    checkedBefore = window.sessionStorage.getItem(CHECKED_KEY) === "1";
  } catch {
    // gizli sekme: aşağıda bir kez sorulur
  }
  if (!hasSessionFlag() && checkedBefore) {
    pending = Promise.resolve(null);
    return pending;
  }
  pending = fetch("/api/auth/navbar", { credentials: "same-origin", cache: "no-store" })
    .then((response) => (response.ok ? response.json() : null))
    .then((data: { user?: Viewer } | null) => {
      const viewer = data?.user ?? null;
      try {
        if (viewer) {
          window.localStorage.setItem(VIEWER_CACHE_KEY, JSON.stringify(viewer));
        } else {
          window.localStorage.removeItem(VIEWER_CACHE_KEY);
        }
      } catch {
        // yoksay
      }
      return viewer;
    })
    .catch(() => getStoredViewer())
    .then((viewer) => {
      try {
        window.sessionStorage.setItem(CHECKED_KEY, "1");
      } catch {
        // yoksay
      }
      return viewer;
    });
  return pending;
}

export function useViewer(): { viewer: Viewer; ready: boolean } {
  const [state, setState] = useState<{ viewer: Viewer; ready: boolean }>(() => {
    const stored = getStoredViewer();
    if (stored) {
      return { viewer: stored, ready: true };
    }
    const hasFlag = typeof window !== "undefined" && hasSessionFlag();
    // Oturum bayrağı yoksa kesinlikle giriş yapmamış (ready: true, viewer: null)
    return { viewer: null, ready: !hasFlag };
  });

  useEffect(() => {
    let active = true;
    void loadViewer().then((viewer) => {
      if (active) setState({ viewer, ready: true });
    });
    return () => {
      active = false;
    };
  }, []);

  return state;
}
