import { clientIp } from "@/lib/api-rate-limit";

/**
 * /api/img için süreç içi (bellekte) hız kapısı.
 *
 * Neden veritabanı değil: /api/img, önbelleği ıskalayan her istek için kaynak fotoğrafı indirip sharp
 * ile küçültüyor. Bu yola her fotoğraf karesi için girildiği için Mongo tabanlı sayaç (bkz.
 * api-rate-limit.ts) her istekte fazladan bir veritabanı turu demek olurdu. Uç nokta zaten
 * önbelleğe alınmış yanıtların çoğunu sunucuya hiç uğratmıyor; buradaki amaç önbelleği bilerek
 * ıskalayan bir çağıranın işlemciyi tüketmesini engellemek.
 *
 * Sınırlar bilinçli olarak cömert: ilan listesinde ilk yüklemede onlarca kart, her kartta birkaç
 * fotoğraf isteniyor. Amaç normal gezinmeyi engellemek değil, tek kaynaktan saniyede yüzlerce
 * farklı boyut istemesini durdurmak.
 */
const WINDOW_MS = 10_000;
const MAX_PER_WINDOW = 240;

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

/** Kilitlenmesin diye ara sıra süresi geçmiş pencereler atılır. */
function sweep(now: number) {
  if (windows.size < 512) return;
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

/**
 * Sınırı aşan istek için 429 yanıtı, aksi hâlde null döner. Önbelleğe alınmaz; istemci fotoğrafı
 * gösteremez ve kısa süre sonra tekrar dener.
 */
export function checkImageRateLimit(request: Request): Response | null {
  const now = Date.now();
  sweep(now);

  const key = clientIp(request);
  const window = windows.get(key);

  if (!window || window.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return null;
  }

  window.count += 1;
  if (window.count <= MAX_PER_WINDOW) return null;

  const retryAfter = Math.max(1, Math.ceil((window.resetAt - now) / 1000));
  return new Response("Çok fazla fotoğraf isteği", {
    status: 429,
    headers: { "Retry-After": String(retryAfter), "Cache-Control": "no-store" },
  });
}

/** Yalnızca testler için: pencereleri sıfırlar. */
export function resetImageRateLimit() {
  windows.clear();
}

export const IMAGE_RATE_LIMIT_MAX = MAX_PER_WINDOW;
export const IMAGE_RATE_LIMIT_WINDOW_MS = WINDOW_MS;
