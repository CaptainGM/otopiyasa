import { describe, expect, it } from "vitest";
import { buildPriceBins } from "@/lib/price-bins";

describe("buildPriceBins", () => {
  it("fiyatları aralıklara böler ve mevcut aracı işaretler", () => {
    const prices = [500_000, 600_000, 700_000, 800_000, 900_000, 1_000_000];
    const bins = buildPriceBins(prices, 550_000, 5);

    expect(bins).toHaveLength(5);
    expect(bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(prices.length);
    expect(bins.filter((bin) => bin.isCurrent)).toHaveLength(1);
    expect(bins[0].isCurrent).toBe(true);
  });

  it("en yüksek fiyat son aralığa düşer (taşma olmaz)", () => {
    const bins = buildPriceBins([100, 200, 300], 300, 4);
    expect(bins[bins.length - 1].isCurrent).toBe(true);
  });

  it("3'ten az emsal varsa boş döner", () => {
    expect(buildPriceBins([500_000, 600_000], 550_000)).toEqual([]);
  });

  it("tüm fiyatlar aynıysa boş döner", () => {
    expect(buildPriceBins([500_000, 500_000, 500_000], 500_000)).toEqual([]);
  });
});
