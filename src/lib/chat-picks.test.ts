import { describe, expect, it, vi } from "vitest";

vi.mock("@/models/Car", () => ({ Car: {} }));

import { scorePick } from "./chat-picks";

const year = new Date().getFullYear();

describe("scorePick", () => {
  it("piyasanın altındaki, yeni ve az kilometreli aracı öne alır", () => {
    const good = scorePick({ price: 800_000, year: year - 3, mileage: 40_000, marketAvg: 1_000_000, marketCount: 10 });
    const average = scorePick({ price: 1_000_000, year: year - 3, mileage: 40_000, marketAvg: 1_000_000, marketCount: 10 });
    const old = scorePick({ price: 800_000, year: year - 20, mileage: 280_000, marketAvg: 1_000_000, marketCount: 10 });
    expect(good.score).toBeGreaterThan(average.score);
    expect(good.score).toBeGreaterThan(old.score);
    expect(good.discount).toBeCloseTo(0.2);
  });

  it("şüpheli derecede ucuz fiyatı avantaj saymaz", () => {
    const suspicious = scorePick({ price: 300_000, year: year - 3, mileage: 40_000, marketAvg: 1_000_000, marketCount: 10 });
    expect(suspicious.discount).toBe(0);
  });

  it("emsali az segmentte fiyat karşılaştırması yapmaz", () => {
    expect(scorePick({ price: 500_000, year: year - 3, mileage: 1, marketAvg: 1_000_000, marketCount: 2 }).discount).toBe(0);
  });

  it("ağır hasar kaydı puanı düşürür", () => {
    const base = { price: 900_000, year: year - 5, mileage: 90_000, marketAvg: 1_000_000, marketCount: 10 };
    expect(scorePick({ ...base, damageFlag: true }).score).toBeLessThan(scorePick(base).score);
  });
});

describe("scorePick fiyat bileşeni", () => {
  it("bütçe verilmemişse havuz medyanının çok üstündeki aracı geriye atar", () => {
    const base = { year: year - 1, mileage: 6_000, poolMedian: 1_200_000 };
    expect(scorePick({ ...base, price: 29_500_000 }).score).toBeLessThan(scorePick({ ...base, price: 1_100_000 }).score);
  });
});
