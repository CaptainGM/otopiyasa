import { describe, expect, it } from "vitest";
import { buildModelCurves } from "@/lib/model-curves";

function civic(year: number, price: number) {
  return { brand: "Honda", model: "Civic", year, price };
}

describe("buildModelCurves", () => {
  const cars = [
    civic(2016, 1_400_000),
    civic(2016, 1_500_000),
    civic(2018, 1_700_000),
    civic(2020, 1_900_000),
    civic(2022, 2_200_000),
    { brand: "Ford", model: "Focus", year: 2017, price: 800_000 },
  ];

  it("yeterli ilanı olan segmentin yıl bazlı ortalamasını üretir", () => {
    const curves = buildModelCurves(cars);
    expect(curves.segments).toEqual(["Honda Civic"]);

    const y2016 = curves.points.find((p) => p.year === 2016);
    expect(y2016?.["Honda Civic"]).toBe(1_450_000);

    const y2022 = curves.points.find((p) => p.year === 2022);
    expect(y2022?.["Honda Civic"]).toBe(2_200_000);
  });

  it("az ilanlı veya tek yıllı segmentleri elemeden geçirmez", () => {
  
    const flat = [civic(2020, 1_000_000), civic(2020, 1_100_000), civic(2020, 1_050_000),
      civic(2020, 1_020_000), civic(2020, 1_080_000)];
    expect(buildModelCurves(flat).segments).toEqual([]);
  });

  it("segment sayısını maxSegments ile sınırlar", () => {
    const many = [
      ...cars,
      { brand: "Ford", model: "Focus", year: 2016, price: 700_000 },
      { brand: "Ford", model: "Focus", year: 2018, price: 850_000 },
      { brand: "Ford", model: "Focus", year: 2020, price: 990_000 },
      { brand: "Ford", model: "Focus", year: 2021, price: 1_050_000 },
    ];
    const curves = buildModelCurves(many, 1);
    expect(curves.segments).toEqual(["Honda Civic"]);
  });

  it("geçersiz kayıtları atlar", () => {
    const curves = buildModelCurves([
      { brand: "", model: "X", year: 2020, price: 100 },
      { brand: "Y", model: "Z", year: 1980, price: 100 },
      { brand: "A", model: "B", year: 2020, price: 0 },
    ]);
    expect(curves.segments).toEqual([]);
  });
});
