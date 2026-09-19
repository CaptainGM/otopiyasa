import { describe, expect, it } from "vitest";
import { buildBrandSummaries } from "@/lib/brand-summaries";

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

  it("maxBrands sınırını uygular ve fiyatsız kayıtları atlar", () => {
    const summaries = buildBrandSummaries(
      [...cars, { brand: "Opel", model: "Astra", price: 0 }],
      1
    );
    expect(summaries).toHaveLength(1);
    expect(summaries[0].brand).toBe("Honda");
  });
});
