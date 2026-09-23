"use client";



const KEY = "otopiyasa:compare";
export const MAX_COMPARE = 4;

export function getCompareIds(): string[] {
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
  window.dispatchEvent(new CustomEvent("compare:changed"));
}

export function isInCompare(id: string): boolean {
  return getCompareIds().includes(id);
}


export function toggleCompare(id: string): { added: boolean; full: boolean } {
  const ids = getCompareIds();
  const idx = ids.indexOf(id);
  if (idx >= 0) {
    ids.splice(idx, 1);
    save(ids);
    return { added: false, full: false };
  }
  if (ids.length >= MAX_COMPARE) {
    return { added: false, full: true };
  }
  ids.push(id);
  save(ids);
  return { added: true, full: false };
}

export function removeFromCompare(id: string) {
  save(getCompareIds().filter((x) => x !== id));
}

export function clearCompare() {
  save([]);
}


export function subscribeCompare(cb: () => void): () => void {
  const handler = () => cb();
  window.addEventListener("compare:changed", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("compare:changed", handler);
    window.removeEventListener("storage", handler);
  };
}
