import type { PipelineStage } from "mongoose";


export function mixedSortStages(seed = 0): PipelineStage[] {
  return [
    {
      $setWindowFields: {
        partitionBy: { $concat: [{ $ifNull: ["$brand", ""] }, "|", { $ifNull: ["$model", ""] }] },
        
        sortBy: { _id: -1 },
        output: { segmentRank: { $documentNumber: {} } },
      },
    },
    {
      $addFields: {
        mixKey: {
          $mod: [
            {
              $add: [
                { $toLong: { $ifNull: ["$price", 0] } },
                { $multiply: [{ $toLong: { $ifNull: ["$mileage", 0] } }, 31] },
                seed,
              ],
            },
            9973, 
          ],
        },
      },
    },
    { $sort: { segmentRank: 1, mixKey: 1, _id: 1 } },
    { $unset: ["segmentRank", "mixKey"] },
  ];
}


/**
 * İlan karması tohumu: Her 30 dakikada bir yenilenir (`1_800_000` ms).
 * Böylece kullanıcılar siteyi her ziyaret ettiklerinde farklı markalardan,
 * canlı ve zengin bir ilan karma seçkisiyle karşılaşırlar.
 */
export function dailyMixSeed(now = Date.now()): number {
  return Math.floor(now / 1_800_000);
}


/**
 * Rastgele akışın başlangıç noktası: tohumdan [0, 0.5) aralığında bir rand değeri.
 * İlk yarıdan başlandığı için (en az ~yarısı kadar ilan öndedir) sayfa sonuna gelip başa
 * sarmak gerekmez. Aynı tohum aynı akışı verir; farklı tohumlar farklı yerden başlar.
 */
export function seedToStart(seed: number): number {
  const mixed = Math.imul((Math.trunc(seed) | 0) ^ 0x9e3779b9, 2654435761) >>> 0;
  return (mixed / 4294967296) * 0.5;
}

/**
 * Tohum yoksa (eski mobil sürümler tohum göndermez) 30 dakikada bir değişen ortak tohum
 * kullanılır: sayfalar arası tutarlılık bozulmaz, yine de akış sabit "en yeni" değildir.
 */
export function resolveFeedSeed(seed?: number, now = Date.now()): number {
  return Number.isFinite(seed) && (seed as number) > 0 ? (seed as number) : dailyMixSeed(now);
}

/**
 * Akış tohumu havuzu: sayfa ve mobil uygulama 1..12 arasından seçer. Rastgele 31 bitlik tohum her istek
 * adresini benzersiz yapıyor, CDN hiçbir isteği tekrar kullanamıyordu (her sayfa kaydırma sunucuya gidiyordu);
 * 12 farklı akış ve kısa önbellek yine çeşitlilik verir ama aynı adresler paylaşılır.
 */
export const FEED_SEED_POOL = 12;
export const FEED_SEED_COOKIE = "op_feed_seed";

export function randomFeedSeed(previousSeed?: number): number {
  const seeds = Array.from({ length: FEED_SEED_POOL }, (_, index) => index + 1).filter(
    (seed) => seed !== previousSeed
  );
  return seeds[Math.floor(Math.random() * seeds.length)];
}

/** Tohum yoksa ya da havuzdaysa yanıt herkes için aynıdır, CDN'de saklanabilir. */
export function isCacheableFeedSeed(seed?: number | null): boolean {
  return seed === undefined || seed === null || (Number.isInteger(seed) && seed >= 1 && seed <= FEED_SEED_POOL);
}

export function isMixedSort(sort?: string): boolean {
  return !sort || sort === "mixed";
}
