import { describe, expect, it } from "vitest";
import { isMixedSort, mixedSortStages, dailyMixSeed } from "./car-mix";

describe("isMixedSort", () => {
  it("varsayılan (sıralama seçilmemiş) karışıktır", () => {
    expect(isMixedSort(undefined)).toBe(true);
    expect(isMixedSort("")).toBe(true);
    expect(isMixedSort("mixed")).toBe(true);
  });

  it("açık sıralama seçildiğinde karıştırma devre dışı", () => {
    for (const sort of ["newest", "price_asc", "price_desc", "year_desc"]) {
      expect(isMixedSort(sort)).toBe(false);
    }
  });
});

describe("dailyMixSeed", () => {
  it("aynı gün sabit, farklı gün değişir (sayfalama tutarlılığı)", () => {
    const t = 1_800_000_000_000; 
    expect(dailyMixSeed(t)).toBe(dailyMixSeed(t + 1000)); 
    expect(dailyMixSeed(t)).not.toBe(dailyMixSeed(t + 86_400_000)); 
  });
});

describe("mixedSortStages", () => {
  const stages = mixedSortStages();

  it("tohum mixKey hesabına girer (dizilim günden güne tazelensin)", () => {
    const withSeed = JSON.stringify(mixedSortStages(12345));
    const noSeed = JSON.stringify(mixedSortStages(0));
    expect(withSeed).toContain("12345");
    expect(withSeed).not.toBe(noSeed);
  });

  it("marka+model segmentine göre bölümler", () => {
    const win = stages[0] as { $setWindowFields: { partitionBy: unknown } };
    expect(JSON.stringify(win.$setWindowFields.partitionBy)).toContain("$brand");
    expect(JSON.stringify(win.$setWindowFields.partitionBy)).toContain("$model");
  });

  it("$documentNumber TEK alanlı sortBy ile kullanılır", () => {
    
    const win = stages[0] as { $setWindowFields: { sortBy: Record<string, number> } };
    expect(Object.keys(win.$setWindowFields.sortBy)).toHaveLength(1);
  });

  it("sıralama önce segment sırası, sonra dağıtıcı anahtar", () => {
    const sortStage = stages.find((s) => "$sort" in s) as { $sort: Record<string, number> };
    const keys = Object.keys(sortStage.$sort);
    expect(keys[0]).toBe("segmentRank");
    expect(keys).toContain("mixKey");
    
    expect(keys[keys.length - 1]).toBe("_id");
  });

  it("yardımcı alanlar sonuçtan temizlenir", () => {
    const unset = stages.find((s) => "$unset" in s) as { $unset: string[] };
    expect(unset.$unset).toEqual(expect.arrayContaining(["segmentRank", "mixKey"]));
  });

  it("rastgelelik kullanmaz — sayfalama tutarlı olmalı", () => {
    
    const json = JSON.stringify(stages);
    expect(json).not.toContain("$sample");
    expect(json).not.toContain("$rand");
  });
});

describe("Keşfet akışı tohumu", () => {
  it("aynı tohum aynı başlangıcı, farklı tohumlar farklı başlangıçları verir", async () => {
    const { seedToStart } = await import("./car-mix");
    expect(seedToStart(12345)).toBe(seedToStart(12345));
    const starts = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => seedToStart(s).toFixed(6)));
    expect(starts.size).toBe(10);
  });

  it("başlangıç noktası [0, 0.5) aralığında kalır (sayfa sonuna gelip başa sarmak gerekmez)", async () => {
    const { seedToStart } = await import("./car-mix");
    for (let seed = 1; seed < 2000; seed += 7) {
      const start = seedToStart(seed);
      expect(start).toBeGreaterThanOrEqual(0);
      expect(start).toBeLessThan(0.5);
    }
    expect(seedToStart(2_147_483_647)).toBeLessThan(0.5);
  });

  it("tohum yoksa (eski istemci) 30 dakikalık ortak tohuma düşer", async () => {
    const { resolveFeedSeed, dailyMixSeed } = await import("./car-mix");
    const now = Date.UTC(2026, 8, 30, 12, 0, 0);
    expect(resolveFeedSeed(undefined, now)).toBe(dailyMixSeed(now));
    expect(resolveFeedSeed(0, now)).toBe(dailyMixSeed(now));
    expect(resolveFeedSeed(987, now)).toBe(987);
  });
});
