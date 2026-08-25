"use client";

const KEY = "otopiyasa:recently-viewed";
export const MAX_RECENTLY_VIEWED = 12;

export function getRecentlyViewedIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function save(ids: string[]) {
  window.localStorage.setItem(KEY, JSON.stringify(ids));
  window.dispatchEvent(new CustomEvent("recently-viewed:changed"));
}


export function addRecentlyViewed(id: string) {
  const ids = getRecentlyViewedIds().filter((x) => x !== id);
  ids.unshift(id);
  save(ids.slice(0, MAX_RECENTLY_VIEWED));
}

export function clearRecentlyViewed() {
  save([]);
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
