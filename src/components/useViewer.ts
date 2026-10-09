"use client";

import { useEffect, useState } from "react";
import type { AvatarDescriptor } from "@/lib/avatar";

/** Giriş yapmış kullanıcının tarayıcıda okunabilen işareti (asıl oturum çerezi httpOnly'dir). */
export const SESSION_FLAG_COOKIE = "op_session";
const CHECKED_KEY = "op_viewer_checked";

export type Viewer = { id: string; name: string; role: "user" | "admin"; avatar?: AvatarDescriptor } | null;

let pending: Promise<Viewer> | null = null;

function hasSessionFlag(): boolean {
  return document.cookie.split("; ").some((c) => c.startsWith(`${SESSION_FLAG_COOKIE}=`));
}

/**
 * Sayfadaki tüm bileşenler (menü, favori, teklif...) tek isteği paylaşır. Giriş işareti olmayan ziyaretçi
 * için sunucuya hiç gidilmez: eskiden her sayfa açılışında herkes için bir fonksiyon çağrısı yapılıyordu.
 * İşaret çerezi bu sürümle geldiği için eski oturumlar tarayıcı oturumu başına bir kez kontrol edilir.
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
    .then((data: { user?: Viewer } | null) => data?.user ?? null)
    .catch(() => null)
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
  const [state, setState] = useState<{ viewer: Viewer; ready: boolean }>({ viewer: null, ready: false });
  useEffect(() => {
    let active = true;
    void loadViewer().then((viewer) => active && setState({ viewer, ready: true }));
    return () => {
      active = false;
    };
  }, []);
  return state;
}
