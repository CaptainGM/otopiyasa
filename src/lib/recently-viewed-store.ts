"use client";

const KEY = "otopiyasa:recently-viewed";
export const MAX_RECENTLY_VIEWED = 12;

/**
 * Son baktıklar hesap başına tutulur: aynı tarayıcıda hesap değişince önceki hesabın listesi görünmesin.
 * owner: giriş yapmış kullanıcının kimliği, misafirde "guest". Hesapsız eski liste bir kez silinir.
 */
function keyFor(owner: string): string {
  return `${KEY}:${owner}`;
}

let legacyPurged = false;
function purgeLegacy() {
  if (legacyPurged) return;
  legacyPurged = true;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Depolama kapalıysa eski anahtar zaten yok sayılır.
  }
}

export function getRecentlyViewedIds(owner: string): string[] {
  if (typeof window === "undefined") return [];
  purgeLegacy();
  try {
    const raw = window.localStorage.getItem(keyFor(owner));
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function save(owner: string, ids: string[]) {
  window.localStorage.setItem(keyFor(owner), JSON.stringify(ids));
  window.dispatchEvent(new CustomEvent("recently-viewed:changed"));
}

export function addRecentlyViewed(id: string, owner: string) {
  const ids = getRecentlyViewedIds(owner).filter((x) => x !== id);
  ids.unshift(id);
  save(owner, ids.slice(0, MAX_RECENTLY_VIEWED));
}

export function clearRecentlyViewed(owner: string) {
  save(owner, []);
}

export function subscribeRecentlyViewed(cb: () => void): () => void {
  const handler = () => cb();
  window.addEventListener("recently-viewed:changed", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("recently-viewed:changed", handler);
    window.removeEventListener("storage", handler);
  };
}
