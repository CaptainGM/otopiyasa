import { describe, expect, it, vi } from "vitest";

vi.mock("@/models/Car", () => ({ Car: {} }));
vi.mock("@/lib/price-prediction", () => ({
  derivePainted: (p?: string) => (p && /boya/i.test(p) ? 1 : 0),
  predictPrice: vi.fn(),
  withPredictionMemo: (fn: () => unknown) => fn(),
}));

import { conditionOf, fairFields, isDealCandidate } from "./market-fair";

const base = { year: 2019, mileage: 90_000, price: 820_000, title: "Temiz araç", vehicleClass: "otomobil" };

describe("fairFields", () => {
  it("adil değer, indirim oranı ve fiyat damgası", () => {
    const at = new Date("2026-10-07T10:00:00Z");
    const fields = fairFields(base, 1_000_000, 12, at)!;
    expect(fields).toMatchObject({
      "market.fair": 1_000_000,
      "market.fairN": 12,
      "market.disc": 0.18,
      "market.fp": 820_000,
      "market.fairAt": at,
    });
  });

  it("emsal yetersizse hesaplanmaz", () => {
    expect(fairFields(base, 1_000_000, 2)).toBeNull();
    expect(fairFields(base, 0, 12)).toBeNull();
  });
});

describe("isDealCandidate", () => {
  it("adil değerin altında, temiz ve yeni araç fırsattır", () => {
    expect(isDealCandidate(base, 0.18, 12)).toBe(true);
  });

  it("çok ucuz (şüpheli), az indirimli ya da kusurlu araç fırsat değildir", () => {
    expect(isDealCandidate(base, 0.45, 12)).toBe(false);
    expect(isDealCandidate(base, 0.05, 12)).toBe(false);
    expect(isDealCandidate({ ...base, damageFlag: true }, 0.18, 12)).toBe(false);
    expect(isDealCandidate({ ...base, title: "PERTLİ araç" }, 0.18, 12)).toBe(false);
    expect(isDealCandidate({ ...base, year: 2005 }, 0.18, 12)).toBe(false);
  });

  it("en az 12 emsal, en az 500 bin TL ve motosiklet/karavan dışarıda", () => {
    expect(isDealCandidate(base, 0.18, 11)).toBe(false);
    expect(isDealCandidate({ ...base, price: 499_000 }, 0.18, 12)).toBe(false);
    expect(isDealCandidate({ ...base, price: 500_000 }, 0.18, 12)).toBe(true);
    expect(isDealCandidate({ ...base, vehicleClass: "motosiklet" }, 0.18, 12)).toBe(false);
    expect(isDealCandidate({ ...base, vehicleClass: "karavan" }, 0.18, 12)).toBe(false);
  });
});

describe("conditionOf", () => {
  it("hasar kaydı > boya > temiz", () => {
    expect(conditionOf({ damageFlag: true, paintChange: "boyalı" })).toBe("damaged");
    expect(conditionOf({ paintChange: "2 parça boyalı" })).toBe("painted");
    expect(conditionOf({})).toBe("clean");
  });
});

describe("isDealCandidate sınırı", () => {
  it("göstergede %40 (şüpheli ucuz) görünen ilan fırsat değildir; alt sınır %10", () => {
    expect(isDealCandidate(base, 0.396, 12)).toBe(false);
    expect(isDealCandidate(base, 0.394, 12)).toBe(true);
    expect(isDealCandidate(base, 0.105, 12)).toBe(true);
    expect(isDealCandidate(base, 0.094, 12)).toBe(false);
  });
});
