import { describe, expect, it } from "vitest";
import { segmentFamilies, selectSparseMarketSegments, SEGMENT_TARGET_SAMPLE } from "./market-price";

describe("segmentFamilies", () => {
  it("kıyas ilanı segmentin en düşük fiyatlı ilanıdır", () => {
    const [family] = segmentFamilies([
      {
        brand: "Mercedes",
        model: "CLA",
        year: 2023,
        vehicleClass: "otomobil",
        prices: [1_100_000, 900_000, 1_000_000],
        listings: [
          { id: "c", price: 1_100_000 },
          { id: "a", price: 900_000 },
          { id: "b", price: 1_000_000 },
        ],
      },
    ]);
    expect(family.listingCount).toBe(3);
    expect(family.cheapestId).toBe("a");
  });

  it("emsal eşiği sabiti 12'dir (fırsat ve tarama hedefi)", () => {
    expect(SEGMENT_TARGET_SAMPLE).toBe(12);
  });
});

describe("selectSparseMarketSegments", () => {
  const groups = [
    { brand: "Mercedes", model: "CLA", year: 2023, vehicleClass: "otomobil", prices: [3_000_000, 3_100_000, 3_200_000] },
    { brand: "Mercedes", model: "CLA", year: 2022, vehicleClass: "otomobil", prices: [2_500_000] },
  ];

  it("emsali eşiğin altında kalan segmentleri en az ilanlıdan başlayarak verir", () => {
    const sparse = selectSparseMarketSegments(groups, 100, SEGMENT_TARGET_SAMPLE);
    expect(sparse.map((s) => s.year)).toEqual([2022, 2023]);
  });

  it("deneme kaydı olan segmenti (exclude) bu turda atlar", () => {
    const [first] = selectSparseMarketSegments(groups, 100, SEGMENT_TARGET_SAMPLE);
    const rest = selectSparseMarketSegments(groups, 100, SEGMENT_TARGET_SAMPLE, new Set([`${first.brand}::${first.familyKey}::${first.year}`]));
    expect(rest.map((s) => s.year)).toEqual([2023]);
  });
});
