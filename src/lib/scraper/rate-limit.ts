
const DEFAULT_INTERVAL_MS = Number(process.env.SCRAPE_MIN_INTERVAL_MS) || 0;

/**
 * Arabam için temel ilan arası bekleme (ms). Ortam değişkeni ayarlı değilse 900 ms kalıyordu: sunucu üzerinden çalışan nadir model ve
 * popüler aile taramaları bu hızda Cloudflare engeline takıldı. Toplu taramalar 6 sn gibi insansı bir hızla başlatır (bkz. setArabamPace).
 */
let arabamBaseMs = DEFAULT_INTERVAL_MS > 0 ? DEFAULT_INTERVAL_MS : 900;

/** Arabam isteklerinin temel aralığını değiştirir; çağıran işi bitirince önceki değeri geri koymalıdır. */
export function setArabamPace(ms: number): number {
  const previous = arabamBaseMs;
  arabamBaseMs = Math.max(900, ms);
  return previous;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitter(baseMs: number) {
  // İnsansı rastgele gezinme gecikmesi: 200ms - 600ms varyasyon
  const spread = baseMs > 3000 ? 800 : 400;
  return baseMs + Math.random() * spread;
}

const gateChain = new Map<string, Promise<void>>();

export async function waitForSlot(hostname: string) {
  const isArabam = hostname.includes("arabam.com");
  const baseMs = DEFAULT_INTERVAL_MS > 0
    ? DEFAULT_INTERVAL_MS
    : (isArabam ? arabamBaseMs : 800);

  const prev = gateChain.get(hostname) || Promise.resolve();
  const mine = prev.then(() => sleep(jitter(baseMs)));
  gateChain.set(hostname, mine);

  await prev;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { retries?: number; label?: string } = {}
): Promise<T> {
  const retries = options.retries ?? 2;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        const backoff = jitter(1000 * 2 ** attempt);
        console.warn(
          `${options.label || "İstek"} başarısız (deneme ${attempt + 1}/${retries + 1}), ${Math.round(backoff)}ms sonra tekrar denenecek.`
        );
        await sleep(backoff);
      }
    }
  }

  throw lastError;
}
