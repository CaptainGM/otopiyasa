import { describe, expect, it } from "vitest";
import { isMixedSort, dailyMixSeed } from "./car-mix";

describe("isMixedSort", () => {
  it("varsayılan (sıralama seçilmemiş) karışıktır", () => {
    expect(isMixedSort(undefined)).toBe(true);
    expect(isMixedSort("")).toBe(true);
    expect(isMixedSort("mixed")).toBe(true);
  });

  it("açık sıralama seçildiğinde karıştırma devre dışı", () => {
    for (const sort of ["newest", "price_asc", "price_desc", "year_desc"]) {
      expect(isMixedSort(sort)).toBe(false);
    }
  });
});

describe("dailyMixSeed", () => {
  it("aynı gün sabit, farklı gün değişir (sayfalama tutarlılığı)", () => {
    const t = 1_800_000_000_000; 
    expect(dailyMixSeed(t)).toBe(dailyMixSeed(t + 1000)); 
    expect(dailyMixSeed(t)).not.toBe(dailyMixSeed(t + 86_400_000)); 
  });
});

describe("Keşfet akışı tohumu", () => {
  it("tohum yoksa (eski istemci) 30 dakikalık ortak tohuma düşer", async () => {
    const { resolveFeedSeed, dailyMixSeed } = await import("./car-mix");
    const now = Date.UTC(2026, 8, 30, 12, 0, 0);
    expect(resolveFeedSeed(undefined, now)).toBe(dailyMixSeed(now));
    expect(resolveFeedSeed(0, now)).toBe(dailyMixSeed(now));
    expect(resolveFeedSeed(987, now)).toBe(987);
  });
});

describe("akış tohumu havuzu (CDN önbelleği)", () => {
  it("rastgele tohum her zaman 1..8 arasındadır", async () => {
    const { randomFeedSeed, FEED_SEED_POOL } = await import("./car-mix");
    for (let i = 0; i < 500; i++) {
      const seed = randomFeedSeed();
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(1);
      expect(seed).toBeLessThanOrEqual(FEED_SEED_POOL);
    }
  });

  it("yalnızca tohumsuz ya da havuzdaki tohumlu istek önbelleğe alınabilir", async () => {
    const { isCacheableFeedSeed } = await import("./car-mix");
    expect(isCacheableFeedSeed(undefined)).toBe(true);
    expect(isCacheableFeedSeed(1)).toBe(true);
    expect(isCacheableFeedSeed(8)).toBe(true);
    expect(isCacheableFeedSeed(12)).toBe(true);
    expect(isCacheableFeedSeed(13)).toBe(false);
    expect(isCacheableFeedSeed(492230507)).toBe(false);
    expect(isCacheableFeedSeed(Number.NaN)).toBe(false);
  });

  it("önceki akış tohumunu hemen tekrar seçmez", async () => {
    const { randomFeedSeed, FEED_SEED_POOL } = await import("./car-mix");
    for (let previous = 1; previous <= FEED_SEED_POOL; previous++) {
      for (let i = 0; i < 30; i++) {
        expect(randomFeedSeed(previous)).not.toBe(previous);
      }
    }
  });
});

describe("indeksli keşfet sıralamaları", () => {
  it("havuzdaki her tohum tam liste için farklı ve tekrarlanabilir sıra seçer", async () => {
    const { FEED_SEED_POOL, feedOrderForSeed } = await import("./car-mix");
    const orders = Array.from({ length: FEED_SEED_POOL }, (_, index) => feedOrderForSeed(index + 1));
    expect(new Set(orders.map(({ field, direction }) => `${field}:${direction}`)).size).toBe(FEED_SEED_POOL);
    expect(feedOrderForSeed(3)).toEqual(feedOrderForSeed(3));
    expect(feedOrderForSeed(0)).toEqual(feedOrderForSeed(FEED_SEED_POOL));
  });
});

describe("Keşfet dilimleri (CDN'de paylaşılan, kişiye göre seçilen)", () => {
  it("24 dilim aynı dönemde farklı başlangıç noktaları ve 8 farklı sıralama kullanır", async () => {
    const { FEED_SLOTS, feedOrderForSlot } = await import("./car-mix");
    const orders = Array.from({ length: FEED_SLOTS }, (_, slot) => feedOrderForSlot(slot, 1000));
    expect(new Set(orders.map((o) => `${o.field}:${o.direction}`)).size).toBe(8);
    expect(new Set(orders.map((o) => o.pivot.toFixed(6))).size).toBe(FEED_SLOTS);
    for (const o of orders) expect(o.pivot).toBeGreaterThanOrEqual(0), expect(o.pivot).toBeLessThan(1);
  });

  it("aynı dilim aynı dönemde tekrarlanabilir, sonraki dönemde başka noktadan başlar", async () => {
    const { feedOrderForSlot } = await import("./car-mix");
    expect(feedOrderForSlot(5, 1000)).toEqual(feedOrderForSlot(5, 1000));
    expect(feedOrderForSlot(5, 1001).pivot).not.toBe(feedOrderForSlot(5, 1000).pivot);
  });

  it("önbelleği delmek için uydurulan dönemi kabul etmez", async () => {
    const { FEED_ROTATE_MS, resolveFeedBucket } = await import("./car-mix");
    const now = 1000 * FEED_ROTATE_MS + 5;
    expect(resolveFeedBucket(998, now)).toBe(998);
    expect(resolveFeedBucket(1001, now)).toBe(1000);
    expect(resolveFeedBucket(990, now)).toBe(1000);
    expect(resolveFeedBucket(undefined, now)).toBe(1000);
  });

  it("geçersiz dilimleri reddeder, bir önceki dilimi tekrar seçmez", async () => {
    const { isValidFeedSlot, randomFeedSlot } = await import("./car-mix");
    expect(isValidFeedSlot(0)).toBe(true);
    expect(isValidFeedSlot(23)).toBe(true);
    expect(isValidFeedSlot(24)).toBe(false);
    expect(isValidFeedSlot(-1)).toBe(false);
    expect(isValidFeedSlot(1.5)).toBe(false);
    for (let i = 0; i < 200; i++) expect(randomFeedSlot(7)).not.toBe(7);
    expect(randomFeedSlot(undefined, () => 0.999999)).toBe(23);
  });

  it("karıştırma öğeleri kaybetmez", async () => {
    const { shuffleInPlace } = await import("./car-mix");
    const items = Array.from({ length: 24 }, (_, i) => i);
    expect([...shuffleInPlace([...items])].sort((a, b) => a - b)).toEqual(items);
  });
});
