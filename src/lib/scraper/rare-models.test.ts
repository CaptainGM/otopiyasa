import { describe, expect, it } from "vitest";
import { familyId, selectRareFamilies } from "@/lib/scraper/rare-models";

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
    const names = selectRareFamilies(segments, 10, 50, new Set()).map((t) => `${t.brand} ${t.model}`);
    expect(names).not.toContain("Fiat Linea"); // 43 ilan
    expect(names).not.toContain("Honda Civic");
    expect(names).toContain("Ford Escort");
    expect(names).toContain("Fiat Doblo");
  });

  it("popüler markanın az ilanlı modeli, nadir markanınkinden önce gelir", () => {
    const order = selectRareFamilies(segments, 10, 50, new Set()).map((t) => t.brand);
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
      new Set()
    );
    expect(result.map((t) => t.model)).toEqual(["Uno", "Doblo"]);
    expect(result[0].count).toBe(2);
  });

  it("anlamsız model adları hedeflenmez", () => {
    expect(selectRareFamilies(segments, 100, 50, new Set()).some((t) => t.brand === "Opel")).toBe(false);
  });

  it("bir kez denenen aile bir daha seçilmez, sıra başka aileye geçer", () => {
    const first = selectRareFamilies(segments, 10, 1, new Set())[0];
    const attempted = new Set([familyId(first.brand, first.familyKey)]);
    const next = selectRareFamilies(segments, 10, 1, attempted)[0];
    expect(`${next.brand} ${next.model}`).not.toBe(`${first.brand} ${first.model}`);
    // Aylar sonra bile aynı aile geri gelmez (zaman aşımı yok).
    const all = selectRareFamilies(segments, 10, 50, attempted).map((t) => `${t.brand}::${t.familyKey}`);
    expect(all).not.toContain(familyId(first.brand, first.familyKey));
  });

  it("üst sınırı uygular", () => {
    expect(selectRareFamilies(segments, 10, 1, new Set())).toHaveLength(1);
  });
});
