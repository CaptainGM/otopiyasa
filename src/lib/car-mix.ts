/**
 * İlan karması tohumu: Her 30 dakikada bir yenilenir (`1_800_000` ms).
 * Böylece kullanıcılar siteyi her ziyaret ettiklerinde farklı markalardan,
 * canlı ve zengin bir ilan karma seçkisiyle karşılaşırlar.
 */
export function dailyMixSeed(now = Date.now()): number {
  return Math.floor(now / 1_800_000);
}


const FEED_RANK_FIELDS = ["rand", "rand2", "rand3", "rand4"] as const;

/** Tohum, indekslenmiş tam liste sıralamalarından birini seçer. */
export function feedOrderForSeed(seed: number): {
  field: (typeof FEED_RANK_FIELDS)[number];
  direction: 1 | -1;
} {
  const poolIndex = ((Math.trunc(seed) - 1) % FEED_SEED_POOL + FEED_SEED_POOL) % FEED_SEED_POOL;
  return {
    field: FEED_RANK_FIELDS[Math.floor(poolIndex / 2)],
    direction: poolIndex % 2 === 0 ? 1 : -1,
  };
}

/**
 * Tohum yoksa (eski mobil sürümler tohum göndermez) 30 dakikada bir değişen ortak tohum
 * kullanılır: sayfalar arası tutarlılık bozulmaz, yine de akış sabit "en yeni" değildir.
 */
export function resolveFeedSeed(seed?: number, now = Date.now()): number {
  return Number.isFinite(seed) && (seed as number) > 0 ? (seed as number) : dailyMixSeed(now);
}

/**
 * Akış tohumu havuzu: güncel istemciler 1..8 arasından seçer. Eski mobil sürümler 9..12 gönderebilir;
 * sunucu bunları eşdeğer akışlara dönüştürür ve önbelleğe izin verir. Rastgele 31 bitlik tohum her istek
 * adresini benzersiz yapıyor, CDN hiçbir isteği tekrar kullanamıyordu (her sayfa kaydırma sunucuya gidiyordu);
 * 8 farklı akış ve kısa önbellek yine çeşitlilik verir ama aynı adresler paylaşılır.
 */
export const FEED_SEED_POOL = 8;
export const FEED_SEED_COOKIE = "op_feed_seed";

export function randomFeedSeed(previousSeed?: number): number {
  const seeds = Array.from({ length: FEED_SEED_POOL }, (_, index) => index + 1).filter(
    (seed) => seed !== previousSeed
  );
  return seeds[Math.floor(Math.random() * seeds.length)];
}

/** Tohum yoksa ya da havuzdaysa yanıt herkes için aynıdır, CDN'de saklanabilir. */
export function isCacheableFeedSeed(seed?: number | null): boolean {
  // 9..12 eski Android uygulamalarından gelebilir; feedOrderForSeed bunları 1..8'e eşler.
  return seed === undefined || seed === null || (Number.isInteger(seed) && seed >= 1 && seed <= 12);
}

export function isMixedSort(sort?: string): boolean {
  return !sort || sort === "mixed";
}
