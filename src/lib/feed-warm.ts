import { FEED_ROTATE_MS, FEED_SLOTS, feedBucket } from "@/lib/car-mix";
import { feedPageQuery, feedSliceQuery } from "@/lib/feed-url";
import { sanitizeBaseUrl } from "@/lib/app-url";

/**
 * Keşfet akışı dilimlerini CDN önbelleğine önceden koyar. Akışın her dilim sayfası herkes için aynıdır ve 15 dakika CDN'de saklanır
 * (bkz. api/cars/route.ts), ama trafik azken kullanıcının rastgele seçtiği dilim çoğunlukla önbellekte yoktur: istek soğuk sunucuya
 * gider ve ilk liste saniyelerce gelmezdi ("0 / 6 ilan yüklendi"de takılma, 13 Ekim 2026). VM'deki motor (scripts/daemon.ts) her
 * dönemde 24 dilimin ilk sayfasını bir kez ister; sonraki gerçek ziyaretçi ~0,3 sn'de alır. İstek bölgesi (fra1) ziyaretçilerle aynıdır
 * (VM'den ısıtılan adres bu bilgisayardan HIT döndü).
 */

/** Ana sayfa akışının sayfa boyutu (bkz. app/page.tsx: isFeed ? 24). */
export const WARM_PAGE_SIZE = 24;

const PRODUCTION_URL = "https://otopiyasa.app";

/**
 * Isıtılacak site. Motorun çalıştığı makinelerde NEXT_PUBLIC_APP_URL çoğu zaman http://localhost:3000 (.env.example) olur; CDN yalnızca
 * yayındaki adreste vardır, bu yüzden yerel/https olmayan adres yerine canlı adres kullanılır.
 */
export function feedWarmBaseUrl(configured: string | undefined = process.env.NEXT_PUBLIC_APP_URL): string {
  const base = sanitizeBaseUrl(configured, PRODUCTION_URL);
  try {
    const url = new URL(base);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
    return url.protocol === "https:" && !local ? base : PRODUCTION_URL;
  } catch {
    return PRODUCTION_URL;
  }
}

/** Filtresiz Keşfet akışının dilim sayfaları: verilen dönem için 24 dilimin tam adresi (dizin = dilim numarası). */
export function feedWarmUrls(baseUrl: string, bucket: number): string[] {
  return Array.from(
    { length: FEED_SLOTS },
    (_, slot) => `${baseUrl}/api/cars?${feedPageQuery(feedSliceQuery(`limit=${WARM_PAGE_SIZE}`, slot, bucket), 1, WARM_PAGE_SIZE)}`
  );
}

/**
 * Şimdiki dönem; dönem değişmesine `leadMs` kala bir sonraki de. CDN girdisi 15 dk taze + 5 dk bayat sunulur
 * (s-maxage=900, stale-while-revalidate=300): dönem sonundan en çok 5 dk önce ısıtılan sayfalar yeni dönemin tamamı boyunca anında gelir,
 * yeni dönemin ilk ziyaretçisi soğuk beklemez. (Sunucu bir sonraki dönemi kabul eder: bkz. car-mix.ts resolveFeedBucket.)
 */
export function bucketsToWarm(now = Date.now(), leadMs = 4 * 60 * 1000): number[] {
  const current = feedBucket(now);
  const untilNext = (current + 1) * FEED_ROTATE_MS - now;
  return untilNext < leadMs ? [current, current + 1] : [current];
}

/**
 * 24 dilimi sırayla ister (sunucuyu ve soğuk başlatmayı paralel zorlamamak için). Başarısız olanlar bir kez daha denenir;
 * başarılı/başarısız sayısını döndürür.
 */
export async function warmFeedSlots(
  baseUrl: string,
  bucket: number,
  options: { fetcher?: typeof fetch; pauseMs?: number } = {}
): Promise<{ ok: number; failed: number }> {
  const fetcher = options.fetcher ?? fetch;
  const pauseMs = options.pauseMs ?? 200;
  const urls = feedWarmUrls(baseUrl, bucket);
  const pause = () => (pauseMs > 0 ? new Promise((resolve) => setTimeout(resolve, pauseMs)) : undefined);

  async function warmOne(url: string): Promise<boolean> {
    try {
      const response = await fetcher(url, { headers: { "User-Agent": "OtoPiyasa-isitma/1.0" }, signal: AbortSignal.timeout(20_000) });
      // Gövde okunur ki bağlantı kapanmadan önbellek yanıtın tamamını alsın.
      await response.arrayBuffer();
      return response.ok;
    } catch {
      return false;
    }
  }

  let ok = 0;
  const retry: string[] = [];
  for (const url of urls) {
    if (await warmOne(url)) ok += 1;
    else retry.push(url);
    await pause();
  }
  let failed = 0;
  for (const url of retry) {
    await pause();
    if (await warmOne(url)) ok += 1;
    else failed += 1;
  }
  return { ok, failed };
}
