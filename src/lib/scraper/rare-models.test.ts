import { describe, expect, it } from "vitest";
import { familyId, selectRareFamilies } from "@/lib/scraper/rare-models";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 8);

describe("selectRareFamilies", () => {
  const segments = [
    { brand: "Fiat", model: "Linea 1.3 M.Jet AC", count: 1 },
    { brand: "Fiat", model: "Linea 1.4 Fire Pop", count: 2 },
    { brand: "Fiat", model: "Linea 1.3 Multijet Active Plus", count: 40 },
    { brand: "Anadol", model: "A1", count: 1 },
    { brand: "Anadol", model: "A1 1600", count: 1 },
    { brand: "Ford", model: "Escort 1.4 CL", count: 3 },
    { brand: "Honda", model: "Civic 1.6i VTEC LS", count: 1 },
    { brand: "Honda", model: "Civic 1.6 Elegance", count: 300 },
    { brand: "Opel", model: "Model", count: 1 },
  ];

  it("donanımları aile altında toplar: büyük ailenin tek ilanlı donanımı nadir sayılmaz", () => {
    const result = selectRareFamilies(segments, 10, 50, new Map(), NOW, 30 * DAY);
    const names = result.map((t) => `${t.brand} ${t.model}`);
    expect(names).not.toContain("Fiat Linea"); // 43 ilan
    expect(names).not.toContain("Honda Civic");
    expect(names).toContain("Ford Escort");
  });

  it("en az ilanlı aile önce gelir ve aynı ailenin donanımları tek hedef olur", () => {
    const result = selectRareFamilies(segments, 10, 50, new Map(), NOW, 30 * DAY);
    expect(result[0].brand).toBe("Anadol");
    expect(result.filter((t) => t.brand === "Anadol")).toHaveLength(1);
    expect(result.find((t) => t.brand === "Anadol")?.count).toBe(2);
  });

  it("anlamsız model adları hedeflenmez", () => {
    const result = selectRareFamilies(segments, 100, 50, new Map(), NOW, 30 * DAY);
    expect(result.some((t) => t.brand === "Opel")).toBe(false);
  });

  it("yakın zamanda denenip hâlâ az kalan aile atlanır, bekleme dolunca yeniden gelir", () => {
    const first = selectRareFamilies(segments, 10, 50, new Map(), NOW, 30 * DAY).find((t) => t.brand === "Ford")!;
    const id = familyId(first.brand, first.familyKey);
    const recent = selectRareFamilies(segments, 10, 50, new Map([[id, NOW - 5 * DAY]]), NOW, 30 * DAY);
    expect(recent.some((t) => t.brand === "Ford")).toBe(false);
    const stale = selectRareFamilies(segments, 10, 50, new Map([[id, NOW - 31 * DAY]]), NOW, 30 * DAY);
    expect(stale.some((t) => t.brand === "Ford")).toBe(true);
  });

  it("üst sınırı uygular", () => {
    expect(selectRareFamilies(segments, 10, 1, new Map(), NOW, 30 * DAY)).toHaveLength(1);
  });
});
