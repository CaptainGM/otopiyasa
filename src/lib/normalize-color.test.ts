import { describe, expect, it } from "vitest";
import { normalizeColor, normalizeColorOptions } from "@/lib/normalize-color";

describe("renk yazımı", () => {
  it("büyük-küçük harf ve boşluk farklarını tek yazıma çevirir", () => {
    expect(normalizeColor("  gri   (METALİK) ")).toBe("Gri (Metalik)");
  });

  it("aynı rengin yazım varyantlarını sayılarıyla birleştirir", () => {
    expect(
      normalizeColorOptions([
        { _id: "Beyaz", count: 10 },
        { _id: "beyaz", count: 3 },
        { _id: "Gri (metalik)", count: 4 },
        { _id: "Gri (Metalik)", count: 2 },
        { _id: "Diğer", count: 8 },
      ])
    ).toEqual([
      { color: "Beyaz", count: 13 },
      { color: "Gri (Metalik)", count: 6 },
    ]);
  });
});
