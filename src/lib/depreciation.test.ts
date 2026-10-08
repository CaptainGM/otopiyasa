import { describe, expect, it, vi } from "vitest";

vi.mock("@/models/Car", () => ({ Car: {} }));

import { conditionCurves, modelEffects, type CarCondition, type DepreciationRow } from "./depreciation";

const NOW = new Date("2026-10-08T00:00:00Z");

/** Bilinen etkilerle sentetik veri: yıllık %10, 10 bin km'de %2, hasar −%20, boya −%8. */
function synth(): DepreciationRow[] {
  const rows: DepreciationRow[] = [];
  let seed = 7;
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  for (let i = 0; i < 400; i++) {
    const age = Math.floor(rnd() * 10);
    const km = Math.round((age * 15_000 + rnd() * 40_000) / 1000) * 1000;
    const r = rnd();
    const condition: CarCondition = r < 0.15 ? "damaged" : r < 0.35 ? "painted" : "clean";
    const base = 1_000_000 * Math.pow(0.9, age) * Math.pow(0.98, km / 10_000);
    const factor = condition === "damaged" ? 0.8 : condition === "painted" ? 0.92 : 1;
    rows.push({ year: 2026 - age, mileage: km, price: Math.round(base * factor * (0.97 + rnd() * 0.06)), condition });
  }
  return rows;
}

describe("modelEffects", () => {
  it("bilinen etkileri birbirinden ayırarak bulur", () => {
    const e = modelEffects(synth(), NOW);
    expect(e.annualLossPct).toBeGreaterThan(8.5);
    expect(e.annualLossPct).toBeLessThan(11.5);
    expect(e.per10kKmLossPct).toBeGreaterThan(1);
    expect(e.per10kKmLossPct).toBeLessThan(3.2);
    expect(e.damagePct).toBeLessThan(-16);
    expect(e.damagePct).toBeGreaterThan(-24);
    expect(e.paintPct).toBeLessThan(-5);
    expect(e.paintPct).toBeGreaterThan(-11);
    expect(e.r2).toBeGreaterThan(0.9);
  });

  it("örnek azsa uydurma yapmaz", () => {
    const e = modelEffects(synth().slice(0, 10), NOW);
    expect(e).toMatchObject({ annualLossPct: null, per10kKmLossPct: null, damagePct: null, paintPct: null, sample: 10 });
  });

  it("hasarlı ilan yoksa hasar etkisi yok ama diğerleri hesaplanır", () => {
    const e = modelEffects(synth().filter((r) => r.condition !== "damaged"), NOW);
    expect(e.damagePct).toBeNull();
    expect(e.annualLossPct).not.toBeNull();
  });
});

describe("conditionCurves", () => {
  it("yıl başına durum serileri; tek ilanlık durum nokta olmaz", () => {
    const curves = conditionCurves([
      { year: 2020, mileage: 1, price: 100, condition: "clean" },
      { year: 2020, mileage: 1, price: 200, condition: "clean" },
      { year: 2020, mileage: 1, price: 50, condition: "damaged" },
      { year: 2021, mileage: 1, price: 300, condition: "clean" },
    ]);
    expect(curves).toEqual([{ year: 2020, clean: 150, painted: undefined, damaged: undefined }]);
  });
});

describe("typicalAnnualLossPct", () => {
  it("yaş ve yılda 15 bin km etkisinin toplamıdır", () => {
    const e = modelEffects(synth(), NOW);
    // 1 - 0,9 × 0,98^1,5 ≈ %12,7
    expect(e.typicalAnnualLossPct).toBeGreaterThan(11);
    expect(e.typicalAnnualLossPct).toBeLessThan(14.5);
  });
});
