
const MIN_INTERVAL_MS = Number(process.env.SCRAPE_MIN_INTERVAL_MS) || 700;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitter(baseMs: number) {
  return baseMs + Math.random() * 300;
}


const gateChain = new Map<string, Promise<void>>();

export async function waitForSlot(hostname: string) {
  const prev = gateChain.get(hostname) || Promise.resolve();

  const mine = prev.then(() => sleep(jitter(MIN_INTERVAL_MS)));
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
