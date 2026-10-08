import { describe, expect, it } from "vitest";
import { DAY_MS, familyId, retryDaysFor, selectRareFamilies, SOURCE_PAGE_SIZE } from "@/lib/scraper/rare-models";

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
  const pick = (ceiling: number, blocked = new Map<string, number>(), max = 50) =>
    selectRareFamilies(segments, ceiling, max, blocked, NOW).map((t) => `${t.brand} ${t.model}`);

  it("donanımları aile altında toplar: büyük ailenin tek ilanlı donanımı nadir sayılmaz", () => {
    const names = pick(10);
    expect(names).not.toContain("Fiat Linea"); // 43 ilan
    expect(names).not.toContain("Honda Civic");
    expect(names).toContain("Ford Escort");
    expect(names).toContain("Fiat Doblo");
  });

  it("en az ilanlı aile önce gelir; sabit hedef yok, tavan yükselince daha çok ilanlı aileler de sıraya girer", () => {
    expect(pick(10)).toEqual(["Anadol A1", "Ford Escort", "Fiat Doblo"]);
    const wider = pick(100);
    expect(wider.slice(0, 3)).toEqual(["Anadol A1", "Ford Escort", "Fiat Doblo"]);
    expect(wider).toContain("Fiat Linea");
    expect(wider.indexOf("Fiat Doblo")).toBeLessThan(wider.indexOf("Fiat Linea"));
  });

  it("eşit ilan sayısında popüler marka önce gelir", () => {
    const result = selectRareFamilies(
      [
        { brand: "Anadol", model: "A1", count: 2 },
        { brand: "Fiat", model: "Uno", count: 2 },
        { brand: "Fiat", model: "Egea", count: 900 },
      ],
      10,
      50,
      new Map(),
      NOW
    );
    expect(result.map((t) => t.brand)).toEqual(["Fiat", "Anadol"]);
  });

  it("anlamsız model adları hedeflenmez", () => {
    expect(pick(100).some((n) => n.startsWith("Opel"))).toBe(false);
  });

  it("denenen aile bekleme süresince atlanır, süre dolunca yeniden gelir", () => {
    const escort = selectRareFamilies(segments, 10, 50, new Map(), NOW).find((t) => t.brand === "Ford")!;
    const id = familyId(escort.brand, escort.familyKey);
    expect(pick(10, new Map([[id, NOW + 2 * DAY_MS]]))).not.toContain("Ford Escort");
    expect(pick(10, new Map([[id, NOW - 1]]))).toContain("Ford Escort");
  });

  it("üst sınırı uygular", () => {
    expect(pick(100, new Map(), 1)).toHaveLength(1);
  });
});

describe("retryDaysFor", () => {
  it("arama sayfaları dolduysa kaynakta daha fazlası vardır: 3 gün sonra yeniden dener", () => {
    expect(retryDaysFor(SOURCE_PAGE_SIZE, 1)).toBe(3);
    expect(retryDaysFor(2 * SOURCE_PAGE_SIZE, 2)).toBe(3);
  });

  it("sayfa dolmadıysa kaynakta olan hepsi çekilmiştir: 14 gün bekler", () => {
    expect(retryDaysFor(0, 1)).toBe(14);
    expect(retryDaysFor(SOURCE_PAGE_SIZE + 5, 2)).toBe(14);
  });
});
