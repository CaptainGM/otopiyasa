import { describe, expect, it } from "vitest";
import { cooldownDaysFor, DAY_MS, familyId, selectRareFamilies, SOURCE_PAGE_SIZE } from "@/lib/scraper/rare-models";

const NOW = Date.UTC(2026, 9, 8);

describe("selectRareFamilies", () => {
  const segments = [
    { brand: "Fiat", model: "Linea 1.3 M.Jet AC", count: 1 },
    { brand: "Fiat", model: "Linea 1.4 Fire Pop", count: 2 },
    { brand: "Fiat", model: "Linea 1.3 Multijet Active Plus", count: 40 },
    { brand: "Fiat", model: "Egea 1.3", count: 500 },
    { brand: "Fiat", model: "Doblo 1.6", count: 4 },
    { brand: "Anadol", model: "A1", count: 1 },
    { brand: "Anadol", model: "A1 1600", count: 1 },
    { brand: "Ford", model: "Escort 1.4 CL", count: 3 },
    { brand: "Ford", model: "Focus 1.6", count: 900 },
    { brand: "Honda", model: "Civic 1.6i VTEC LS", count: 1 },
    { brand: "Honda", model: "Civic 1.6 Elegance", count: 300 },
    { brand: "Opel", model: "Model", count: 1 },
  ];

  it("donanımları aile altında toplar: büyük ailenin tek ilanlı donanımı nadir sayılmaz", () => {
    const result = selectRareFamilies(segments, 10, 50, new Map(), NOW);
    const names = result.map((t) => `${t.brand} ${t.model}`);
    expect(names).not.toContain("Fiat Linea"); // 43 ilan
    expect(names).not.toContain("Honda Civic");
    expect(names).toContain("Ford Escort");
    expect(names).toContain("Fiat Doblo");
  });

  it("popüler markanın az ilanlı modeli, nadir markanınkinden önce gelir", () => {
    const result = selectRareFamilies(segments, 10, 50, new Map(), NOW);
    const order = result.map((t) => t.brand);
    expect(order.indexOf("Ford")).toBeLessThan(order.indexOf("Anadol"));
    expect(order.indexOf("Fiat")).toBeLessThan(order.indexOf("Anadol"));
  });

  it("aynı markada en az ilanlı aile önce gelir ve donanımlar tek hedef olur", () => {
    const result = selectRareFamilies(
      [
        { brand: "Fiat", model: "Doblo 1.6", count: 4 },
        { brand: "Fiat", model: "Uno", count: 1 },
        { brand: "Fiat", model: "Uno 1.4", count: 1 },
        { brand: "Fiat", model: "Egea", count: 900 },
      ],
      10,
      50,
      new Map(),
      NOW
    );
    expect(result.map((t) => t.model)).toEqual(["Uno", "Doblo"]);
    expect(result[0].count).toBe(2);
  });

  it("anlamsız model adları hedeflenmez", () => {
    const result = selectRareFamilies(segments, 100, 50, new Map(), NOW);
    expect(result.some((t) => t.brand === "Opel")).toBe(false);
  });

  it("bekleme süresi dolmamış aile atlanır, dolunca yeniden gelir", () => {
    const ford = selectRareFamilies(segments, 10, 50, new Map(), NOW).find((t) => t.brand === "Ford")!;
    const id = familyId(ford.brand, ford.familyKey);
    expect(selectRareFamilies(segments, 10, 50, new Map([[id, NOW + 5 * DAY_MS]]), NOW).some((t) => t.brand === "Ford")).toBe(false);
    expect(selectRareFamilies(segments, 10, 50, new Map([[id, NOW - 1]]), NOW).some((t) => t.brand === "Ford")).toBe(true);
  });

  it("üst sınırı uygular", () => {
    expect(selectRareFamilies(segments, 10, 1, new Map(), NOW)).toHaveLength(1);
  });
});

describe("cooldownDaysFor", () => {
  it("kaynakta az ilan bulunan aileyi uzun bekletir", () => {
    expect(cooldownDaysFor(0)).toBe(90);
    expect(cooldownDaysFor(SOURCE_PAGE_SIZE - 1)).toBe(90);
  });

  it("sayfa dolduysa kısa bekletir", () => {
    expect(cooldownDaysFor(SOURCE_PAGE_SIZE)).toBe(30);
    expect(cooldownDaysFor(40)).toBe(30);
  });
});
