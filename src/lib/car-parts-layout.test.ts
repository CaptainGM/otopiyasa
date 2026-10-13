import { describe, expect, it } from "vitest";
import { INITIAL_PARTS, labelAnchor, LABEL_COLUMN, REGIONS, VIEW_H, VIEW_W } from "./car-parts-layout";

describe("araç parça şablonu verisi", () => {
  it("her parçanın bir bölgesi, her bölgenin bir parçası var", () => {
    expect(REGIONS.map((r) => r.id).sort()).toEqual(INITIAL_PARTS.map((p) => p.id).sort());
  });

  it("aynı sütundaki yan etiketler dar ekranda üst üste binmeyecek kadar uzak (en az ~62 birim)", () => {
    for (const side of ["left", "right"] as const) {
      const rows = REGIONS.filter((r) => r.label.side === side)
        .map((r) => r.label.y)
        .sort((a, b) => a - b);
      for (let i = 1; i < rows.length; i++) expect(rows[i] - rows[i - 1], `${side} sütunu ${rows[i - 1]}→${rows[i]}`).toBeGreaterThanOrEqual(62);
    }
  });

  it("etiketler çizim alanının içinde kalır", () => {
    for (const region of REGIONS) {
      expect(region.label.y).toBeGreaterThan(0);
      expect(region.label.y).toBeLessThan(VIEW_H);
    }
  });

  it("her okun ucu kendi bölgesinin içindedir", () => {
    for (const region of REGIONS) {
      expect(region.target.x).toBeGreaterThanOrEqual(region.x);
      expect(region.target.x).toBeLessThanOrEqual(region.x + region.w);
      expect(region.target.y).toBeGreaterThanOrEqual(region.y);
      expect(region.target.y).toBeLessThanOrEqual(region.y + region.h);
    }
  });

  it("ok, etiketin iç kenarından başlar", () => {
    const left = REGIONS.find((r) => r.label.side === "left")!;
    const right = REGIONS.find((r) => r.label.side === "right")!;
    expect(labelAnchor(left).x).toBeCloseTo(VIEW_W * LABEL_COLUMN);
    expect(labelAnchor(right).x).toBeCloseTo(VIEW_W * (1 - LABEL_COLUMN));
    expect(labelAnchor(REGIONS.find((r) => r.label.side === "top")!).y).toBeGreaterThan(REGIONS.find((r) => r.label.side === "top")!.label.y);
    expect(labelAnchor(REGIONS.find((r) => r.label.side === "bottom")!).y).toBeLessThan(REGIONS.find((r) => r.label.side === "bottom")!.label.y);
  });
});
