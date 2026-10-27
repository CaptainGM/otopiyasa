// Sunucu içi bellek önbelleği.
// globalThis ile Next.js Fast Refresh ve geliştirme derlemeleri sırasında
// önbellek silinmez; sunucu 0ms yanıt vermeye devam eder.

interface Entry {
  value: unknown;
  expires: number;
  refreshing?: boolean;
}

declare global {
  var __otopiyasa_cache: Map<string, Entry> | undefined;
}

const store: Map<string, Entry> = (globalThis as any).__otopiyasa_cache ?? new Map<string, Entry>();
(globalThis as any).__otopiyasa_cache = store;

const STALE_WINDOW_MS = 15 * 60 * 1000;
const MAX_ENTRIES = 1000;

function evictIfNeeded(now: number) {
  if (store.size < MAX_ENTRIES) return;
  for (const [key, entry] of store) {
    if (entry.expires <= now) store.delete(key);
  }
  while (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
}

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);

  // 1. Taze önbellek varsa anında (0ms) dön:
  if (hit && hit.expires > now) {
    return hit.value as T;
  }

  // 2. Süresi geçmiş ama bayat pencere içindeyse bayatı anında dön, arka planda yenile (stale-while-revalidate):
  if (hit && now - hit.expires < STALE_WINDOW_MS) {
    if (!hit.refreshing) {
      hit.refreshing = true;
      void fn()
        .then((fresh) => {
          store.set(key, { value: fresh, expires: Date.now() + ttlMs });
        })
        .catch(() => {
          hit.refreshing = false;
        });
    }
    return hit.value as T;
  }

  // 3. İlk kez isteniyorsa çalıştır ve kaydet:
  const value = await fn();
  evictIfNeeded(Date.now());
  store.set(key, { value, expires: Date.now() + ttlMs });
  return value;
}

export function invalidateCache(prefix?: string) {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export const CACHE_TTL = {
  short: 60 * 1000, // 1 dk
  medium: 5 * 60 * 1000, // 5 dk
  long: 15 * 60 * 1000, // 15 dk
} as const;
