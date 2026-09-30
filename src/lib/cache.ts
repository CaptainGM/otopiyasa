

interface Entry {
  value: unknown;
  expires: number;
  
  refreshing?: boolean;
}

const store = new Map<string, Entry>();


const STALE_WINDOW_MS = 10 * 60 * 1000;


const MAX_ENTRIES = 500;


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


  if (hit && hit.expires > now) {
    return hit.value as T;
  }

 
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
