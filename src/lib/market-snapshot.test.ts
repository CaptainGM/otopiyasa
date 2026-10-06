import { describe, expect, it, vi } from "vitest";

vi.mock("@/models/Car", () => ({ Car: {} }));

import { marketSnapshotChanged } from "./market-snapshot";

describe("marketSnapshotChanged", () => {
  it("yeni değer ilk kez yazılır, değişmeyen yazılmaz", () => {
    expect(marketSnapshotChanged(undefined, { avg: 1_000_000, count: 5, scope: "model" })).toBe(true);
    expect(marketSnapshotChanged({ avg: 1_000_000, count: 5, scope: "model" }, { avg: 1_002_000, count: 5, scope: "model" })).toBe(false);
  });

  it("emsal sayısı, kapsam ya da %0,5+ ortalama değişince yazılır", () => {
    const stored = { avg: 1_000_000, count: 5, scope: "model" };
    expect(marketSnapshotChanged(stored, { avg: 1_000_000, count: 6, scope: "model" })).toBe(true);
    expect(marketSnapshotChanged(stored, { avg: 1_000_000, count: 5, scope: "family" })).toBe(true);
    expect(marketSnapshotChanged(stored, { avg: 1_006_000, count: 5, scope: "model" })).toBe(true);
  });

  it("segment yetersiz kalınca eski değer silinir", () => {
    expect(marketSnapshotChanged({ avg: 1_000_000, count: 5 }, null)).toBe(true);
    expect(marketSnapshotChanged(undefined, null)).toBe(false);
  });
});
