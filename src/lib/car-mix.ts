/**
 * Keşfet akışı için indeksli bir rastgele başlangıç noktası üretir.
 * Her rank alanı aktif ilanlara bağımsız atanmış rastgele bir değer taşır;
 * tohum bu sıralamada nereden başlanacağını seçer. Böylece en yeni ilanlar
 * öne sabitlenmez ve tüm koleksiyonu bellekte karıştırmak gerekmez.
 */
export function dailyMixSeed(now = Date.now()): number {
  return Math.floor(now / 1_800_000);
}

const FEED_RANK_FIELDS = ["rand", "rand2", "rand3", "rand4"] as const;
const MAX_RANDOM_SEED = 2_147_483_647;
const LEGACY_SEED_POOL = 8;

/** Eski istemcilerden gelen küçük tohumlar için korunan sıralama havuzu. */
export const FEED_SEED_POOL = LEGACY_SEED_POOL;
export const FEED_SEED_COOKIE = "op_feed_seed";
export const MAX_FEED_SEED = MAX_RANDOM_SEED;

export function isValidFeedSeed(seed?: number | null): seed is number {
  return Number.isSafeInteger(seed) && (seed as number) > 0 && (seed as number) <= MAX_RANDOM_SEED;
}

function randomSafeInteger(): number {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.getRandomValues) {
    const words = new Uint32Array(1);
    cryptoApi.getRandomValues(words);
    const value = words[0] & 0x7fffffff;
    return value || 1;
  }
  return 1 + Math.floor(Math.random() * (MAX_RANDOM_SEED - 1));
}

/** Her ziyaret/yenileme için yüksek entropili tohum; hemen önceki tohum tekrar seçilmez. */
export function randomFeedToken(previousSeed?: number): number {
  let seed = randomSafeInteger();
  while (seed <= 12 || seed === previousSeed) seed = randomSafeInteger();
  return seed;
}

/** Önceki sürümlerle uyumluluk: küçük CDN tohum havuzunu kullanan istemciler için. */
export function randomFeedSeed(previousSeed?: number): number {
  const seeds = Array.from({ length: LEGACY_SEED_POOL }, (_, index) => index + 1).filter(
    (seed) => seed !== previousSeed
  );
  return seeds[Math.floor(Math.random() * seeds.length)];
}

/** Tohumun seçtiği indeksli sıralama ve bu sıralamadaki başlangıç değeri. */
export function feedOrderForSeed(seed: number): {
  field: (typeof FEED_RANK_FIELDS)[number];
  direction: 1 | -1;
  pivot: number;
} {
  // Tohumsuz/eski istekler ve 1..12 eski mobil tohumları deterministik çalışır.
  const normalized = !Number.isSafeInteger(seed) || seed <= 0 ? LEGACY_SEED_POOL : Math.trunc(seed);
  const legacySeed = normalized <= 12;
  const token = legacySeed ? (normalized - 1) % LEGACY_SEED_POOL : normalized - 1;
  const orderIndex = token % LEGACY_SEED_POOL;
  const cycle = legacySeed ? 0 : Math.floor(token / LEGACY_SEED_POOL);
  const maxCycle = Math.floor((MAX_RANDOM_SEED - 1) / LEGACY_SEED_POOL);

  return {
    field: FEED_RANK_FIELDS[Math.floor(orderIndex / 2)],
    direction: orderIndex % 2 === 0 ? 1 : -1,
    pivot: cycle / (maxCycle + 1),
  };
}

/** Tohum verilmemiş eski API istemcileri için 30 dakikalık uyumlu varsayılan. */
export function resolveFeedSeed(seed?: number, now = Date.now()): number {
  return isValidFeedSeed(seed) ? seed : dailyMixSeed(now);
}

/** Yalnızca eski küçük sabit havuz CDN'de paylaşılabilir; kişiye özel tohumlar paylaşılmaz. */
export function isCacheableFeedSeed(seed?: number | null): boolean {
  return seed === undefined || seed === null || (Number.isInteger(seed) && seed >= 1 && seed <= 12);
}

/**
 * KEŞFET DİLİMLERİ (kişiye özel sıra, sunucuya kullanıcı başına yük binmeden):
 * Sunucu her 15 dakikada bir 24 farklı "dilim" hazırlar; her dilim rastgele rank alanlarından birinde farklı
 * bir noktadan başlar, yani farklı ilanlardan oluşur. Dilim sayfaları herkes için aynı olduğundan CDN'de
 * saklanır: 1.000 ziyaretçi de gelse aynı 15 dakikada en fazla 24 × sayfa sayısı kadar sorgu çalışır.
 * Tarayıcı/uygulama her açılışta rastgele bir dilim seçer (bir öncekini değil) ve gelen ilanları kendi
 * içinde karıştırır: her kullanıcı ve her yenileme farklı sırayı ve farklı ilanları görür; dilim de
 * 15 dakikada bir döndüğü için yeni ilanlar akışa girer.
 */
export const FEED_SLOTS = 24;
export const FEED_ROTATE_MS = 15 * 60 * 1000;

export function feedBucket(now = Date.now()): number {
  return Math.floor(now / FEED_ROTATE_MS);
}

export function isValidFeedSlot(slot?: number | null): slot is number {
  return Number.isInteger(slot) && (slot as number) >= 0 && (slot as number) < FEED_SLOTS;
}

/**
 * İstemcinin gönderdiği dönem: oturum boyunca sabit kalır ki sonraki sayfalar aynı sırayla devam etsin.
 * Önbelleği delmek için uydurulan dönemler kabul edilmez (yalnızca son ~1 saat).
 */
export function resolveFeedBucket(requested?: number | null, now = Date.now()): number {
  const current = feedBucket(now);
  if (Number.isInteger(requested) && (requested as number) <= current && (requested as number) >= current - 4) {
    return requested as number;
  }
  return current;
}

function hash32(value: number): number {
  let x = value >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

/** Dilimin sırası: 4 rank alanı × 2 yön ve döneme göre değişen başlangıç noktası. */
export function feedOrderForSlot(
  slot: number,
  bucket: number
): { field: (typeof FEED_RANK_FIELDS)[number]; direction: 1 | -1; pivot: number } {
  const orderIndex = ((slot % 8) + 8) % 8;
  return {
    field: FEED_RANK_FIELDS[Math.floor(orderIndex / 2)],
    direction: orderIndex % 2 === 0 ? 1 : -1,
    pivot: hash32(bucket * 131 + slot * 7919 + 17) / 2 ** 32,
  };
}

/** Rastgele dilim; bir önceki açılıştaki dilim tekrar seçilmez. */
export function randomFeedSlot(previous?: number | null, random: () => number = Math.random): number {
  const choices = Array.from({ length: FEED_SLOTS }, (_, i) => i).filter((s) => s !== previous);
  return choices[Math.floor(random() * choices.length) % choices.length];
}

/** Fisher–Yates: aynı dilimi gören iki kullanıcı bile farklı sıra görsün. */
export function shuffleInPlace<T>(items: T[], random: () => number = Math.random): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

export function isMixedSort(sort?: string): boolean {
  return !sort || sort === "mixed";
}
