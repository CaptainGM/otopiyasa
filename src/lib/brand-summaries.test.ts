import { describe, expect, it } from "vitest";
import { buildBrandSummaries, buildBrandSummariesFromGroups } from "@/lib/brand-summaries";

describe("buildBrandSummaries", () => {
  const cars = [
    { brand: "Honda", model: "Civic", price: 1_400_000 },
    { brand: "Honda", model: "Civic", price: 1_600_000 },
    { brand: "Honda", model: "Jazz", price: 900_000 },
    { brand: "Ford", model: "Focus", price: 800_000 },
  ];

  it("markaları ilan sayısına göre sıralar ve ortalamaları hesaplar", () => {
    const summaries = buildBrandSummaries(cars);
    expect(summaries[0].brand).toBe("Honda");
    expect(summaries[0].count).toBe(3);
    expect(summaries[0].avgPrice).toBe(1_300_000);
    expect(summaries[1].brand).toBe("Ford");
  });

  it("markanın en popüler modellerini kendi ortalamalarıyla verir", () => {
    const honda = buildBrandSummaries(cars)[0];
    expect(honda.topModels[0]).toEqual({ model: "Civic", count: 2, avgPrice: 1_500_000 });
    expect(honda.topModels[1]).toEqual({ model: "Jazz", count: 1, avgPrice: 900_000 });
  });

  it("aynı modelin farklı yazımlarını birleştirir, marka olmayanları atlar", () => {
    const summaries = buildBrandSummariesFromGroups([
      { brand: "Renault", model: "CLIO", count: 42, priceSum: 42 * 1_200_000 },
      { brand: "Renault", model: "Clio", count: 15, priceSum: 15 * 800_000 },
      { brand: "Renault", model: "Clio 1.5 dCi Joy", count: 3, priceSum: 3 * 1_000_000 },
      { brand: "Renault", model: "Megane", count: 30, priceSum: 30 * 1_500_000 },
      { brand: "Sahibinden", model: "Karavan Motokaravan", count: 5, priceSum: 5 * 1_000_000 },
    ]);
    expect(summaries.map((s) => s.brand)).toEqual(["Renault"]);
    expect(summaries[0].count).toBe(90);
    expect(summaries[0].topModels[0]).toEqual({ model: "Clio", count: 60, avgPrice: Math.round((42 * 1_200_000 + 15 * 800_000 + 3_000_000) / 60) });
    expect(summaries[0].topModels[1].model).toBe("Megane");
  });

  it("maxBrands sınırını uygular ve fiyatsız kayıtları atlar", () => {
    const summaries = buildBrandSummaries(
      [...cars, { brand: "Opel", model: "Astra", price: 0 }],
      1
    );
    expect(summaries).toHaveLength(1);
    expect(summaries[0].brand).toBe("Honda");
  });
});
